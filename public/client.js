document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const AI_ACTION_PREFIX = '@ai';
    const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    const IS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const MOD_KEY = IS_MAC ? 'meta' : 'ctrl'; // 'meta' is the Command key on Mac
    
    // Keyboard shortcuts configuration
    const SHORTCUTS = {
        AI_TOGGLE: `${MOD_KEY}+/`,
        EMOJI_PICKER: `${MOD_KEY}+e`,
        GIF_PICKER: `${MOD_KEY}+g`,
        SEND_MESSAGE: `${MOD_KEY}+enter`,
        FOCUS_INPUT: `${MOD_KEY}+i`,
        HELP: 'f1', // CHANGED: Switched to F1 for universal, conflict-free help access
        AI_TRIGGER: IS_MAC ? 'ctrl+a' : 'alt+a' // Use Ctrl+A on Mac, Alt+A on Windows
    };

    // --- DOM Element Selection ---
    const socket = io();
    window.chatSocket = socket;

    const chatMessages = document.querySelector(".chat-messages");
    const inputField = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const disconnectBtn = document.getElementById("disconnect-button");
    const connectionStatus = document.querySelector(".connection-status");
    const userCount = document.querySelector(".user-count");
    const aiPublicToggle = document.getElementById("ai-public-toggle");
    const aiToggleContainer = document.querySelector(".ai-toggle-container");
    const helpButtonMobile = document.getElementById("help-button-mobile");
    const terminal = document.querySelector('.terminal'); // Get terminal element
    // const debugOverlay = document.getElementById('debug-overlay'); // Get debug element
    const MOD_SYMBOL = IS_MAC ? '⌘' : 'Ctrl'; // Define MOD_SYMBOL here for wider use

    // --- Mobile Viewport & Keyboard Handling ---
    function handleMobileViewport() {
        // RESTORED: Ensure this only runs on mobile
        if (!IS_MOBILE || !window.visualViewport) return;

        const setAppHeight = () => {
            // Set a CSS variable with the visual viewport's height.
            document.documentElement.style.setProperty('--app-height', `${window.visualViewport.height}px`);
        };

        // Set initial height and update on resize (keyboard open/close)
        window.visualViewport.addEventListener('resize', setAppHeight);
        setAppHeight(); // Initial call
    }


    // --- Keyboard Shortcut System ---
    let helpOverlayVisible = false;

    // Create help overlay
    function createHelpOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'shortcut-help-overlay';
        const MOD_SYMBOL = IS_MAC ? '⌘' : 'Ctrl';
        const AI_TRIGGER_TEXT = IS_MAC ? 'Ctrl + A' : 'Alt + A'; // Display correct shortcut text

        const mobileHelpContent = `
            <div class="help-header">
                <h3>📱 Mobile Guide</h3>
                <button class="help-close" aria-label="Close help">✕</button>
            </div>
            <div class="help-grid">
                <div class="shortcut-item"><span class="shortcut-key">😊</span><span class="shortcut-desc">Tap to open emoji picker</span></div>
                <div class="shortcut-item"><span class="shortcut-key">GIF</span><span class="shortcut-desc">Tap to open GIF picker</span></div>
                <div class="shortcut-item"><span class="shortcut-key">@ai</span><span class="shortcut-desc">Type to show AI options</span></div>
                <div class="shortcut-item"><span class="shortcut-key">🤖</span><span class="shortcut-desc">Toggle Public/Private AI chat</span></div>
                <div class="shortcut-item"><span class="shortcut-key">▶️</span><span class="shortcut-desc">Tap to send your message</span></div>
                <div class="shortcut-item"><span class="shortcut-key">⌀</span><span class="shortcut-desc">Tap to disconnect or reconnect</span></div>
            </div>
            <div class="help-footer"><small>💡 Tip: Tap outside this box to close it</small></div>
        `;

        const desktopHelpContent = `
            <div class="help-header">
                <h3>⌨️ Keyboard Shortcuts</h3>
                <button class="help-close" aria-label="Close help">✕</button>
            </div>
            <div class="help-grid">
                <div class="shortcut-item"><span class="shortcut-key">${AI_TRIGGER_TEXT}</span><span class="shortcut-desc">Toggle AI mode</span></div>
                <div class="shortcut-item"><span class="shortcut-key">${MOD_SYMBOL} + /</span><span class="shortcut-desc">Toggle Public/Private AI mode</span></div>
                <div class="shortcut-item"><span class="shortcut-key">${MOD_SYMBOL} + E</span><span class="shortcut-desc">Open emoji picker</span></div>
                <div class="shortcut-item"><span class="shortcut-key">${MOD_SYMBOL} + G</span><span class="shortcut-desc">Open GIF picker</span></div>
                <div class="shortcut-item"><span class="shortcut-key">${MOD_SYMBOL} + Enter</span><span class="shortcut-desc">Send message</span></div>
                <div class="shortcut-item"><span class="shortcut-key">${MOD_SYMBOL} + I</span><span class="shortcut-desc">Focus message input</span></div>
                <div class="shortcut-item"><span class="shortcut-key">F1</span><span class="shortcut-desc">Show/hide help (may require Fn key)</span></div>
                <div class="shortcut-item"><span class="shortcut-key">Enter</span><span class="shortcut-desc">Send message (when input focused)</span></div>
                <div class="shortcut-item"><span class="shortcut-key">Esc</span><span class="shortcut-desc">Close pickers/dialogs</span></div>
            </div>
            <div class="help-footer"><small>💡 Tip: Shortcuts work from anywhere in the chat</small></div>
        `;

        overlay.innerHTML = `<div class="help-content">${IS_MOBILE ? mobileHelpContent : desktopHelpContent}</div>`;
        document.body.appendChild(overlay);

        // Close button functionality
        const closeBtn = overlay.querySelector('.help-close');
        closeBtn.addEventListener('click', hideHelpOverlay);
        
        // Close on overlay click (but not content click)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) hideHelpOverlay();
        });

        return overlay;
    }

    function showHelpOverlay() {
        if (!document.getElementById('shortcut-help-overlay')) {
            createHelpOverlay();
        }
        const overlay = document.getElementById('shortcut-help-overlay');
        overlay.classList.add('visible');
        helpOverlayVisible = true;
    }

    function hideHelpOverlay() {
        const overlay = document.getElementById('shortcut-help-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            helpOverlayVisible = false;
        }
    }

    // Parse shortcut string (e.g., "ctrl+e" -> {ctrl: true, key: "e"})
    function parseShortcut(shortcut) {
        const parts = shortcut.toLowerCase().split('+');
        const result = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
        
        parts.forEach(part => {
            if (part === 'ctrl') result.ctrl = true;
            else if (part === 'alt') result.alt = true;
            else if (part === 'shift') result.shift = true;
            else if (part === 'meta') result.meta = true; // Add meta key support
            else result.key = part;
        });
        
        return result;
    }

    // Check if keyboard event matches shortcut
    function matchesShortcut(event, shortcut) {
        const parsed = parseShortcut(shortcut);
        return event.ctrlKey === parsed.ctrl &&
               event.altKey === parsed.alt &&
               event.shiftKey === parsed.shift &&
               event.metaKey === parsed.meta && // Check meta key for Mac
               event.key.toLowerCase() === parsed.key;
    }

    // Global keyboard event handler
    document.addEventListener('keydown', (e) => {
        // Don't run keyboard shortcuts on mobile devices
        if (IS_MOBILE) return;

        // If the event target is an input/textarea, only allow shortcuts that use a modifier key (Ctrl, Alt, Meta).
        // This prevents single-key shortcuts from firing when the user is just trying to type.
        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Allow specific non-modifier keys like 'Escape', 'Enter', and 'F1' to pass through.
            if (e.key.toLowerCase() !== 'escape' && e.key.toLowerCase() !== 'enter' && e.key.toLowerCase() !== 'f1') {
                return;
            }
        }

        // Handle Escape key
        if (e.key === 'Escape') {
            e.preventDefault();
            if (helpOverlayVisible) {
                hideHelpOverlay();
            } else {
                // Close any open pickers
                document.dispatchEvent(new CustomEvent('close-all-pickers'));
            }
            return;
        }

        // Handle other shortcuts
        if (matchesShortcut(e, SHORTCUTS.HELP)) {
            e.preventDefault();
            if (helpOverlayVisible) hideHelpOverlay();
            else showHelpOverlay();
        }
        else if (matchesShortcut(e, SHORTCUTS.AI_TOGGLE)) {
            e.preventDefault();
            if (aiToggleContainer.style.display === 'flex') {
                aiPublicToggle.checked = !aiPublicToggle.checked;
                showTooltip('AI mode: ' + (aiPublicToggle.checked ? 'Public' : 'Private'));
            }
        }
        else if (matchesShortcut(e, SHORTCUTS.AI_TRIGGER)) {
            e.preventDefault();
            // Toggle AI prefix
            if (inputField.value.trim().startsWith(AI_ACTION_PREFIX)) {
                // It's active, so deactivate it by removing the prefix
                inputField.value = inputField.value.substring(AI_ACTION_PREFIX.length).trimStart();
                showTooltip('AI mode deactivated');
            } else {
                // It's not active, so activate it by prepending the prefix
                inputField.value = AI_ACTION_PREFIX + ' ' + inputField.value;
                showTooltip('AI mode activated');
            }
            inputField.focus();
            // Manually dispatch an 'input' event to show/hide the AI toggle
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
        }
        else if (matchesShortcut(e, SHORTCUTS.EMOJI_PICKER)) { // FIX: Corrected typo from SHORTCUTT to SHORTCUTS
            e.preventDefault();
            document.getElementById('emoji-button')?.click();
            showTooltip('Emoji picker opened');
        }
        else if (matchesShortcut(e, SHORTCUTS.GIF_PICKER)) {
            e.preventDefault();
            document.getElementById('gif-button')?.click();
            showTooltip('GIF picker opened');
        }
        else if (matchesShortcut(e, SHORTCUTS.SEND_MESSAGE)) {
            e.preventDefault();
            if (inputField.value.trim()) {
                handleMessageSend();
                showTooltip('Message sent');
            }
        }
        else if (matchesShortcut(e, SHORTCUTS.FOCUS_INPUT)) {
            e.preventDefault();
            inputField.focus();
            showTooltip('Input focused');
        }
    }, true); // <-- ADD 'true' HERE to switch to the capture phase.

    // Tooltip system for shortcut feedback
    function showTooltip(message, duration = 2000) {
        // Remove existing tooltip
        const existing = document.querySelector('.shortcut-tooltip');
        if (existing) existing.remove();

        const tooltip = document.createElement('div');
        tooltip.className = 'shortcut-tooltip';
        tooltip.textContent = message;
        document.body.appendChild(tooltip);

        // Position near the input area
        const inputRect = inputField.getBoundingClientRect();
        tooltip.style.left = inputRect.left + 'px';
        tooltip.style.top = (inputRect.top - 40) + 'px';

        // Show and auto-hide
        requestAnimationFrame(() => tooltip.classList.add('visible'));
        setTimeout(() => {
            tooltip.classList.remove('visible');
            setTimeout(() => tooltip.remove(), 300);
        }, duration);
    }

    // Update status bar with contextual hints
    function updateStatusHints() {
        const hints = [];
        
        if (inputField.value.trim().startsWith(AI_ACTION_PREFIX)) {
            hints.push(`${MOD_SYMBOL}+/ to toggle AI mode`);
        }
        
        if (hints.length === 0) {
            hints.push(IS_MOBILE ? 'Tap the ? for help' : `F1 (or Fn+F1) for shortcuts`);
        }

        // Update connection status with hints when idle
        if (socket.connected && connectionStatus.textContent === 'Connected') {
            connectionStatus.textContent = hints[0];
        }
    }

    // --- Socket Event Handlers ---

    socket.on("connect", () => {
        updateConnectionStatus("Connecting...", "connecting");
        setTimeout(() => {
            if (socket.connected) {
                updateConnectionStatus("Connected", "connected");
                setTimeout(() => updateStatusHints(), 2000); // Show hints after connection
            }
        }, 1300);
    });

    socket.on("disconnect", () => {
        updateConnectionStatus("Disconnected", "disconnected");
        updateUserCount(0);
    });

    socket.on("connect_error", (err) => {
        updateConnectionStatus(`Connection failed: ${err.message}`, 'disconnected');
    });

    socket.on("backend-user-message", (message, id) => {
        if (socket.id !== id) {
            const isHtml = message.trim().startsWith('<img');
            addMessage(message, false, id, isHtml);
        }
    });

    socket.on("total-user", (count) => {
        if (userCount) {
            userCount.textContent = count;
        }
    });

    socket.on('ai-response', (data) => {
        const loaderMessage = document.getElementById('ai-loader-message');
        const messageContentEl = loaderMessage ? loaderMessage.querySelector('.message-content') : null;

        if (messageContentEl && !aiPublicToggle.checked) {
            let content;
            if (data.error) {
                content = `🤖 **Ai Error:**\n${data.error}`;
            } else {
                content = `🤖 **Ai (Private):**\n${data.answer}`;
            }
            messageContentEl.innerHTML = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
            loaderMessage.classList.remove('sent');
            loaderMessage.classList.add('received');
            loaderMessage.removeAttribute('id');
        }
    });

    socket.on('public-ai-message', (data) => {
        const loaderMessage = document.getElementById('ai-loader-message');
        const messageContentEl = loaderMessage ? loaderMessage.querySelector('.message-content') : null;

        if (messageContentEl) {
            const senderId = data.user === socket.id ? 'You' : `User ${data.user.substring(0, 4)}`;
            let content;
            if (data.error) {
                content = `**(Public)** ${senderId} asked Ai, but there was an error: ${data.error}`;
            } else {
                content = `**(Public)** ${senderId} asked:\n\n> ${data.question}\n\n**🤖 Ai Replied:**\n\n${data.answer}`;
            }
            messageContentEl.innerHTML = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
            loaderMessage.classList.remove('sent');
            loaderMessage.classList.add('received');
            loaderMessage.removeAttribute('id');
        } else if (data.user !== socket.id) {
            const senderId = data.user === socket.id ? 'You' : `User ${data.user.substring(0, 4)}`;
            let content;
            if (data.error) {
                content = `**(Public)** ${senderId} asked Ai, but there was an error: ${data.error}`;
            } else {
                content = `**(Public)** ${senderId} asked:\n ${data.question}\n\n**🤖 Ai Replied:**\n\n${data.answer}`;
            }
            addMessage(content, false);
        }
    });

    // --- UI Event Handlers ---
    document.addEventListener('local-message-sent', (e) => {
        addMessage(e.detail.html, true, null, true);
    });

    if (disconnectBtn) {
        disconnectBtn.addEventListener("click", () => {
            if (socket.connected) socket.disconnect();
            else socket.connect();
        });
    }

    if (helpButtonMobile) {
        helpButtonMobile.addEventListener('click', (e) => {
            e.preventDefault();
            if (helpOverlayVisible) hideHelpOverlay();
            else showHelpOverlay();
        });
    }

    if (sendButton && inputField) {
        sendButton.addEventListener("click", handleMessageSend);
        inputField.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.ctrlKey) {
                e.preventDefault();
                handleMessageSend();
            }
        });
    }

    if (inputField && aiToggleContainer) {
        inputField.addEventListener('input', () => {
            const isAiCommand = inputField.value.trim().toLowerCase().startsWith(AI_ACTION_PREFIX);
            aiToggleContainer.style.display = isAiCommand ? 'flex' : 'none';
            
            // Update status hints
            updateStatusHints();
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

        if (messageContent.startsWith(AI_ACTION_PREFIX)) {
            const question = messageContent.substring(AI_ACTION_PREFIX.length).trim();
            if (question) {
                const isPublic = aiPublicToggle.checked;
                addMessage(messageContent, true);
                addMessage('<div class="loader"><div class="bar red"></div><div class="bar orange"></div><div class="bar yellow"></div><div class="bar green"></div><div class="bar blue"></div><div class="bar violet"></div></div>', false, 'ai-loader-message', true);
                socket.emit('ask-ai', { question, isPublic });
            }
        } else {
            const messageId = addMessage(messageContent, true); 
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
        aiToggleContainer.style.display = 'none';
        aiPublicToggle.checked = false;
        inputField.focus();
        
        // Reset status hints
        setTimeout(updateStatusHints, 100);
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

    function addMessage(content, isSentByMe, id = null, isHtml = false) {
        if (!chatMessages) return;

        const messageEl = document.createElement("div");
        messageEl.classList.add("message", isSentByMe ? "sent" : "received");
        
        // FIX: Apply ID to message element, not content element
        if (id) {
            messageEl.id = id;
        } else if (isSentByMe) {
            messageEl.id = `msg-${Date.now()}`;
        }

        const messageContentEl = document.createElement("div");
        messageContentEl.classList.add("message-content");

        if (isHtml) {
            messageContentEl.innerHTML = content;
        } else {
            if (typeof marked === 'function' && typeof DOMPurify !== 'undefined') {
                const formattedContent = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
                messageContentEl.innerHTML = formattedContent;
            } else {
                messageContentEl.textContent = content;
            }
        }

        messageEl.appendChild(messageContentEl);

        // FIX: Only add a status indicator to regular user messages.
        // This prevents the "sending" status on AI queries and GIFs.
        if (isSentByMe && !isHtml && !content.trim().startsWith(AI_ACTION_PREFIX)) {
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
    
    // Try early desktop focus (before assets fully load)
    if (!IS_MOBILE && inputField) {
        inputField.focus();
    }

    // Use addEventListener instead of assigning window.onload (prevents overwrite by other scripts)
    window.addEventListener('load', () => {
        addMessage("Welcome to World-Chat! Type '@ai your question' to talk to the AI.", false);
        
        if (IS_MOBILE) {
            inputField.placeholder = "Tap to start typing...";
            handleMobileViewport();

            const focusOnFirstTap = () => {
                inputField.focus();
                document.body.removeEventListener('click', focusOnFirstTap);
                document.body.removeEventListener('touchend', focusOnFirstTap);
            };
            document.body.addEventListener('click', focusOnFirstTap);
            document.body.addEventListener('touchend', focusOnFirstTap);
        } else {
            // Set desktop placeholder dynamically
            inputField.placeholder = `Type your message... (F1 or Fn+F1 for shortcuts)`;

            // Reinforce focus after full load & after a short delay (handles late scripts stealing focus)
            if (document.activeElement !== inputField) inputField.focus();
            setTimeout(() => {
                if (document.activeElement !== inputField) inputField.focus();
            }, 250);
        }

        setTimeout(() => {
            const hintMessage = IS_MOBILE ? 'Tap the ? for help' : `Press F1 (or Fn+F1) for keyboard shortcuts`;
            showTooltip(hintMessage, 4000);
        }, 3000);
    });
});

// --- Global Function for Sending Content ---
// We attach this to the window object so support.js can call it.
window.sendContent = function({ type, content, alt = '' }) {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;

    if (type === 'emoji') {
        messageInput.value += content;
        messageInput.focus();
    } else if (type === 'gif') {
        const socket = window.chatSocket; // Access socket from global scope
        if (socket && socket.connected) {
            const gifHtml = `<img src="${content}" alt="${alt}" class="gif-message">`;
            socket.emit('user-message', gifHtml, () => {
                // The appendMessage function is defined inside DOMContentLoaded,
                // so we need to call it from there. We can emit a local event.
                document.dispatchEvent(new CustomEvent('local-message-sent', { detail: { html: gifHtml } }));
            });
        }
    }
};

