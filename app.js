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
// MODIFIED: Use a Map to store user data associated with socket IDs
const onlineUsers = new Map();
// Use a Map to store private chat session instances for each user
const userPrivateChatSessions = new Map();
// Create a single, shared public chat session for all users
const publicChatModel = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
const publicChat = publicChatModel.startChat({ history: [] });

// --- NEW: In-memory cache for Giphy API results ---
const giphyCache = new Map();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes


// --- Socket.IO Connection Handling ---
// MODIFIED: Add middleware to handle user authentication
io.use((socket, next) => {
    const user = socket.handshake.auth.user;
    if (!user || !user.id || !user.name) {
        console.error('[Server] Middleware: Authentication failed. Invalid user data.');
        return next(new Error("Invalid user data"));
    }
    socket.user = user;
    next();
});

io.on('connection', (socket) => {
    onlineUsers.set(socket.id, socket.user);
    io.emit('total-user', onlineUsers.size);

    // For each user, create and store a new PRIVATE chat session instance.
    const privateChatModel = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
    userPrivateChatSessions.set(socket.id, privateChatModel.startChat({ history: [] }));


    socket.on('user-message', (message, callback) => {
        // MODIFIED: Ensure the message has the correct user data from the server-side socket
        const fullMessage = {
            ...message,
            user: socket.user
        };
        io.emit('backend-user-message', fullMessage);
        if (callback) {
            callback();
        }
    });

    // --- FIXED: AI Question Handler ---
    socket.on('ask-ai', async ({ question, isPublic }) => {
        let chat;
        // --- MODIFIED: Simplified and corrected AI chat session handling ---
        if (isPublic) {
            // Use the shared public chat session for public questions
            chat = publicChat;
        } else {
            // Use the user's dedicated private chat session for private questions
            chat = userPrivateChatSessions.get(socket.id);
            if (!chat) {
                console.error(`Could not find private session for user ${socket.id}`);
                return socket.emit('ai-response', { error: "Could not find your AI session. Please reconnect." });
            }
        }

        try {
            // Use the SDK's sendMessage method, which handles history correctly for both public and private sessions
            const prompt = `Keep your response concise and conversational, like a chat message. User: "${question}"`;
            const result = await chat.sendMessage(prompt);
            const text = result.response.text();
            
            if (isPublic) {
                // Broadcast the public question and response to everyone else
                socket.broadcast.emit('public-ai-message', {
                    user: socket.user,
                    question: question,
                    answer: text
                });
                // Send the answer back to the original user as a standard AI response
                socket.emit('ai-response', { answer: text });
            } else {
                // Send the private response ONLY to the user who asked
                socket.emit('ai-response', { answer: text });
            }
            // NOTE: The flawed manual history update for private chats has been removed.
            // The Gemini SDK now correctly handles history for the 'chat' object automatically.

        } catch (error) {
            console.error("Gemini API Error:", error);
            const errorMessage = "Sorry, the AI is having trouble thinking right now.";
            // Properly emit errors back to the client
            if (isPublic) {
                 socket.broadcast.emit('public-ai-message', { user: socket.user, question: question, error: errorMessage }); // MODIFIED: Use the full user object
                 socket.emit('ai-response', { error: errorMessage });
            } else {
                socket.emit('ai-response', { error: errorMessage });
            }
        }
    });

    socket.on('disconnect', (reason) => {
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

    // --- NEW: Cache key based on query (or 'trending' if no query) ---
    const cacheKey = query ? query.trim().toLowerCase() : 'trending';
    const cachedData = giphyCache.get(cacheKey);

    // --- NEW: Check if valid, non-expired data is in the cache ---
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION_MS) {
        return res.json(cachedData.data);
    }


    const url = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=g`;

    try {
        const response = await axios.get(url);
        // --- NEW: Store the new data and a timestamp in the cache ---
        giphyCache.set(cacheKey, {
            timestamp: Date.now(),
            data: response.data
        });
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
