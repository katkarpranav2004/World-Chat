// --- Cursor Logic ---
// This logic is now in the global scope, same as the original file, to ensure it runs immediately.
const cursor = document.querySelector(".custom-cursor");
if (cursor) {
    document.addEventListener("mousemove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
    });
    document.addEventListener("mousedown", () => {
        cursor.style.transform = "scale(0.8)";
    });
    document.addEventListener("mouseup", () => {
        cursor.style.transform = "scale(1)";
    });
}

// --- Clock Logic ---
// This is also in the global scope, matching the original structure.
const clockElement = document.querySelector('.clock');
function updateClock() {
    const now = new Date();
    // Reverted to the exact time formatting from your original file.
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    hours = String(hours).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;
    
    if (clockElement && clockElement.textContent !== timeString) {
        clockElement.textContent = timeString;
    }
}
if (clockElement) {
    clockElement.classList.add('show');
    setInterval(updateClock, 1000);
    updateClock();
} else {
    console.error("Clock element not found");
}


// --- Picker and Other Logic ---
// This part of the script needs to wait for the DOM to load, which is handled
// by the 'defer' attribute on the <script> tag in index.html.

const emojiButton = document.getElementById("emoji-button");
const gifButton = document.getElementById("gif-button");
const emojiPickerElement = document.getElementById("emoji-picker");
const gifPickerElement = document.getElementById("gif-picker");
const gifSearchInput = document.getElementById("gif-search");
const gifResultsContainer = document.getElementById("gif-results");
const messageInputField = document.getElementById("message-input"); // Get the main message input

let emojiPicker;
let gifSearchTimeout;

// --- Emoji Picker Logic ---
if (emojiButton && emojiPickerElement) {
    emojiButton.addEventListener("click", (event) => {
        event.stopPropagation();
        // Hide the other picker and toggle the current one
        gifPickerElement.classList.remove('visible');
        emojiPickerElement.classList.toggle('visible');

        const isVisible = emojiPickerElement.classList.contains('visible');

        // Initialize picker only once when it's first opened
        if (isVisible && !emojiPicker) {
            emojiPicker = new EmojiMart.Picker({
                data: async () => {
                    const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
                    return response.json();
                },
                parent: emojiPickerElement,
                theme: 'dark',
                onEmojiSelect: (emoji) => {
                    // Append the selected emoji to the main input field
                    if (messageInputField) {
                        messageInputField.value += emoji.native;
                        // Trigger an input event so other parts of the app can react if needed
                        messageInputField.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    // DO NOT hide the picker after selection.
                }
            });
        }

        // If the picker is now visible, focus its search input
        if (isVisible) {
            // Use a small timeout to wait for the web component to render its shadow DOM
            setTimeout(() => {
                const searchInput = emojiPickerElement.querySelector('em-emoji-picker')?.shadowRoot.querySelector('input[type="search"]');
                if (searchInput) {
                    searchInput.focus();
                }
            }, 100);
        }
    });
}

// --- GIF Picker Logic ---
async function fetchAndDisplayGifs(query = "") {
    if (!gifResultsContainer) return;
    gifResultsContainer.innerHTML = '<p>Loading GIFs...</p>';
    try {
        const response = await fetch(`/api/gifs?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch GIFs from server');
        }
        const data = await response.json();
        gifResultsContainer.innerHTML = "";

        if (data.data && data.data.length > 0) {
            data.data.forEach((gif) => {
                const img = document.createElement("img");
                img.src = gif.images.fixed_height_small.url;
                img.alt = gif.title || "GIF";
                img.classList.add('gif-item'); // Add class for styling
                img.addEventListener("click", () => {
                    // Use the globally available function from client.js
                    if (window.sendContent) {
                        window.sendContent({
                            type: 'gif',
                            content: gif.images.original.url,
                            alt: gif.title
                        });
                    }
                    gifPickerElement.style.display = 'none'; // Hide picker
                });
                gifResultsContainer.appendChild(img);
            });
        } else {
            gifResultsContainer.innerHTML = '<p>No GIFs found.</p>';
        }
    } catch (error) {
        console.error("Failed to fetch GIFs:", error);
        gifResultsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

if (gifButton && gifPickerElement && gifSearchInput) {
    gifButton.addEventListener("click", (event) => {
        event.stopPropagation();
        // Hide the other picker and toggle the current one
        emojiPickerElement.classList.remove('visible');
        gifPickerElement.classList.toggle('visible');

        const isVisible = gifPickerElement.classList.contains('visible');
        if (isVisible && !gifSearchInput.value) {
            fetchAndDisplayGifs(); // Fetch trending on first open
        }
        if (isVisible) {
            gifSearchInput.focus();
        }
    });

    gifSearchInput.addEventListener("input", () => {
        clearTimeout(gifSearchTimeout);
        gifSearchTimeout = setTimeout(() => {
            fetchAndDisplayGifs(gifSearchInput.value.trim());
        }, 500); // Debounce search
    });
}

// --- Global Click Listener to Close Pickers ---
document.addEventListener("click", (event) => {
    if (emojiPickerElement && !emojiPickerElement.contains(event.target) && event.target !== emojiButton) {
        emojiPickerElement.classList.remove('visible');
    }
    if (gifPickerElement && !gifPickerElement.contains(event.target) && event.target !== gifButton) {
        gifPickerElement.classList.remove('visible');
    }
});

// --- Listen for close all pickers event (from keyboard shortcuts) ---
document.addEventListener('close-all-pickers', () => {
    if (emojiPickerElement) emojiPickerElement.classList.remove('visible');
    if (gifPickerElement) gifPickerElement.classList.remove('visible');
});