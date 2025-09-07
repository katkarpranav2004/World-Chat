/**
 * @file support.js
 * @description Manages auxiliary UI components and features for World-Chat.
 * This includes the custom cursor, live clock, and the emoji/GIF picker panels.
 * This script is loaded with 'defer', so it executes after the DOM is parsed.
 */

// ===================================================================================
// --- CURSOR LOGIC ---
// ===================================================================================
const cursor = document.querySelector(".custom-cursor");
if (cursor) {
    document.addEventListener("mousemove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
    });
    document.addEventListener("mousedown", () => cursor.style.transform = "scale(0.8)");
    document.addEventListener("mouseup", () => cursor.style.transform = "scale(1)");
}

// ===================================================================================
// --- CLOCK LOGIC ---
// ===================================================================================
const clockElement = document.querySelector('.clock');
if (clockElement) {
    /** Updates the clock element with the current time. */
    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // Convert hour '0' to '12'
        const timeString = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
        
        if (clockElement.textContent !== timeString) {
            clockElement.textContent = timeString;
        }
    }
    clockElement.classList.add('show');
    setInterval(updateClock, 1000);
    updateClock(); // Initial call
}

// ===================================================================================
// --- PICKER LOGIC ---
// ===================================================================================

// --- DOM Element Selection ---
const emojiButton = document.getElementById("emoji-button");
const gifButton = document.getElementById("gif-button");
const emojiPickerElement = document.getElementById("emoji-picker");
const gifPickerElement = document.getElementById("gif-picker");
const gifSearchInput = document.getElementById("gif-search");
const gifResultsContainer = document.getElementById("gif-results");
const messageInputField = document.getElementById("message-input");

// --- State ---
let emojiPicker; // To hold the EmojiMart instance
let gifSearchTimeout; // To hold the debounce timer

// --- Emoji Picker Implementation ---
if (emojiButton && emojiPickerElement) {
    emojiButton.addEventListener("click", (event) => {
        event.stopPropagation();
        gifPickerElement.classList.remove('visible');
        emojiPickerElement.classList.toggle('visible');

        const isVisible = emojiPickerElement.classList.contains('visible');

        // LAZY LOADING: Initialize the heavy EmojiMart picker only on its first opening.
        if (isVisible && !emojiPicker) {
            emojiPicker = new EmojiMart.Picker({
                data: async () => {
                    const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
                    return response.json();
                },
                parent: emojiPickerElement,
                theme: 'light',
                onEmojiSelect: (emoji) => {
                    if (messageInputField) {
                        messageInputField.value += emoji.native;
                        messageInputField.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    // The picker remains open for multiple emoji selections.
                }
            });
        }

        // Auto-focus the search bar inside the picker's Shadow DOM.
        if (isVisible) {
            setTimeout(() => {
                const searchInput = emojiPickerElement.querySelector('em-emoji-picker')?.shadowRoot.querySelector('input[type="search"]');
                if (searchInput) searchInput.focus();
            }, 100);
        }
    });
}

// --- GIF Picker IMPLEMENTATION ---

/**
 * Fetches GIFs from the backend API and displays them in the picker.
 * Implements sessionStorage for caching to improve performance on repeated searches.
 * @param {string} [query=""] - The search query. If empty, fetches trending GIFs.
 */
async function fetchAndDisplayGifs(query = "") {
    if (!gifResultsContainer) return;

    const performanceStart = performance.now(); // Start performance timer
    const cacheKey = `gif-cache-${query || 'trending'}`;
    const cachedGifs = sessionStorage.getItem(cacheKey);

    gifResultsContainer.innerHTML = '<p>Loading GIFs...</p>';

    if (cachedGifs) {
        console.log(`[Cache] Loading GIFs from sessionStorage for query: "${query}"`);
        const data = JSON.parse(cachedGifs);
        displayGifs(data);
        const performanceEnd = performance.now();
        console.log(`[Perf] Displayed cached GIFs in ${Math.round(performanceEnd - performanceStart)}ms`);
        return;
    }

    try {
        const response = await fetch(`/api/gifs?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch GIFs from server');
        }
        const data = await response.json();
        
        // Cache the successful response in sessionStorage
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {
            console.warn("Could not write to sessionStorage. Cache may be full.", e);
            // Clear older cache items if storage is full
            sessionStorage.clear(); 
        }

        displayGifs(data);
        const performanceEnd = performance.now();
        console.log(`[Perf] Fetched and displayed GIFs in ${Math.round(performanceEnd - performanceStart)}ms`);

    } catch (error) {
        console.error("Failed to fetch GIFs:", error);
        gifResultsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

/**
 * Helper function to render GIF data into the results container.
 * @param {object} data - The API response data from Giphy.
 */
function displayGifs(data) {
    if (!gifResultsContainer) return;
    gifResultsContainer.innerHTML = ""; // Clear previous results or loading message

    if (data.data && data.data.length > 0) {
        const fragment = document.createDocumentFragment(); // Use a fragment for performance
        data.data.forEach((gif) => {
            const img = document.createElement("img");

            const staticSrc = gif.images.fixed_height_small_still.url;
            const animatedSrc = gif.images.fixed_height_small.url;

            img.src = staticSrc;
            img.alt = gif.title || "GIF";
            img.classList.add('gif-item');
            img.loading = 'lazy'; // Modern attribute to defer image loading

            img.addEventListener('mouseover', () => { if (img.src !== animatedSrc) img.src = animatedSrc; });
            img.addEventListener('mouseout', () => { if (img.src !== staticSrc) img.src = staticSrc; });

            img.addEventListener("click", () => {
                if (window.sendContent) {
                    window.sendContent({
                        type: 'gif',
                        content: gif.images.original.url,
                        alt: gif.title
                    });
                }
                if (gifPickerElement) gifPickerElement.classList.remove('visible');
            });
            fragment.appendChild(img);
        });
        gifResultsContainer.appendChild(fragment); // Append all images at once
    } else {
        gifResultsContainer.innerHTML = '<p>No GIFs found.</p>';
    }
}


if (gifButton && gifPickerElement && gifSearchInput) {
    gifButton.addEventListener("click", (event) => {
        event.stopPropagation();
        emojiPickerElement.classList.remove('visible');
        gifPickerElement.classList.toggle('visible');

        const isVisible = gifPickerElement.classList.contains('visible');
        if (isVisible) {
            // Fetch trending GIFs if the panel is opened with an empty search bar.
            if (!gifSearchInput.value) fetchAndDisplayGifs();
            gifSearchInput.focus();
        }
    });

    // DEBOUNCING: Wait for the user to stop typing before sending an API request.
    // This prevents excessive API calls while the user is typing a search query.
    gifSearchInput.addEventListener("input", () => {
        clearTimeout(gifSearchTimeout);
        gifSearchTimeout = setTimeout(() => {
            fetchAndDisplayGifs(gifSearchInput.value.trim());
        }, 500); // 500ms delay
    });
}

// ===================================================================================
// --- GLOBAL EVENT LISTENERS ---
// ===================================================================================

/**
 * Global click listener to close any open picker when clicking outside of it.
 * This provides an intuitive way for users to dismiss the panels.
 */
document.addEventListener("click", (event) => {
    if (emojiPickerElement && !emojiPickerElement.contains(event.target) && event.target !== emojiButton) {
        emojiPickerElement.classList.remove('visible');
    }
    if (gifPickerElement && !gifPickerElement.contains(event.target) && event.target !== gifButton) {
        gifPickerElement.classList.remove('visible');
    }
});

/**
 * Listens for a custom event dispatched from client.js (e.g., on 'Escape' key press)
 * to close all open picker panels.
 */
document.addEventListener('close-all-pickers', () => {
    if (emojiPickerElement) emojiPickerElement.classList.remove('visible');
    if (gifPickerElement) gifPickerElement.classList.remove('visible');
});