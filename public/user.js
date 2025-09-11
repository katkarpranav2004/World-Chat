/**
 * @file user.js
 * @description Manages user registration, identity persistence, and unique name generation.
 * This script now exposes a single function, `window.getUserIdentity`, which client.js
 * will call to orchestrate the user identification process.
 */

// --- NEW: Expose the main function on the window object ---
window.getUserIdentity = function() {
    return new Promise((resolve) => {
        // --- DOM Element Selection ---
        const registrationModal = document.getElementById('registration-modal');
        const nameInput = document.getElementById('name-input-modal');
        const finalNameInput = document.getElementById('final-name');
        const joinButton = document.getElementById('join-chat-button');
        const nameBaseDisplay = document.getElementById('name-base-display');
        const nameSuffixDisplay = document.getElementById('name-suffix-display');
        const rerollButton = document.getElementById('reroll-button');

        // --- Constants ---
        // Expanded lists for more unique and fun combinations.
        const ADJECTIVES = [
            'Zappy', 'Apex', 'Bolt', 'Funky', 'Glitch', 'Jinx', 'Myth', 'Neon', 'Onyx', 'Pixel',
            'Rogue', 'Void', 'Zen', 'Warp', 'Flux', 'Jolt', 'Hype', 'Wacky', 'Goofy', 'Silly'
        ];
        const NOUNS = [
            'Bean', 'Bit', 'Blob', 'Bot', 'Chip', 'Claw', 'Dash', 'Doodle', 'Drift', 'Fang',
            'Fuse', 'Goose', 'Hack', 'Imp', 'Jet', 'Link', 'Mech', 'Noodle', 'Orb', 'Rift'
        ];
        const USER_STORAGE_KEY = 'world-chat-user';

        /**
         * @description Main initialization function for user identity.
         * Checks localStorage for an existing user. If not found, it starts the registration process.
         */
        function initUserIdentity() {
            const storedUser = getStoredUser();
            if (storedUser && storedUser.id && storedUser.name) {
                resolve(storedUser); // NEW: Resolve the promise instead of dispatching an event
            } else {
                registrationModal.style.display = 'flex';
                nameInput.focus();
                // Generate the first random suffix when the modal appears.
                generateAndDisplaySuffix();
                updateFinalName();
            }
        }

        /**
         * @description Retrieves user data from localStorage.
         * @returns {object|null} The parsed user object or null if not found/invalid.
         */
        function getStoredUser() {
            try {
                const userString = localStorage.getItem(USER_STORAGE_KEY);
                return userString ? JSON.parse(userString) : null;
            } catch (error) {
                console.error("Failed to parse user data from localStorage:", error);
                return null;
            }
        }

        /**
         * @description Generates a reasonably unique user ID.
         * @returns {string} A unique identifier.
         */
        function generateUniqueId() {
            return Date.now().toString(36) + Math.random().toString(36).substring(2);
        }

        /**
         * @description Generates a unique suffix by combining a random adjective and noun.
         * @returns {string} A unique word combination (e.g., "QuickFox").
         */
        function generateUniqueSuffix() {
            const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
            const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
            return `${adj}${noun}`;
        }

        /**
         * @description Creates a new suffix, displays it, and updates the final name.
         */
        function generateAndDisplaySuffix() {
            const suffix = generateUniqueSuffix();
            nameSuffixDisplay.textContent = `-${suffix}`;
            updateFinalName();
        }

        /**
         * @description Updates the hidden input with the complete unique name.
         */
        function updateFinalName() {
            const baseName = nameBaseDisplay.textContent.trim();
            const suffix = nameSuffixDisplay.textContent.trim();
            finalNameInput.value = `${baseName}${suffix}`;
        }

        /**
         * @description Saves the new user to localStorage and closes the modal.
         */
        function joinChat() {
            const chosenName = finalNameInput.value.trim();
            if (!nameInput.value.trim()) {
                // MODIFICATION: Use a more robust check for the base name
                nameInput.focus();
                showModalError('Please enter a name to join the chat.');
                return;
            }

            const newUser = {
                id: generateUniqueId(),
                name: chosenName
            };

            try {
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
                registrationModal.style.display = 'none';
                resolve(newUser); // NEW: Resolve the promise instead of dispatching an event
            } catch (error) {
                console.error("Failed to save user to localStorage:", error);
                alert("Could not save your user profile. Please ensure your browser allows site data.");
            }
        }

        // --- NEW: Function to show an error inside the modal ---
        function showModalError(message) {
            let errorEl = document.getElementById('modal-error-message');
            if (!errorEl) {
                errorEl = document.createElement('p');
                errorEl.id = 'modal-error-message';
                errorEl.style.color = 'var(--received-message-bg)';
                errorEl.style.marginTop = '1rem';
                joinButton.insertAdjacentElement('beforebegin', errorEl);
            }
            errorEl.textContent = message;
        }

        // --- Event Listeners ---

        // Update the displayed name as the user types.
        nameInput.addEventListener('input', () => {
            const baseName = nameInput.value.trim().replace(/\s/g, '') || 'User';
            nameBaseDisplay.textContent = baseName;
            updateFinalName();
        });

        // Handle re-rolling the unique suffix.
        rerollButton.addEventListener('click', generateAndDisplaySuffix);

        // Handle form submission via the "Join" button.
        joinButton.addEventListener('click', joinChat);

        // Allow submission by pressing Enter in the name input field.
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinChat();
            }
        });

        // --- Start the process ---
        initUserIdentity();
    });
};