/**
 * @file client.js
 * @description Core client-side application logic for World-Chat.
 * This script manages the WebSocket connection, handles all user interactions,
 * renders chat messages, and orchestrates the overall user interface.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // --- CONSTANTS & CONFIGURATION ---
    // ===================================================================================

    const AI_ACTION_PREFIX = '@ai';
    const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    const IS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    // --- Centralized Keyboard Shortcut Definitions ---
    // Storing shortcuts by platform for better organization and maintainability.
    const SHORTCUTS_CONFIG = {
        common: {
            HELP: { key: 'f1', display: 'F1' },
            ENTER: { key: 'enter', display: 'Enter' },
            ESC: { key: 'escape', display: 'Esc' }
        },
        mac: {
            AI_TRIGGER: { key: 'alt+a', display: '⌥ + A' }, // OVERRIDE: Use Option+A for AI Trigger
            AI_TOGGLE: { key: 'alt+/', display: '⌥ + /' }, // OVERRIDE: Use Option+/ for AI Toggle
            EMOJI_PICKER: { key: 'meta+e', display: '⌘ + E' },
            GIF_PICKER: { key: 'meta+g', display: '⌘ + G' },
            SEND_MESSAGE: { key: 'meta+enter', display: '⌘ + Enter' },
            FOCUS_INPUT: { key: 'meta+i', display: '⌘ + I' },
        },
        windows: {
            AI_TRIGGER: { key: 'alt+a', display: 'Alt + A' },
            AI_TOGGLE: { key: 'alt+/', display: 'Alt + /' }, // Changed from Ctrl+/
            EMOJI_PICKER: { key: 'ctrl+e', display: 'Ctrl + E' },
            GIF_PICKER: { key: 'ctrl+g', display: 'Ctrl + G' },
            SEND_MESSAGE: { key: 'ctrl+enter', display: 'Ctrl + Enter' },
            FOCUS_INPUT: { key: 'ctrl+i', display: 'Ctrl + I' },
        }
    };

    // Merge the common and platform-specific configs to create the final, active shortcuts object.
    const platformShortcuts = IS_MAC ? SHORTCUTS_CONFIG.mac : SHORTCUTS_CONFIG.windows;
    const ACTIVE_SHORTCUTS = { ...SHORTCUTS_CONFIG.common, ...platformShortcuts };


    // ===================================================================================
    // --- DOM ELEMENT SELECTION ---
    // ===================================================================================

    const socket = io();
    window.chatSocket = socket; // Expose socket globally for support.js

    const chatMessages = document.querySelector(".chat-messages");
    const inputField = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const disconnectBtn = document.getElementById("disconnect-button");
    const connectionStatus = document.querySelector(".connection-status");
    const userCount = document.querySelector(".user-count");
    const aiPublicToggle = document.getElementById("ai-public-toggle");
    const aiToggleContainer = document.querySelector(".ai-toggle-container");
    const helpButtonMobile = document.getElementById("help-button-mobile");
    const emojiButton = document.getElementById("emoji-button");
    const gifButton = document.getElementById("gif-button");

    // ===================================================================================
    // --- STATE MANAGEMENT ---
    // ===================================================================================

    // --- NEW: User identity state ---
    let currentUser = { id: null, name: 'Anonymous' };

    let helpOverlayVisible = false;
    // --- NEW: Centralized Notification State ---
    let persistentStatus = { text: 'Welcome!', statusClass: 'connecting' };
    let notificationTimeout;

    // --- NEW: Load user preferences from localStorage ---
    const userPreferences = {
        get: (key, defaultValue) => {
            try {
                const value = localStorage.getItem(key);
                return value === null ? defaultValue : JSON.parse(value);
            } catch {
                return defaultValue;
            }
        },
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn("Could not write to localStorage.", e);
            }
        }
    };


    // ===================================================================================
    // --- CORE FUNCTIONS & UI LOGIC ---
    // ===================================================================================

    /**
     * @description Main initialization function.
     * Sets up all event listeners and establishes the socket connection.
     * This function is now called only after a user identity is confirmed.
     */
    function initializeChat() {
        // --- NEW: Send user data on connection ---
        socket.auth = { user: currentUser };
        socket.connect();

        setupDOMListeners();
        let hintText = IS_MOBILE ? 'Tap the ? for help' : `F1 (or Fn+F1) for shortcuts`;
        showNotification(` Welcome, ${currentUser.name}! ${hintText}`, { duration: 4000 });
        if (IS_MOBILE) {
            document.body.classList.add('is-mobile');
        }
        inputField.focus();
    }

    /**
     * @description Establishes the connection to the Socket.IO server
     * and registers all event handlers for the socket.
     */
    function connectSocket() {
        socket.on("connect", () => {
            updateConnectionStatus("Connected", "connected");
            console.log(`Connected to server with ID: ${socket.id}`);
        });
        socket.on("disconnect", () => { updateConnectionStatus("Disconnected", "disconnected"); updateUserCount(0); });
        socket.on("connect_error", (err) => updateConnectionStatus(`Connection failed: ${err.message}`, 'disconnected'));
        
        // MODIFIED: Handle full message object
        socket.on("backend-user-message", (message) => {
            // Don't display our own messages that we get back from the server
            if (message.user.id === currentUser.id) return;
            addMessage(message);
        });

        socket.on("total-user", (count) => updateUserCount(count));

        socket.on('ai-response', (data) => {
            const loader = document.querySelector('.ai-loader-message');
            if (loader) loader.remove();

            if (data.answer) {
                addMessage({
                    user: { name: 'Gemini AI' },
                    text: data.answer,
                    isHtml: false
                });
            } else if (data.error) {
                addMessage({
                    user: { name: 'System' },
                    text: `**AI Error:** ${data.error}`,
                    isHtml: false
                });
            }
        });

        socket.on('public-ai-message', (data) => {
            const messageText = `**AI Response to ${data.user.name}:**\n\n> "${data.question}"\n\n${data.answer || data.error}`;
            addMessage({
                user: { name: 'Public AI' },
                text: messageText,
                isHtml: false
            });
        });
    }

    /**
     * Sends a message or AI command to the server via WebSocket.
     */
    function handleMessageSend() {
        if (!inputField || !socket || !socket.connected) {
            addMessage("Lost you mate! Check your Internet connection OwO", false);
            return;
        }
        const messageContent = inputField.value.trim();
        if (!messageContent) return;

        // --- AI Message Handling ---
        if (messageContent.startsWith(AI_ACTION_PREFIX)) {
            const question = messageContent.substring(AI_ACTION_PREFIX.length).trim();
            if (question) {
                const isPublic = aiPublicToggle.checked;
                // Display the user's query locally
                addMessage({ user: currentUser, text: messageContent });
                
                // Display loader
                 const loaderHtml = `
                    <div class="loader">
                        <span class="bar red"></span><span class="bar orange"></span><span class="bar yellow"></span>
                        <span class="bar green"></span><span class="bar blue"></span><span class="bar violet"></span>
                    </div>`;
                addMessage({
                    user: { name: 'Gemini AI' }, // Loader is attributed to the AI
                    text: loaderHtml,
                    isHtml: true,
                    isLoader: true
                });

                socket.emit('ask-ai', { question, isPublic });
            }
        // --- Regular Message Handling ---
        } else {
            const messagePayload = {
                id: `${socket.id}-${Date.now()}`,
                user: currentUser,
                text: messageContent,
                timestamp: new Date().toISOString()
            };
            // Display the message immediately on the sender's screen
            addMessage(messagePayload);
            // Emit the message to the server
            socket.emit('user-message', messagePayload);
        }

        // Reset input field and UI state
        inputField.value = "";
        inputField.style.height = 'auto'; // FIX: Reset textarea height after sending
        aiToggleContainer.style.display = 'none';
        // Do not reset the toggle's checked state, let it persist
        // aiPublicToggle.checked = false; 
        inputField.focus();
        setTimeout(updateStatusHints, 100);
    }

    /**
     * Creates and appends a new message to the chat window.
     * @param {object} message - The message object.
     * @param {object} message.user - The user who sent the message {id, name}.
     * @param {string} message.text - The message content (text or HTML).
     * @param {string} [message.timestamp] - The ISO timestamp.
     * @param {boolean} [message.isHtml=false] - True if content is HTML.
     * @param {boolean} [message.isLoader=false] - True if this is a loader message.
     */
    function addMessage(message) {
        if (!chatMessages) return;

        const { user, text, timestamp = new Date().toISOString(), isHtml = false, isLoader = false } = message;
        const isSentByMe = user.id === currentUser.id;

        const messageEl = document.createElement("div");
        messageEl.classList.add("message", isSentByMe ? "sent" : "received");
        if (isLoader) messageEl.classList.add('ai-loader-message');
        
        messageEl.dataset.timestamp = timestamp;
        
        // --- Create Sender Name Element (for received messages) ---
        if (!isSentByMe) {
            const senderEl = document.createElement('div');
            senderEl.classList.add('message-sender');
            senderEl.textContent = user.name;
            messageEl.appendChild(senderEl);
        }

        const bubbleEl = document.createElement("div");
        bubbleEl.classList.add("message-bubble");

        const messageContentEl = document.createElement("div");
        messageContentEl.classList.add("message-content");

        if (isHtml) {
            messageContentEl.innerHTML = DOMPurify.sanitize(text, { USE_PROFILES: { html: true } });
        } else {
            const formattedContent = DOMPurify.sanitize(marked.parse(text), { USE_PROFILES: { html: true } });
            messageContentEl.innerHTML = formattedContent;
        }

        const metaEl = document.createElement('div');
        metaEl.classList.add('message-meta');

        const timestampEl = document.createElement('span');
        timestampEl.classList.add('message-timestamp');
        timestampEl.textContent = formatTimestamp(timestamp);
        metaEl.appendChild(timestampEl);

        bubbleEl.appendChild(messageContentEl);
        bubbleEl.appendChild(metaEl);
        messageEl.appendChild(bubbleEl);

        chatMessages.appendChild(messageEl);
        scrollToBottom();
    }

    /**
     * Scrolls the chat message container to the bottom.
     */
    function scrollToBottom() {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    /**
     * --- NEW: Formats a timestamp for display in messages.
     * Shows time for recent messages, and date + time for older messages.
     * @param {string} isoString - The ISO 8601 timestamp string.
     * @returns {string} The formatted date/time string.
     */
    function formatTimestamp(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffHours = (now - date) / (1000 * 60 * 60);

        const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

        if (diffHours < 12) {
            // Less than 12 hours ago: Show only time (e.g., "10:30 AM")
            return date.toLocaleTimeString('en-US', timeOptions);
        } else {
            // 12+ hours ago: Show date and time (e.g., "Sep 7, 10:30 AM")
            const dateOptions = { month: 'short', day: 'numeric' };
            return `${date.toLocaleDateString('en-US', dateOptions)}, ${date.toLocaleTimeString('en-US', timeOptions)}`;
        }
    }

    /**
     * --- REFACTORED: Central Notification Manager ---
     * Displays a message in the global status bar with animations.
     * @param {string} text - The message to display.
     * @param {object} [options] - Configuration options.
     * @param {number|null} [options.duration=null] - If set, message is temporary. Restores persistent status after duration (in ms).
     * @param {string|null} [options.statusClass=null] - CSS class for color coding (e.g., 'connected', 'disconnected').
     * @param {boolean} [options.isPersistent=false] - If true, this message becomes the new default.
     */
    function showNotification(text, options = {}) {
        const { duration = null, statusClass = null, isPersistent = false } = options;

        if (!connectionStatus) return;

        // The actual text element inside the status bar
        let textWrapper = connectionStatus.querySelector('.status-text-wrapper');
        if (!textWrapper) {
            connectionStatus.innerHTML = '<span class="status-text-wrapper"></span>';
            textWrapper = connectionStatus.querySelector('.status-text-wrapper');
        }

        // Clear any pending temporary message timeout
        clearTimeout(notificationTimeout);

        const updateText = (newText, newStatusClass) => {
            textWrapper.classList.add('hidden');
            setTimeout(() => {
                textWrapper.textContent = newText;
                // Update status class for color
                connectionStatus.className = 'connection-status'; // Reset
                if (newStatusClass) connectionStatus.classList.add(newStatusClass);
                textWrapper.classList.remove('hidden');
            }, 200); // This delay should match the CSS transition duration
        };

        updateText(text, statusClass || persistentStatus.statusClass);

        if (isPersistent) {
            persistentStatus.text = text;
            if (statusClass) persistentStatus.statusClass = statusClass;
        } else if (duration) {
            notificationTimeout = setTimeout(() => {
                showNotification(persistentStatus.text, { statusClass: persistentStatus.statusClass });
            }, duration);
        }
    }


    /**
     * --- REFACTORED: Updates the connection status display via the notification manager.
     * @param {string} text - The text to display.
     * @param {string} status - The status class ('connected', 'disconnected', 'connecting').
     */
    function updateConnectionStatus(text, status) {
        showNotification(text, { statusClass: status, isPersistent: true });
        if (disconnectBtn) {
            disconnectBtn.classList.toggle('connected', status === 'connected');
        }
    }

    /**
     * Updates the online user count display.
     * @param {number} count - The number of users online.
     */
    function updateUserCount(count) {
        if (userCount) {
            userCount.textContent = count;
        }
    }

    /**
     * --- REFACTORED & OPTIMIZED: Updates the contextual hint via the notification manager.
     */
    function updateStatusHints() {
        let hintText = IS_MOBILE ? 'Tap the ? for help' : `F1 (or Fn+F1) for shortcuts`;
        if (inputField.value.trim().startsWith(AI_ACTION_PREFIX)) {
            hintText = `${ACTIVE_SHORTCUTS.AI_TOGGLE.display} to toggle AI mode`;
        }
        
        // --- PERFORMANCE FIX ---
        // Only update the notification bar if the hint text has actually changed.
        // This prevents the UI from re-rendering on every single keystroke.
        if (hintText !== persistentStatus.text) {
            showNotification(hintText, { isPersistent: true });
        }
    }

    /**
     * Displays a temporary tooltip near the chat input.
     * @param {string} message - The message to display in the tooltip.
     * @param {number} [duration=2000] - How long the tooltip should be visible in ms.
     */
    function showTooltip(message, duration = 2000) {
        const existing = document.querySelector('.shortcut-tooltip');
        if (existing) existing.remove();

        const tooltip = document.createElement('div');
        tooltip.className = 'shortcut-tooltip';
        tooltip.textContent = message;
        document.body.appendChild(tooltip);

        const inputRect = inputField.getBoundingClientRect();
        tooltip.style.left = inputRect.left + 'px';
        tooltip.style.top = (inputRect.top - 40) + 'px';

        requestAnimationFrame(() => tooltip.classList.add('visible'));
        setTimeout(() => {
            tooltip.classList.remove('visible');
            setTimeout(() => tooltip.remove(), 300);
        }, duration);
    }

    // ===================================================================================
    // --- KEYBOARD SHORTCUT SYSTEM ---
    // ===================================================================================

    /**
     * Dynamically creates and injects the help overlay into the DOM.
     * The content is tailored based on the user's operating system (Mac/Windows).
     * @returns {HTMLElement} The created overlay element.
     */
    function createHelpOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'shortcut-help-overlay';

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

        // Dynamically generate the help content from the active shortcuts configuration.
        const desktopHelpContent = `
            <div class="help-header"><h3>⌨️ Keyboard Shortcuts</h3><button class="help-close" aria-label="Close help">✕</button></div>
            <div class="help-grid">
                ${Object.entries(ACTIVE_SHORTCUTS).map(([name, { display }]) => `
                    <div class="shortcut-item" data-shortcut="${name}">
                        <span class="shortcut-key">${display}</span>
                        <span class="shortcut-desc">${{
                            AI_TRIGGER: 'Toggle AI mode',
                            AI_TOGGLE: 'Toggle Public/Private AI mode',
                            EMOJI_PICKER: 'Open emoji picker',
                            GIF_PICKER: 'Open GIF picker',
                            SEND_MESSAGE: 'Send message',
                            FOCUS_INPUT: 'Focus message input',
                            HELP: 'Show/hide help (may require Fn key)',
                            ENTER: 'Send message (when input focused)',
                            ESC: 'Close pickers/dialogs'
                        }[name] || ''}</span>
                    </div>
                `).join('')}
            </div>
            <div class="help-footer"><small>💡 Tip: Shortcuts work from anywhere in the chat</small></div>
        `;

        overlay.innerHTML = `<div class="help-content">${IS_MOBILE ? mobileHelpContent : desktopHelpContent}</div>`;
        document.body.appendChild(overlay);

        // --- Event Listeners for the Overlay ---
        overlay.querySelector('.help-close').addEventListener('click', hideHelpOverlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) hideHelpOverlay(); });

        // Make the help grid interactive by triggering actions on click.
        const helpGrid = overlay.querySelector('.help-grid');
        if (helpGrid) {
            helpGrid.addEventListener('click', (e) => {
                const item = e.target.closest('.shortcut-item');
                if (!item) return;

                const action = item.dataset.shortcut;
                // This avoids duplicating logic and keeps behavior consistent.
                const keyMap = {
                    AI_TRIGGER: { key: 'a', altKey: true },
                    AI_TOGGLE: { key: '/', altKey: true }, // CORRECTED: Use altKey for both platforms
                    EMOJI_PICKER: { key: 'e', [IS_MAC ? 'metaKey' : 'ctrlKey']: true },
                    GIF_PICKER: { key: 'g', [IS_MAC ? 'metaKey' : 'ctrlKey']: true },
                    SEND_MESSAGE: { key: 'Enter', [IS_MAC ? 'metaKey' : 'ctrlKey']: true },
                    FOCUS_INPUT: { key: 'i', [IS_MAC ? 'metaKey' : 'ctrlKey']: true },
                    HELP: { key: 'F1' },
                    ENTER: { key: 'Enter' },
                    ESC: { key: 'Escape' }
                };
                if (keyMap[action]) {
                    document.dispatchEvent(new KeyboardEvent('keydown', { ...keyMap[action], bubbles: true }));
                }
                
                // --- FIX: Delay hiding the overlay to allow the dispatched event to be processed. ---
                setTimeout(hideHelpOverlay, 50);
            });
        }
        return overlay;
    }

    /** Shows the help overlay. Creates it if it doesn't exist. */
    function showHelpOverlay() {
        if (!document.getElementById('shortcut-help-overlay')) createHelpOverlay();
        document.getElementById('shortcut-help-overlay').classList.add('visible');
        helpOverlayVisible = true;
    }

    /** Hides the help overlay. */
    function hideHelpOverlay() {
        const overlay = document.getElementById('shortcut-help-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            helpOverlayVisible = false;
        }
    }

    /**
     * Parses a shortcut string (e.g., "ctrl+e") into an object.
     * @param {string} shortcut - The shortcut string.
     * @returns {{ctrl: boolean, alt: boolean, shift: boolean, meta: boolean, key: string}}
     */
    function parseShortcut(shortcut) {
        const parts = shortcut.toLowerCase().split('+');
        const result = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
        parts.forEach(part => {
            if (part === 'ctrl') result.ctrl = true;
            else if (part === 'alt') result.alt = true;
            else if (part === 'shift') result.shift = true;
            else if (part === 'meta') result.meta = true;
            else result.key = part;
        });
        return result;
    }

    /**
     * Checks if a keyboard event matches a defined shortcut string.
     * @param {KeyboardEvent} event - The keyboard event.
     * @param {string} shortcut - The shortcut string to check against.
     * @returns {boolean}
     */
    function matchesShortcut(event, shortcut) {
        const parsed = parseShortcut(shortcut);
        
        // Map for special keys where the shortcut string doesn't match the `event.code` pattern.
        const codeMap = {
            '/': 'Slash',
            'enter': 'Enter',
            'escape': 'Escape'
        };

        let expectedCode;
        if (codeMap[parsed.key]) {
            expectedCode = codeMap[parsed.key];
        } else if (parsed.key.length === 1) {
            // For single letters like 'a', 'b', etc.
            expectedCode = `Key${parsed.key.toUpperCase()}`;
        } else {
            // For keys like 'f1', 'f2', etc.
            expectedCode = parsed.key;
        }

        const codeMatches = event.code.toLowerCase() === expectedCode.toLowerCase();

        return event.ctrlKey === parsed.ctrl &&
               event.altKey === parsed.alt &&
               event.shiftKey === parsed.shift &&
               event.metaKey === parsed.meta &&
               codeMatches;
    }

    // ===================================================================================
    // --- GLOBAL EVENT HANDLERS ---
    // ===================================================================================

    /**
     * Global keyboard event handler.
     * TRICKY IMPLEMENTATION: This listener uses the 'capture' phase (third argument is true).
     * This is critical for ensuring shortcuts work even when focus is inside an
     * encapsulated element like the emoji picker's search bar (which is in a Shadow DOM).
     * The capture phase runs *before* the event reaches its target.
     */
    document.addEventListener('keydown', (e) => {
        if (IS_MOBILE) return;

        // When typing in an input, only allow shortcuts that use a modifier key,
        // or specific single keys like Escape, Enter, and F1.
        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const allowedKeys = ['escape', 'enter', 'f1'];
            if (!allowedKeys.includes(e.key.toLowerCase())) {
                return;
            }
        }

        // --- Shortcut Action Mapping ---
        if (e.key === 'Escape') {
            e.preventDefault();
            if (helpOverlayVisible) hideHelpOverlay();
            else document.dispatchEvent(new CustomEvent('close-all-pickers'));
            return;
        }
        if (matchesShortcut(e, ACTIVE_SHORTCUTS.HELP.key)) {
            e.preventDefault();
            if (helpOverlayVisible) hideHelpOverlay(); else showHelpOverlay();
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.AI_TOGGLE.key)) {
            e.preventDefault();
            if (aiToggleContainer.style.display === 'flex') {
                aiPublicToggle.checked = !aiPublicToggle.checked;
                userPreferences.set('aiPublic', aiPublicToggle.checked); // Save preference
                showNotification('AI mode: ' + (aiPublicToggle.checked ? 'Public' : 'Private'), { duration: 2000 });
            }
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.AI_TRIGGER.key)) {
            e.preventDefault();
            if (inputField.value.trim().startsWith(AI_ACTION_PREFIX)) {
                inputField.value = inputField.value.substring(AI_ACTION_PREFIX.length).trimStart();
                showNotification('AI mode deactivated', { duration: 2000 });
            } else {
                inputField.value = AI_ACTION_PREFIX + ' ' + inputField.value;
                showNotification('AI mode activated', { duration: 2000 });
            }
            inputField.focus();
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.EMOJI_PICKER.key)) {
            e.preventDefault();
            document.getElementById('emoji-button')?.click();
            showNotification('Emoji picker opened', { duration: 2000 });
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.GIF_PICKER.key)) {
            e.preventDefault();
            document.getElementById('gif-button')?.click();
            showNotification('GIF picker opened', { duration: 2000 });
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.SEND_MESSAGE.key)) {
            e.preventDefault();
            if (inputField.value.trim()) {
                handleMessageSend();
                showNotification('Message sent', { duration: 2000 });
            }
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.FOCUS_INPUT.key)) {
            e.preventDefault();
            inputField.focus();
            showNotification('Input focused', { duration: 2000 });
        }
    }, true);

    // Listen for local event to display sent GIFs/emojis immediately.
    document.addEventListener('local-message-sent', (e) => {
        addMessage(e.detail.message);
    });

    // Standard UI event listeners
    if (disconnectBtn) disconnectBtn.addEventListener("click", () => socket.connected ? socket.disconnect() : socket.connect());
    if (helpButtonMobile) helpButtonMobile.addEventListener('click', (e) => { e.preventDefault(); if (helpOverlayVisible) hideHelpOverlay(); else showHelpOverlay(); });
    
    // --- REFACTORED: Input field event handling ---
    if (sendButton && inputField) {
        sendButton.addEventListener("click", handleMessageSend);

        // Auto-grow textarea on input
        inputField.addEventListener('input', () => {
            inputField.style.height = 'auto'; // Reset height to calculate new scrollHeight
            inputField.style.height = `${inputField.scrollHeight}px`; // Set height to content
        });

        // Handle Enter vs Shift+Enter for sending messages vs creating new lines
        inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); // Prevent default action (new line)
                handleMessageSend();
            }
            // If Shift+Enter is pressed, the default action (new line) is allowed to happen.
        });
    }

    if (inputField && aiToggleContainer) {
        inputField.addEventListener('input', () => {
            const isAiCommand = inputField.value.trim().toLowerCase().startsWith(AI_ACTION_PREFIX);
            aiToggleContainer.style.display = isAiCommand ? 'flex' : 'none';
            updateStatusHints();
        });

        // --- NEW: Save AI toggle state on change ---
        aiPublicToggle.addEventListener('change', () => {
            userPreferences.set('aiPublic', aiPublicToggle.checked);
        });
    }

    // --- NEW: Hover-based notifications ---
    const setupHoverNotifications = () => {
        const elements = [
            { el: emojiButton, text: 'Open Emoji Picker' },
            { el: gifButton, text: 'Open GIF Picker' },
            { el: sendButton, text: 'Send Message' },
            { el: disconnectBtn, text: 'Disconnect / Reconnect' },
            { el: helpButtonMobile, text: 'Show Help & Shortcuts' }
        ];

        elements.forEach(({ el, text }) => {
            if (el) {
                el.addEventListener('mouseenter', () => showNotification(text));
                el.addEventListener('mouseleave', () => showNotification(persistentStatus.text, { statusClass: persistentStatus.statusClass }));
            }
        });
    };

    // ===================================================================================
    // --- SOCKET.IO EVENT HANDLERS ---
    // ===================================================================================

    socket.on("connect", () => {
        updateConnectionStatus("Connecting...", "connecting");
        setTimeout(() => {
            if (socket.connected) {
                updateConnectionStatus("Connected", "connected");
                // The hint will be restored by the persistent status system
            }
        }, 1300);
    });
    socket.on("disconnect", () => { updateConnectionStatus("Disconnected", "disconnected"); updateUserCount(0); });
    socket.on("connect_error", (err) => updateConnectionStatus(`Connection failed`, 'disconnected'));
    socket.on("backend-user-message", (message) => {
        // Don't display our own messages that we get back from the server
        if (message.user.id === currentUser.id) return;
        addMessage(message);
    });
    socket.on("total-user", (count) => updateUserCount(count));

    // --- FIXED: Implemented AI response handlers ---
    socket.on('ai-response', (data) => {
        const loader = document.querySelector('.ai-loader-message');
        if (loader) loader.remove();

        if (data.answer) {
            addMessage({
                user: { name: 'Gemini AI' },
                text: data.answer,
                isHtml: false
            });
        } else if (data.error) {
            addMessage({
                user: { name: 'System' },
                text: `**AI Error:** ${data.error}`,
                isHtml: false
            });
        }
    });

    socket.on('public-ai-message', (data) => {
        const messageText = `**AI Response to ${data.user.name}:**\n\n> "${data.question}"\n\n${data.answer || data.error}`;
        addMessage({
            user: { name: 'Public AI' },
            text: messageText,
            isHtml: false
        });
    });


    // ===================================================================================
    // --- INITIALIZATION ---
    // ===================================================================================

    /**
     * Sets up all the DOM event listeners for the application.
     * This is called once the user identity is ready.
     */
    function setupDOMListeners() {
        // Listen for local event to display sent GIFs/emojis immediately.
        document.addEventListener('local-message-sent', (e) => {
            addMessage(e.detail.message);
        });

        // Standard UI event listeners
        if (disconnectBtn) disconnectBtn.addEventListener("click", () => socket.connected ? socket.disconnect() : socket.connect());
        if (helpButtonMobile) helpButtonMobile.addEventListener('click', (e) => { e.preventDefault(); if (helpOverlayVisible) hideHelpOverlay(); else showHelpOverlay(); });
        
        // Input field event handling
        if (sendButton && inputField) {
            sendButton.addEventListener("click", handleMessageSend);

            inputField.addEventListener('input', () => {
                inputField.style.height = 'auto';
                inputField.style.height = `${inputField.scrollHeight}px`;
            });

            inputField.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleMessageSend();
                }
            });
        }

        if (inputField && aiToggleContainer) {
            inputField.addEventListener('input', () => {
                const isAiCommand = inputField.value.trim().toLowerCase().startsWith(AI_ACTION_PREFIX);
                aiToggleContainer.style.display = isAiCommand ? 'flex' : 'none';
                updateStatusHints();
            });

            aiPublicToggle.addEventListener('change', () => {
                userPreferences.set('aiPublic', aiPublicToggle.checked);
            });
        }
        setupHoverNotifications();
    }

    // --- NEW: Wait for user identity before initializing the chat ---
    document.addEventListener('userReady', (e) => {
        currentUser = e.detail;
        // Now that we have a user, we can initialize the main application.
        initializeChat();
    });

    // Use window.addEventListener('load', ...) for reliability
    window.addEventListener('load', () => {
        // --- NEW: Apply saved user preferences on load ---
        aiPublicToggle.checked = userPreferences.get('aiPublic', false);

        showNotification("Welcome to World-Chat! Type '@ai your question' to talk to the AI.", { duration: 4000 });
        
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
            inputField.placeholder = `Type your message...`; // Placeholder is cleaner now
            // Reinforce focus after load to counter any scripts that might steal it.
            if (document.activeElement !== inputField) inputField.focus();
            setTimeout(() => { if (document.activeElement !== inputField) inputField.focus(); }, 250);
        }

        // Setup hover listeners and initial hint
        setupHoverNotifications();
        updateStatusHints();
    });
});

/**
 * @description Global function to handle sending rich content (GIFs, Emojis).
 * Exposed on the window object to be accessible from support.js.
 * @param {{type: 'gif'|'emoji', content: string, alt?: string}} data
 */
window.sendContent = function({ type, content, alt = '' }) {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;

    if (type === 'emoji') {
        messageInput.value += content;
        messageInput.focus();
        // Trigger input event to resize textarea if needed
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (type === 'gif') {
        const socket = window.chatSocket;
        if (socket && socket.connected) {
            const gifHtml = `<img src="${content}" alt="${alt || 'GIF'}" class="gif-message">`;
            
            // --- MODIFIED: Use the global currentUser object ---
            const messagePayload = {
                id: `${socket.id}-${Date.now()}`,
                user: currentUser, // Use the established user identity
                text: gifHtml,
                timestamp: new Date().toISOString(),
                isHtml: true
            };
            
            // Dispatch a local event to render the sent GIF immediately.
            document.dispatchEvent(new CustomEvent('local-message-sent', { detail: { message: messagePayload } }));
            
            // Emit the full payload to the server
            socket.emit('user-message', messagePayload);
        }
    }
};

