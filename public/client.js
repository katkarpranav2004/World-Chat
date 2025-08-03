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
        const loaderMessage = document.getElementById('ai-loader-message');
        if (loaderMessage && !aiPublicToggle.checked) {
            let content;
            if (data.error) {
                content = `🤖 **Gemini Error:**\n${data.error}`;
            } else {
                content = `🤖 **Gemini (Private):**\n${data.answer}`;
            }
            loaderMessage.innerHTML = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
            loaderMessage.removeAttribute('id');
        }
    });

    socket.on('public-ai-message', (data) => {
        const loaderMessage = document.getElementById('ai-loader-message');
        if (loaderMessage) {
            const senderId = data.user === socket.id ? 'You' : `User ${data.user.substring(0, 4)}`;
            let content;
            if (data.error) {
                content = `**(Public)** ${senderId} asked Gemini, but there was an error: ${data.error}`;
            } else {
                content = `**(Public)** ${senderId} asked:\n\n ${data.question}\n\n**🤖 Gemini Replied:**\n\n${data.answer}`;

            }
            loaderMessage.innerHTML = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
            loaderMessage.removeAttribute('id');
        } else {
            // This is a public message from another user, so just add it
            const senderId = data.user === socket.id ? 'You' : `User ${data.user.substring(0, 4)}`;
            let content;
            if (data.error) {
                content = `**(Public)** ${senderId} asked Gemini, but there was an error: ${data.error}`;
            } else {
                content = `**(Public)** ${senderId} asked:\n ${data.question}\n\n**🤖 Gemini Replied:**\n\n${data.answer}`;
            }
            addMessage(content, false);
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

        const messageId = addMessage(messageContent, true);

        if (messageContent.startsWith(AI_ACTION_PREFIX)) {
            const question = messageContent.substring(AI_ACTION_PREFIX.length).trim();
            if (question) {
                const isPublic = aiPublicToggle.checked;
                addMessage('<div class="loader"><div class="red bar"></div><div class="orange bar"></div><div class="yellow bar"></div><div class="green bar"></div><div class="blue bar"></div><div class="violet bar"></div></div>', false, 'ai-loader-message');
                socket.emit('ask-ai', { question, isPublic });
            }
        } else {
            socket.emit("user-message", messageContent, () => {
                const messageEl = document.getElementById(messageId);
                if (messageEl) {
                    const statusIndicator = messageEl.querySelector('.message-status');
                    if (statusIndicator) {
                        statusIndicator.textContent = 'sent';
                    }
                }
            });
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

    function addMessage(content, isSentByMe, id = null) {
        if (!chatMessages) return;

        const messageEl = document.createElement("div");
        messageEl.classList.add("message", isSentByMe ? "sent" : "received");
        if (isSentByMe) {
            messageEl.id = `msg-${Date.now()}`;
        }

        const messageContentEl = document.createElement("div");
        messageContentEl.classList.add("message-content");
        if (id) {
            messageContentEl.id = id;
        }

        if (content.startsWith(GIF_MARKER)) {
            const gifUrl = content.substring(GIF_MARKER.length);
            const img = document.createElement("img");
            img.src = gifUrl;
            img.alt = "GIF";
            messageContentEl.appendChild(img);
        } else if (content.startsWith('<div class="loader">')) {
            messageContentEl.innerHTML = content;
        } else {
            if (typeof marked === 'function' && typeof DOMPurify !== 'undefined') {
                const formattedContent = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
                messageContentEl.innerHTML = formattedContent;
            } else {
                messageContentEl.textContent = content;
                console.warn("marked.js or DOMPurify not loaded. Displaying raw text.");
            }
        }

        messageEl.appendChild(messageContentEl);

        if (isSentByMe) {
            const statusIndicator = document.createElement('span');
            statusIndicator.classList.add('message-status');
            statusIndicator.textContent = 'sending';
            messageEl.appendChild(statusIndicator);
        }

        chatMessages.appendChild(messageEl);
        scrollToBottom();

        return messageEl.id;
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
