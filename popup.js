// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const formats = ["html", "json", "md"];
  const messageArea = document.getElementById("message-area");

  /**
   * Displays a message in the popup.
   * @param {string} text - The message to display.
   * @param {boolean} isError - If true, the message will be styled as an error.
   */
  function showMessage(text, isError = false) {
    messageArea.textContent = text;
    messageArea.style.color = isError ? "#d93025" : "#333";
  }

  formats.forEach((format) => {
    const button = document.getElementById(`export-${format}`);
    if (button) {
      button.addEventListener("click", () => {
        // Query the active tab to check the URL.
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          // Check if we are on a valid Gemini page.
          if (
            tabs[0] &&
            tabs[0].url &&
            tabs[0].url.startsWith("https://gemini.google.com/")
          ) {
            showMessage("Exporting..."); // Show feedback

            // Send a message to the content script.
            chrome.tabs.sendMessage(
              tabs[0].id,
              { request: "exportChat", format: format },
              (response) => {
                if (chrome.runtime.lastError) {
                  // This can happen if the content script is not ready.
                  showMessage(
                    "Failed to connect. Please reload the page.",
                    true
                  );
                } else {
                  // On success, simply close the popup.
                  window.close();
                }
              }
            );
          } else {
            // If not on a Gemini page, show an error.
            showMessage(
              "This extension only works on gemini.google.com.",
              true
            );
          }
        });
      });
    }
  });
});
