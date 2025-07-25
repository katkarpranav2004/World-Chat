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
const chatInputElement = document.querySelector(".chat-input .input");

let emojiPicker; // Variable to hold the picker instance
let gifSearchTimeout;

// --- Emoji Picker Logic (Restored to original functionality) ---
if (emojiButton && emojiPickerElement && chatInputElement) {
    emojiButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const isVisible = emojiPickerElement.style.display === "block";
        gifPickerElement.style.display = 'none'; // Always close the other picker
        emojiPickerElement.style.display = isVisible ? "none" : "block";

        if (!isVisible && !emojiPicker) {
            // Initialize picker only once when it's first opened
            emojiPicker = new EmojiMart.Picker({
                data: async () => {
                    const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
                    return response.json();
                },
                parent: emojiPickerElement,
                theme: 'dark',
                onEmojiSelect: (emoji) => {
                    const start = chatInputElement.selectionStart;
                    const end = chatInputElement.selectionEnd;
                    chatInputElement.value = chatInputElement.value.substring(0, start) + emoji.native + chatInputElement.value.substring(end);
                    chatInputElement.selectionStart = chatInputElement.selectionEnd = start + emoji.native.length;
                    chatInputElement.focus();
                    emojiPickerElement.style.display = "none";
                }
            });
        }
    });
} else {
    console.error("Emoji button, picker element, or chat input not found.");
}

// --- GIF Picker Logic (Restored with security enhancement) ---
async function fetchAndDisplayGifs(query = "") {
    if (!gifResultsContainer) return;
    gifResultsContainer.innerHTML = '<p>Loading GIFs...</p>';
    try {
        // ENHANCEMENT: Call the secure server proxy
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
                img.addEventListener("click", () => {
                    // ENHANCEMENT: Dispatch a custom event for client.js to handle
                    document.dispatchEvent(new CustomEvent('send-gif', {
                        detail: { url: gif.images.fixed_height.url }
                    }));
                    gifPickerElement.style.display = "none";
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

if (gifButton && gifPickerElement && gifSearchInput && chatInputElement) {
    gifButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const isVisible = gifPickerElement.style.display === "block";
        emojiPickerElement.style.display = 'none'; // Always close the other picker
        gifPickerElement.style.display = isVisible ? "none" : "block";

        if (!isVisible && !gifSearchInput.value) {
            fetchAndDisplayGifs();
        }
        gifSearchInput.focus();
    });

    gifSearchInput.addEventListener("input", () => {
        clearTimeout(gifSearchTimeout);
        gifSearchTimeout = setTimeout(() => {
            fetchAndDisplayGifs(gifSearchInput.value.trim());
        }, 500);
    });
} else {
    console.error("GIF button, picker element, search input, results container, or chat input not found.");
}

// --- Global Click Listener to Close Pickers (Preserved) ---
document.addEventListener("click", (event) => {
    if (emojiPickerElement && !emojiPickerElement.contains(event.target) && event.target !== emojiButton) {
        emojiPickerElement.style.display = "none";
    }
    if (gifPickerElement && !gifPickerElement.contains(event.target) && event.target !== gifButton) {
        gifPickerElement.style.display = "none";
    }
});
