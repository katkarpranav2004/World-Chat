// // Wait for the DOM to be fully loaded before executing any script
// document.addEventListener('DOMContentLoaded', () => {

//     // --- DOM Element Selection ---
//     const socket = io();
//     const chatMessages = document.querySelector(".chat-messages");
//     const inputField = document.querySelector(".chat-input .input");
//     const sendButton = document.getElementById("send-button");
//     const disconnectBtn = document.getElementById("disconnect-button");
//     const connectionStatus = document.querySelector(".connection-status");
//     const userCount = document.querySelector(".user-count");
//     // Get the new AI toggle button
//     const aiPublicToggleBtn = document.getElementById("ai-public-toggle");

//     // --- Constants ---
//     const AI_ACTION_PREFIX = "@gemini";
//     const GIF_MARKER = "GIF:";

//     // --- Socket Event Handlers ---

//     socket.on("connect", () => {
//         updateConnectionStatus("Connecting...", "connecting");
//         setTimeout(() => {
//             if (socket.connected) {
//                 updateConnectionStatus("Connected", "connected");
//             }
//         }, 1300);
//     });

//     socket.on("disconnect", () => {
//         updateConnectionStatus("Disconnected", "disconnected");
//         updateUserCount(0);
//     });

//     socket.on("connect_error", (err) => {
//         console.error("Connection Error:", err.message);
//         updateConnectionStatus("Connection Failed", "disconnected");
//     });

//     socket.on("backend-user-message", (message, id) => {
//         if (socket.id !== id) {
//             addMessage(message, false);
//         }
//     });

//     socket.on("total-user", (count) => {
//         updateUserCount(count);
//     });

//     socket.on('ai-response', (data) => {
//         if (data.error) {
//             addMessage(`🤖 **Gemini Error:**\n${data.error}`, false);
//         } else {
//             addMessage(`🤖 **Gemini (Private):**\n${data.answer}`, false);
//         }
//     });

//     socket.on('public-ai-message', (data) => {
//         const senderId = data.user === socket.id ? 'You' : `User ${data.user.substring(0, 4)}`;
//         if (data.error) {
//             addMessage(`**[Public]** ${senderId} asked Gemini, but there was an error: ${data.error}`, false);
//         } else {
//             const publicMessage = `**[Public] ${senderId} asked:**\n*${data.question}*\n\n**🤖 Gemini Replied:**\n${data.answer}`;
//             addMessage(publicMessage, data.user === socket.id);
//         }
//     });


//     // --- UI Event Handlers ---

//     if (disconnectBtn) {
//         disconnectBtn.addEventListener("click", () => {
//             if (socket.connected) socket.disconnect();
//             else socket.connect();
//         });
//     }

//     if (sendButton && inputField) {
//         sendButton.addEventListener("click", handleMessageSend);
//         inputField.addEventListener("keypress", (e) => {
//             if (e.key === "Enter") {
//                 e.preventDefault();
//                 handleMessageSend();
//             }
//         });
//     }
    
//     document.addEventListener('send-gif', (e) => {
//         const gifUrl = e.detail.url;
//         if (socket && socket.connected) {
//             const gifMessage = `${GIF_MARKER}${gifUrl}`;
//             addMessage(gifMessage, true);
//             socket.emit("user-message", gifMessage);
//         } else {
//             addMessage("Cannot send GIF. You are not connected.", false);
//         }
//     });

//     // --- NEW: Logic for the AI Toggle Button ---
//     if (inputField && aiPublicToggleBtn) {
//         // Show or hide the button based on input
//         inputField.addEventListener('input', () => {
//             if (inputField.value.trim().toLowerCase().startsWith(AI_ACTION_PREFIX)) {
//                 aiPublicToggleBtn.style.display = 'flex';
//             } else {
//                 aiPublicToggleBtn.style.display = 'none';
//             }
//         });

//         // Handle clicks on the toggle button
//         aiPublicToggleBtn.addEventListener('click', () => {
//             const isActive = aiPublicToggleBtn.classList.toggle('active');
//             // Update the tooltip to reflect the current state
//             aiPublicToggleBtn.setAttribute('title', `Toggle Public AI (${isActive ? 'On' : 'Off'})`);
//         });
//     }


//     // --- Core Functions ---

//     function handleMessageSend() {
//         if (!inputField || !socket || !socket.connected) {
//             addMessage("You are not connected.", false);
//             return;
//         }
//         const messageContent = inputField.value.trim();
//         if (!messageContent) return;

//         addMessage(messageContent, true);

//         if (messageContent.startsWith(AI_ACTION_PREFIX)) {
//             const question = messageContent.substring(AI_ACTION_PREFIX.length).trim();
//             if (question) {
//                 // Check if the new button has the 'active' class
//                 const isPublic = aiPublicToggleBtn.classList.contains('active');
//                 socket.emit('ask-ai', { question, isPublic });
//             }
//         } else {
//             socket.emit("user-message", messageContent);
//         }

//         inputField.value = "";
//         // Hide and reset the toggle button after sending
//         aiPublicToggleBtn.style.display = 'none';
//         aiPublicToggleBtn.classList.remove('active');
//         aiPublicToggleBtn.setAttribute('title', 'Toggle Public AI (Off)');
//         inputField.focus();
//     }

//     function updateConnectionStatus(text, status) {
//         if (!connectionStatus) return;
//         connectionStatus.textContent = text;
//         connectionStatus.className = 'connection-status';
//         connectionStatus.classList.add(status);
//         if (disconnectBtn) {
//             disconnectBtn.classList.toggle('connected', status === 'connected');
//         }
//     }

//     function addMessage(content, isSentByMe) {
//         if (!chatMessages) return;

//         const messageEl = document.createElement("div");
//         messageEl.classList.add("message", isSentByMe ? "sent" : "received");

//         const messageContentEl = document.createElement("div");
//         messageContentEl.classList.add("message-content");

//         if (content.startsWith(GIF_MARKER)) {
//             const gifUrl = content.substring(GIF_MARKER.length);
//             const img = document.createElement("img");
//             img.src = gifUrl;
//             img.alt = "GIF";
//             messageContentEl.appendChild(img);
//         } else {
//             if (typeof marked === 'function' && typeof DOMPurify !== 'undefined') {
//                 const formattedContent = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
//                 messageContentEl.innerHTML = formattedContent;
//             } else {
//                 messageContentEl.textContent = content;
//                 console.warn("marked.js or DOMPurify not loaded. Displaying raw text.");
//             }
//         }

//         messageEl.appendChild(messageContentEl);
//         chatMessages.appendChild(messageEl);
//         scrollToBottom();
//     }

//     function updateUserCount(count) {
//         if (userCount) {
//             userCount.textContent = count;
//         }
//     }

//     function scrollToBottom() {
//         if (chatMessages) {
//             chatMessages.scrollTop = chatMessages.scrollHeight;
//         }
//     }

//     // --- Initial Setup ---
//     addMessage("Welcome to World-Chat! Type '@gemini your question' to talk to the AI.", false);
// });


// Wait for the DOM to be fully loaded before executing any script
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selection ---
    const socket = io();
    const chatMessages = document.querySelector(".chat-messages");
    const inputField = document.querySelector(".chat-input .input");
    const sendButton = document.getElementById("send-button");
    const disconnectBtn = document.getElementById("disconnect-button");
    const connectionStatus = document.querySelector(".connection-status");
    const userCount = document.querySelector(".user-count");
    // Get the new AI toggle checkbox and its container
    const aiPublicToggle = document.getElementById("ai-public-toggle");
    const aiToggleContainer = document.querySelector(".ai-toggle-container");

    // --- Constants ---
    const AI_ACTION_PREFIX = "@gemini";
    const GIF_MARKER = "GIF:";

    // --- Socket Event Handlers ---

    socket.on("connect", () => {
        updateConnectionStatus("Connecting...", "connecting");
        setTimeout(() => {
            if (socket.connected) {
                updateConnectionStatus("Connected", "connected");
            }
        }, 1300);
    });

    socket.on("disconnect", () => {
        updateConnectionStatus("Disconnected", "disconnected");
        updateUserCount(0);
    });

    socket.on("connect_error", (err) => {
        console.error("Connection Error:", err.message);
        updateConnectionStatus("Connection Failed", "disconnected");
    });

    socket.on("backend-user-message", (message, id) => {
        if (socket.id !== id) {
            addMessage(message, false);
        }
    });

    socket.on("total-user", (count) => {
        updateUserCount(count);
    });

    socket.on('ai-response', (data) => {
        if (data.error) {
            addMessage(`🤖 **Gemini Error:**\n${data.error}`, false);
        } else {
            addMessage(`🤖 **Gemini (Private):**\n${data.answer}`, false);
        }
    });

    socket.on('public-ai-message', (data) => {
        const senderId = data.user === socket.id ? 'You' : `User ${data.user.substring(0, 4)}`;
        if (data.error) {
            addMessage(`**[Public]** ${senderId} asked Gemini, but there was an error: ${data.error}`, false);
        } else {
            const publicMessage = `**[Public] ${senderId} asked:**\n*${data.question}*\n\n**🤖 Gemini Replied:**\n${data.answer}`;
            addMessage(publicMessage, data.user === socket.id);
        }
    });


    // --- UI Event Handlers ---

    if (disconnectBtn) {
        disconnectBtn.addEventListener("click", () => {
            if (socket.connected) socket.disconnect();
            else socket.connect();
        });
    }

    if (sendButton && inputField) {
        sendButton.addEventListener("click", handleMessageSend);
        inputField.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleMessageSend();
            }
        });
    }
    
    document.addEventListener('send-gif', (e) => {
        const gifUrl = e.detail.url;
        if (socket && socket.connected) {
            const gifMessage = `${GIF_MARKER}${gifUrl}`;
            addMessage(gifMessage, true);
            socket.emit("user-message", gifMessage);
        } else {
            addMessage("Cannot send GIF. You are not connected.", false);
        }
    });

    // --- NEW: Logic for the AI Toggle Switch ---
    if (inputField && aiToggleContainer) {
        // Show or hide the switch based on input
        inputField.addEventListener('input', () => {
            if (inputField.value.trim().toLowerCase().startsWith(AI_ACTION_PREFIX)) {
                aiToggleContainer.style.display = 'flex';
            } else {
                aiToggleContainer.style.display = 'none';
            }
        });
    }


    // --- Core Functions ---

    function handleMessageSend() {
        if (!inputField || !socket || !socket.connected) {
            addMessage("You are not connected.", false);
            return;
        }
        const messageContent = inputField.value.trim();
        if (!messageContent) return;

        addMessage(messageContent, true);

        if (messageContent.startsWith(AI_ACTION_PREFIX)) {
            const question = messageContent.substring(AI_ACTION_PREFIX.length).trim();
            if (question) {
                // Check if the new checkbox is checked
                const isPublic = aiPublicToggle.checked;
                socket.emit('ask-ai', { question, isPublic });
            }
        } else {
            socket.emit("user-message", messageContent);
        }

        inputField.value = "";
        // Hide and reset the toggle switch after sending
        aiToggleContainer.style.display = 'none';
        aiPublicToggle.checked = false;
        inputField.focus();
    }

    function updateConnectionStatus(text, status) {
        if (!connectionStatus) return;
        connectionStatus.textContent = text;
        connectionStatus.className = 'connection-status';
        connectionStatus.classList.add(status);
        if (disconnectBtn) {
            disconnectBtn.classList.toggle('connected', status === 'connected');
        }
    }

    function addMessage(content, isSentByMe) {
        if (!chatMessages) return;

        const messageEl = document.createElement("div");
        messageEl.classList.add("message", isSentByMe ? "sent" : "received");

        const messageContentEl = document.createElement("div");
        messageContentEl.classList.add("message-content");

        if (content.startsWith(GIF_MARKER)) {
            const gifUrl = content.substring(GIF_MARKER.length);
            const img = document.createElement("img");
            img.src = gifUrl;
            img.alt = "GIF";
            messageContentEl.appendChild(img);
        } else {
            if (typeof marked === 'function' && typeof DOMPurify !== 'undefined') {
                const formattedContent = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
                messageContentEl.innerHTML = formattedContent;
            } else {
                messageContentEl.textContent = content;
                console.warn("marked.js or DOMPurify not loaded. Displaying raw text.");
            }
        }

        messageEl.appendChild(messageEl);
        chatMessages.appendChild(messageContentEl);
        scrollToBottom();
    }

    function updateUserCount(count) {
        if (userCount) {
            userCount.textContent = count;
        }
    }

    function scrollToBottom() {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // --- Initial Setup ---
    addMessage("Welcome to World-Chat! Type '@gemini your question' to talk to the AI.", false);
});
