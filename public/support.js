const cursor = document.querySelector(".custom-cursor");
document.addEventListener("mousemove", (e) => {
    cursor.style.left = e.clientX + "px";
    cursor.style.top = e.clientY + "px";
});

document.addEventListener("click", () => {
    cursor.style.transform = "scale(0.8)";
    setTimeout(() => {
        cursor.style.transform = "scale(1)";
    }, 100);
});

document.getElementById("gif-button").addEventListener("click", () => {
    const gifPicker = document.getElementById("gif-picker");
    gifPicker.style.display =
        gifPicker.style.display === "none" ? "block" : "none";
});

document.getElementById("gif-search").addEventListener("input", (e) => {
    const query = e.target.value;
    // Implement GIF search API call and update #gif-results with GIFs
});

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    hours = String(hours).padStart(2, '0');

    const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;
    const clockElement = document.querySelector('.clock');
    clockElement.textContent = timeString;
    clockElement.classList.remove('show');
    void clockElement.offsetWidth; // Trigger reflow to restart the animation
    clockElement.classList.add('show');
}

// Update clock every second
setInterval(updateClock, 1000);

// Initial clock update
updateClock();



