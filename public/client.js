// Initialize socket connection and DOM elements
const socket = io();
const chatMessages = document.querySelector(".chat-messages");
const inputField = document.querySelector(".chat-input input");
const sendButton = document.getElementById("send-button");
const disconnectBtn = document.getElementById("disconnect-button");
const connectionStatus = document.querySelector(".connection-status");
const userCount = document.querySelector(".user-count");

// Constants
const AI_ACTION_PREFIX = "@gemini";

// --- Socket Event Handlers ---

socket.on("connect", () => {
  updateConnectionStatus("Connecting...", true);
  // Simulate connection status update after a delay
  setTimeout(() => {
    if (socket.connected) {
      updateConnectionStatus("Connected", false);
    }
  }, 1300);
});

socket.on("backend-user-message", (message, id) => {
  // Only display messages that are not sent by the current client
  if (socket.id !== id) {
    addMessage(message, false);
  }
});

socket.on("total-user", (count) => {
  updateUserCount(count);
});

// --- UI Event Handlers ---

disconnectBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (socket.connected) {
    updateConnectionStatus("Disconnected", true);
    socket.disconnect();
  } else {
    socket.connect();
  }
});

sendButton.addEventListener("click", handleMessageSend);

inputField.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && inputField.value.trim()) {
    handleMessageSend();
  }
});

// --- Functions ---

/**
 * Updates the connection status text and toggles a 'connecting' class.
 * @param {string} text - Status text to display.
 * @param {boolean} isConnecting - Whether the connection is in progress.
 */
function updateConnectionStatus(text, isConnecting) {
  connectionStatus.textContent = text;
  connectionStatus.classList.toggle("connecting", isConnecting);
}

/**
 * Adds a message element to the chat container.
 * @param {string} content - Message text.
 * @param {boolean} isSent - True if the message is sent by the user, false if received.
 */
function addMessage(content, isSent) {
    const messageEl = document.createElement("div");
    messageEl.classList.add("message", isSent ? "sent" : "received");
  
    // Convert Markdown to HTML and sanitize it
    const formattedContent = DOMPurify.sanitize(marked.parse(content));
  
    messageEl.innerHTML = `<div class="message-content">${formattedContent}</div>`;
    chatMessages.appendChild(messageEl);
    
    // Auto-scroll to the latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Sends a message and handles AI request if triggered.
 */
async function handleMessageSend() {
  const messageContent = inputField.value.trim();
  if (!messageContent) return;

  // Send user's message and clear the input field
  processAndEmitMessage(messageContent, true);
  inputField.value = "";

  // If the message is intended for the AI, process the AI request.
  if (messageContent.startsWith(AI_ACTION_PREFIX)) {
    const question = messageContent.substring(AI_ACTION_PREFIX.length).trim();
    if (question) {
      console.log("AI handler activated");
      try {
        const aiResponse = await fetchAIResponse(question);
        processAndEmitMessage(aiResponse, false);
      } catch (error) {
        console.error("Error fetching AI response:", error);
        processAndEmitMessage("Sorry, an error occurred while processing your request.", false);
      }
    }
  }
}

/**
 * Emits the message to the backend and adds it to the chat.
 * @param {string} content - The content of the message.
 * @param {boolean} isSent - Whether the message was sent by the user.
 */
function processAndEmitMessage(content, isSent) {
  addMessage(content, isSent);
  if (isSent) {
    socket.emit("user-message", content);
  }
}

/**
 * Makes an asynchronous POST request to fetch AI response.
 * @param {string} question - The user's question.
 * @returns {Promise<string>} - The AI's answer.
 */
async function fetchAIResponse(question) {
  const response = await fetch("/askAI", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ques: question }),
  });
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  const data = await response.json();
  return data.answer;
}

/**
 * Updates the user count display.
 * @param {number} count - The number of connected users.
 */
function updateUserCount(count) {
  userCount.textContent = count;
}
