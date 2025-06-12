// background.js

// Called when a message is received from the content script.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if the message is a download request.
  if (message.action && message.action.startsWith("downloadAs")) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
    const formattedTime = `${date.getHours().toString().padStart(2, "0")}-${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}-${date.getSeconds().toString().padStart(2, "0")}`;

    const safeTitle = message.title
      .replace(/[\\/:\*\?"<>\|]/g, "_")
      .substring(0, 100);

    let dataUri;
    let fileExtension;

    // Determine the data URI and file extension based on the action.
    switch (message.action) {
      case "downloadAsHtmlFile":
        dataUri =
          "data:text/html;charset=utf-8," + encodeURIComponent(message.data);
        fileExtension = ".html";
        break;
      case "downloadAsJsonFile":
        const jsonData = JSON.stringify(message.data, null, 2); // Pretty-print JSON
        dataUri =
          "data:application/json;charset=utf-8," + encodeURIComponent(jsonData);
        fileExtension = ".json";
        break;
      case "downloadAsMarkdownFile":
        dataUri =
          "data:text/markdown;charset=utf-8," +
          encodeURIComponent(message.data);
        fileExtension = ".md";
        break;
      default:
        return false; // Unknown action.
    }

    const filename = `${safeTitle}_${formattedDate}_${formattedTime}${fileExtension}`;

    // Use the chrome.downloads API to trigger the download.
    chrome.downloads.download(
      {
        url: dataUri,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          /* Silently handle errors */
        }
        sendResponse({
          status: "Download process initiated",
          downloadId: downloadId,
        });
      }
    );

    return true;
  }
  return false;
});
