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

    // ===================================================================================
    // --- STATE MANAGEMENT ---
    // ===================================================================================

    let helpOverlayVisible = false;

    // ===================================================================================
    // --- CORE FUNCTIONS & UI LOGIC ---
    // ===================================================================================

    /**
     * Handles mobile viewport resizing, especially for the on-screen keyboard.
     * Sets a CSS custom property `--app-height` to the visible viewport height.
     * This allows the CSS to create a layout that adapts to the keyboard.
     */
    function handleMobileViewport() {
        if (!IS_MOBILE || !window.visualViewport) return;

        const setAppHeight = () => {
            document.documentElement.style.setProperty('--app-height', `${window.visualViewport.height}px`);
        };

        window.visualViewport.addEventListener('resize', setAppHeight);
        setAppHeight(); // Initial call
    }

    /**
     * Sends a message or AI command to the server via WebSocket.
     */
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
                addMessage(messageContent, true); // Display the user's query locally
                addMessage('<div class="loader"><div class="bar red"></div><div class="bar orange"></div><div class="bar yellow"></div><div class="bar green"></div><div class="bar blue"></div><div class="bar violet"></div></div>', false, 'ai-loader-message', true);
                socket.emit('ask-ai', { question, isPublic });
            }
        } else {
            const messageId = addMessage(messageContent, true);
            socket.emit("user-message", messageContent, () => {
                // This callback runs when the server acknowledges the message.
                const messageEl = document.getElementById(messageId);
                if (messageEl) {
                    const statusIndicator = messageEl.querySelector('.message-status');
                    if (statusIndicator) statusIndicator.textContent = 'sent';
                }
            });
        }

        // Reset input field and UI state
        inputField.value = "";
        aiToggleContainer.style.display = 'none';
        aiPublicToggle.checked = false;
        inputField.focus();
        setTimeout(updateStatusHints, 100);
    }

    /**
     * Creates and appends a new message to the chat window.
     * @param {string} content - The message content (text or HTML).
     * @param {boolean} isSentByMe - True if the message is from the current user.
     * @param {string|null} [id=null] - An optional ID to assign to the message element.
     * @param {boolean} [isHtml=false] - True if the content is HTML and should not be parsed as Markdown.
     * @returns {string} The ID of the created message element.
     */
    function addMessage(content, isSentByMe, id = null, isHtml = false) {
        if (!chatMessages) return;

        const messageEl = document.createElement("div");
        messageEl.classList.add("message", isSentByMe ? "sent" : "received");
        
        if (id) {
            messageEl.id = id;
        } else if (isSentByMe) {
            messageEl.id = `msg-${Date.now()}`;
        }

        const messageContentEl = document.createElement("div");
        messageContentEl.classList.add("message-content");

        if (isHtml) {
            // Sanitize HTML content to prevent XSS attacks before rendering.
            messageContentEl.innerHTML = DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
        } else {
            // For plain text, parse as Markdown and then sanitize.
            const formattedContent = DOMPurify.sanitize(marked.parse(content), { USE_PROFILES: { html: true } });
            messageContentEl.innerHTML = formattedContent;
        }

        messageEl.appendChild(messageContentEl);

        // Add a "sending..." status indicator only to user-sent text messages.
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

    /**
     * Scrolls the chat message container to the bottom.
     */
    function scrollToBottom() {
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    /**
     * Updates the connection status display in the status bar.
     * @param {string} text - The text to display.
     * @param {string} status - The status class ('connected', 'disconnected', 'connecting').
     */
    function updateConnectionStatus(text, status) {
        if (!connectionStatus) return;
        connectionStatus.textContent = text;
        connectionStatus.className = 'connection-status'; // Reset classes
        connectionStatus.classList.add(status);
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
     * Updates the contextual hint in the status bar (e.g., "F1 for shortcuts").
     */
    function updateStatusHints() {
        const hints = [];
        if (inputField.value.trim().startsWith(AI_ACTION_PREFIX)) {
            // CORRECTED: Use the dynamic display value from the active shortcuts config
            hints.push(`${ACTIVE_SHORTCUTS.AI_TOGGLE.display} to toggle AI mode`);
        }
        
        if (hints.length === 0) {
            hints.push(IS_MOBILE ? 'Tap the ? for help' : `F1 (or Fn+F1) for shortcuts`);
        }

        if (socket.connected && connectionStatus.textContent === 'Connected') {
            connectionStatus.textContent = hints[0];
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
                
                hideHelpOverlay();
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
                showTooltip('AI mode: ' + (aiPublicToggle.checked ? 'Public' : 'Private'));
            }
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.AI_TRIGGER.key)) {
            e.preventDefault();
            if (inputField.value.trim().startsWith(AI_ACTION_PREFIX)) {
                inputField.value = inputField.value.substring(AI_ACTION_PREFIX.length).trimStart();
                showTooltip('AI mode deactivated');
            } else {
                inputField.value = AI_ACTION_PREFIX + ' ' + inputField.value;
                showTooltip('AI mode activated');
            }
            inputField.focus();
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.EMOJI_PICKER.key)) {
            e.preventDefault();
            document.getElementById('emoji-button')?.click();
            showTooltip('Emoji picker opened');
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.GIF_PICKER.key)) {
            e.preventDefault();
            document.getElementById('gif-button')?.click();
            showTooltip('GIF picker opened');
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.SEND_MESSAGE.key)) {
            e.preventDefault();
            if (inputField.value.trim()) {
                handleMessageSend();
                showTooltip('Message sent');
            }
        } else if (matchesShortcut(e, ACTIVE_SHORTCUTS.FOCUS_INPUT.key)) {
            e.preventDefault();
            inputField.focus();
            showTooltip('Input focused');
        }
    }, true);

    // Listen for local event to display sent GIFs/emojis immediately.
    document.addEventListener('local-message-sent', (e) => {
        addMessage(e.detail.html, true, null, true);
    });

    // Standard UI event listeners
    if (disconnectBtn) disconnectBtn.addEventListener("click", () => socket.connected ? socket.disconnect() : socket.connect());
    if (helpButtonMobile) helpButtonMobile.addEventListener('click', (e) => { e.preventDefault(); if (helpOverlayVisible) hideHelpOverlay(); else showHelpOverlay(); });
    if (sendButton && inputField) {
        sendButton.addEventListener("click", handleMessageSend);
        inputField.addEventListener("keypress", (e) => { if (e.key === "Enter" && !e.ctrlKey) { e.preventDefault(); handleMessageSend(); } });
    }
    if (inputField && aiToggleContainer) {
        inputField.addEventListener('input', () => {
            const isAiCommand = inputField.value.trim().toLowerCase().startsWith(AI_ACTION_PREFIX);
            aiToggleContainer.style.display = isAiCommand ? 'flex' : 'none';
            updateStatusHints();
        });
    }

    // ===================================================================================
    // --- SOCKET.IO EVENT HANDLERS ---
    // ===================================================================================

    socket.on("connect", () => {
        updateConnectionStatus("Connecting...", "connecting");
        setTimeout(() => {
            if (socket.connected) {
                updateConnectionStatus("Connected", "connected");
                setTimeout(updateStatusHints, 2000);
            }
        }, 1300);
    });
    socket.on("disconnect", () => { updateConnectionStatus("Disconnected", "disconnected"); updateUserCount(0); });
    socket.on("connect_error", (err) => updateConnectionStatus(`Connection failed: ${err.message}`, 'disconnected'));
    socket.on("backend-user-message", (message, id) => { if (socket.id !== id) addMessage(message, false, id, message.trim().startsWith('<img')); });
    socket.on("total-user", (count) => updateUserCount(count));

    // --- FIXED: Implemented AI response handlers ---
    socket.on('ai-response', (data) => {
        // This event is for the user who asked the question.
        const loader = document.getElementById('ai-loader-message');
        if (loader) {
            loader.remove();
        }

        if (data.answer) {
            // Add the AI's answer, rendering it as Markdown.
            addMessage(data.answer, false, null, false);
        } else if (data.error) {
            // Display an error message if something went wrong.
            addMessage(`**AI Error:** ${data.error}`, false, null, false);
        }
    });

    socket.on('public-ai-message', (data) => {
        // This event is for everyone else to see a public AI interaction.
        const messageContent = `**Public AI Query:** "${data.question}"\n\n**AI Response:** ${data.answer || data.error}`;
        addMessage(messageContent, false, `ai-public-${Date.now()}`, false);
    });


    // ===================================================================================
    // --- INITIALIZATION ---
    // ===================================================================================

    // Use window.addEventListener('load', ...) for reliability, ensuring all assets are loaded.
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
            inputField.placeholder = `Type your message... (F1 or Fn+F1 for shortcuts)`;
            // Reinforce focus after load to counter any scripts that might steal it.
            if (document.activeElement !== inputField) inputField.focus();
            setTimeout(() => { if (document.activeElement !== inputField) inputField.focus(); }, 250);
        }

        setTimeout(() => {
            const hintMessage = IS_MOBILE ? 'Tap the ? for help' : `Press F1 (or Fn+F1) for keyboard shortcuts`;
            showTooltip(hintMessage, 4000);
        }, 3000);
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
    } else if (type === 'gif') {
        const socket = window.chatSocket;
        if (socket && socket.connected) {
            const gifHtml = `<img src="${content}" alt="${alt}" class="gif-message">`;
            socket.emit('user-message', gifHtml, () => {
                // Dispatch a local event to have the main client script render the sent GIF immediately.
                document.dispatchEvent(new CustomEvent('local-message-sent', { detail: { html: gifHtml } }));
            });
        }
    }
};

