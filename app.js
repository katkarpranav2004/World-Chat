const express = require('express');
const app = express();
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Environment Variable Validation ---
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not defined in the .env file.");
    process.exit(1);
}
if (!process.env.GIPHY_API_KEY) {
    console.warn("WARNING: GIPHY_API_KEY is not defined. The GIF feature will not work.");
}

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const server = http.createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});

const PORT = process.env.PORT || 8000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.resolve('./public')));

// --- In-Memory Data Stores ---
let onlineUsers = new Set();
// Use a Map to store private chat session instances for each user
const userPrivateChatSessions = new Map();
// Create a single, shared public chat session for all users
const publicChatModel = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
const publicChat = publicChatModel.startChat({ history: [] });


// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    onlineUsers.add(socket.id);
    io.emit('total-user', onlineUsers.size);

    // For each user, create and store a new PRIVATE chat session instance.
    const privateChatModel = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
    userPrivateChatSessions.set(socket.id, privateChatModel.startChat({ history: [] }));


    socket.on('user-message', (message, callback) => {
        io.emit('backend-user-message', message, socket.id);
        if (callback) {
            callback();
        }
    });

    // --- FIXED: AI Question Handler ---
    socket.on('ask-ai', async ({ question, isPublic }) => {
        let chat;
        if (isPublic) {
            // Use the shared public chat session
            chat = publicChat;
        } else {
            // For private questions, give the AI context of the public chat
            const privateChatSession = userPrivateChatSessions.get(socket.id);
            if (!privateChatSession) {
                console.error(`Could not find session for user ${socket.id}`);
                return socket.emit('ai-response', { error: "Could not find your session. Please reconnect." });
            }
            // Get history from the main public chat and the user's private chat
            const publicHistory = await publicChat.getHistory();
            const privateHistory = await privateChatSession.getHistory();

            // Combine histories to provide full context, then create a temporary session
            const combinedHistory = [...publicHistory, ...privateHistory];
            const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
            chat = model.startChat({ history: combinedHistory });
        }

        try {
            // Use the SDK's sendMessage method, which handles history correctly
            const prompt = `Keep your response concise and conversational, like a chat message. User: "${question}"`;
            const result = await chat.sendMessage(prompt);
            const text = result.response.text();
            
            if (isPublic) {
                // Broadcast the public question and response to everyone else
                socket.broadcast.emit('public-ai-message', {
                    user: socket.id,
                    question: question,
                    answer: text
                });
                // Send a private response to the original user
                socket.emit('ai-response', { answer: text });
            } else {
                // Send the private response ONLY to the user who asked
                socket.emit('ai-response', { answer: text });
                // Manually update the user's persistent private history
                const privateChatSession = userPrivateChatSessions.get(socket.id);
                const updatedHistory = await chat.getHistory();
                // We only need the last two items (the user's prompt and the model's response)
                const newMessages = updatedHistory.slice(-2); 
                privateChatSession.history.push(...newMessages);
            }

        } catch (error) {
            console.error("Gemini API Error:", error);
            const errorMessage = "Sorry, the AI is having trouble thinking right now.";
            // Properly emit errors back to the client
            if (isPublic) {
                 socket.broadcast.emit('public-ai-message', { user: socket.id, question: question, error: errorMessage });
                 socket.emit('ai-response', { error: errorMessage });
            } else {
                socket.emit('ai-response', { error: errorMessage });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        onlineUsers.delete(socket.id);
        // Clean up the user's private chat session from memory
        userPrivateChatSessions.delete(socket.id);
        io.emit('total-user', onlineUsers.size);
    });
});

// --- Express API Routes ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/gifs', async (req, res) => {
    const { query } = req.query;
    const apiKey = process.env.GIPHY_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: "Giphy API key is not configured on the server." });
    }

    const url = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=g`;

    try {
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        console.error("Giphy API proxy error:", error.message);
        res.status(500).json({ error: "Failed to fetch GIFs." });
    }
});

// --- Server Initialization ---
server.listen(PORT, () => {
    console.log(`\nServer is live on port: http://localhost:${PORT}`);
});
