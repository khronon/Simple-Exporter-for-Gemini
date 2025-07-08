// content.js

// Listen for a message from the popup.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.request === "exportChat") {
    // Start the export process and respond to the popup to confirm.
    processChatExport(message.format).then(() => {
      sendResponse({ status: "processing" });
    });
    return true;
  }
});

/**
 * Main function to extract chat data and trigger download.
 * @param {string} format - The desired export format ('html', 'json', 'md').
 */
async function processChatExport(format) {
  try {
    const expandButtons = document.querySelectorAll("button.expand-button");
    if (expandButtons.length > 0) {
      expandButtons.forEach((button) => button.click());
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    /* Silently handle errors */
  }

  const titleElement = document.querySelector(
    "div.conversation-title.gds-label-l"
  );
  const chatTitle = titleElement
    ? titleElement.textContent.trim()
    : "Gemini Chat";

  const metadata = {
    sourceUrl: window.location.href,
    generationDate: new Date().toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    }),
  };

  const chatWindow = document.querySelector("chat-window");
  if (!chatWindow) return;

  const allElements = chatWindow.querySelectorAll(
    'span.horizontal-container, div[id^="model-response-message-contentr_"]'
  );
  if (allElements.length === 0) return;

  let chatLog = [];
  let lastUserInput = "";

  allElements.forEach((element) => {
    if (element.matches("span.horizontal-container")) {
      if (lastUserInput) {
        chatLog.push({ user: lastUserInput, ai: "(No AI response)" });
      }
      const queryLines = element.querySelectorAll("p.query-text-line");
      lastUserInput = Array.from(queryLines)
        .map((p) => p.textContent.trim())
        .join("\n");
    } else if (element.matches('div[id^="model-response-message-contentr_"]')) {
      const clonedOutput = element.cloneNode(true);
      clonedOutput
        .querySelectorAll(
          ".tool-bar, .buttons, .response-container-footer, .code-editor"
        )
        .forEach((el) => el.remove());
      clonedOutput.querySelectorAll("*").forEach((el) => {
        const attributesToRemove = [];
        for (const attr of el.attributes) {
          const attrName = attr.name;
          if (
            attrName.startsWith("_ngcontent-") ||
            attrName.startsWith("_nghost-") ||
            attrName.startsWith("ng-tns-") ||
            attrName.startsWith("mat-") ||
            attrName === "jslog"
          ) {
            attributesToRemove.push(attrName);
          }
        }
        attributesToRemove.forEach((attrName) => el.removeAttribute(attrName));
        if (el.hasAttribute("data-sourcepos")) {
          el.removeAttribute("data-sourcepos");
        }
      });
      const aiOutputHtml = clonedOutput.innerHTML;
      chatLog.push({ user: lastUserInput, ai: aiOutputHtml });
      lastUserInput = "";
    }
  });

  if (lastUserInput) {
    chatLog.push({ user: lastUserInput, ai: "(No AI response)" });
  }

  // Generate data based on the selected format and send to background.js
  switch (format) {
    case "html":
      const finalHtml = generateSimpleHtml(chatLog, chatTitle, metadata);
      chrome.runtime.sendMessage({
        action: "downloadAsHtmlFile",
        data: finalHtml,
        title: chatTitle,
      });
      break;
    case "json":
      const jsonData = { title: chatTitle, ...metadata, chat: chatLog };
      chrome.runtime.sendMessage({
        action: "downloadAsJsonFile",
        data: jsonData,
        title: chatTitle,
      });
      break;
    case "md":
      const finalMarkdown = generateMarkdown(chatLog, chatTitle, metadata);
      chrome.runtime.sendMessage({
        action: "downloadAsMarkdownFile",
        data: finalMarkdown,
        title: chatTitle,
      });
      break;
  }
}

/**
 * Generates a Markdown string from the chat log.
 */
function generateMarkdown(chatLog, chatTitle, metadata) {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  let markdownString = `# ${chatTitle}\n\n`;

  chatLog.forEach((turn) => {
    markdownString += `**You:**\n\n> ${turn.user.replace(/\n/g, "\n> ")}\n\n`;
    if (turn.ai && turn.ai !== "(No AI response)") {
      const aiMarkdown = turndownService.turndown(turn.ai);
      markdownString += `**Gemini:**\n\n${aiMarkdown}\n\n`;
    }
    markdownString += `---\n\n`;
  });

  markdownString += `*Generated on: ${metadata.generationDate} from [${metadata.sourceUrl}](${metadata.sourceUrl})*`;
  return markdownString;
}

/**
 * Generates a feature-rich HTML string from the extracted chat log data.
 */
function generateSimpleHtml(chatLog, chatTitle, metadata) {
  const processedChatLog = chatLog.map((turn) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = turn.ai;
    tempDiv.querySelectorAll("pre").forEach((preEl) => {
      const details = document.createElement("details");
      details.className = "code-block-details";
      details.open = true;
      const summary = document.createElement("summary");
      summary.className = "code-block-summary";
      const summaryText = document.createElement("span");
      summaryText.className = "summary-text";
      summaryText.textContent = "Code Block";
      const copyButton = document.createElement("button");
      copyButton.className = "copy-code-button";
      copyButton.textContent = "Copy";
      copyButton.setAttribute("onclick", "copyCode(this, event)");
      summary.appendChild(summaryText);
      summary.appendChild(copyButton);
      details.appendChild(summary);
      details.appendChild(preEl.cloneNode(true));
      preEl.parentNode.replaceChild(details, preEl);
    });
    return { user: turn.user, ai: tempDiv.innerHTML };
  });

  const bodyContent = processedChatLog
    .map((turn) => {
      const isLongInput = turn.user.split("\n").length > 5;
      const userInputHtml = isLongInput
        ? `<div class="user-input-long expandable" onclick="toggleExpand(this)">
           <div class="text-content">${escapeHtml(turn.user).replace(
             /\n/g,
             "<br>"
           )}</div>
           <div class="expand-fade"></div>
           <div class="expand-prompt">Click to expand</div>
         </div>`
        : `<div class="text-content">${escapeHtml(turn.user).replace(
            /\n/g,
            "<br>"
          )}</div>`;
      return `<article class="turn">
      <div class="user-input"><div class="label">You</div>${userInputHtml}</div>
      <div class="ai-output"><div class="label">Gemini</div><div class="markdown-body">${turn.ai}</div></div>
    </article>`;
    })
    .join("");

  const footerContent = `
    <footer class="footer">
        <p>
            Generated on: ${metadata.generationDate}<br>
            Source: <a href="${metadata.sourceUrl}" target="_blank" rel="noopener noreferrer">${metadata.sourceUrl}</a>
        </p>
    </footer>`;

  const scriptContent = `
    function copyCode(buttonElement, event) {
      event.stopPropagation();
      const summaryElement = buttonElement.closest('.code-block-summary');
      const detailsElement = summaryElement.parentElement;
      const preElement = detailsElement.querySelector('pre');
      if (!preElement) return;
      navigator.clipboard.writeText(preElement.textContent).then(() => {
        buttonElement.textContent = 'Copied!';
        buttonElement.style.backgroundColor = '#d1ffd1';
        setTimeout(() => {
          buttonElement.textContent = 'Copy';
          buttonElement.style.backgroundColor = '';
        }, 2000);
      }).catch(err => { console.error('Failed to copy code', err); alert('Failed to copy code.'); });
    }
    function toggleExpand(element) { element.classList.toggle('expanded'); }
    document.addEventListener('DOMContentLoaded', () => {
      const toggleAllCodeBtn = document.getElementById('toggle-all-code');
      const toggleAllInputsBtn = document.getElementById('toggle-all-inputs');
      if (toggleAllCodeBtn) {
        toggleAllCodeBtn.addEventListener('click', () => {
          const allCodeDetails = document.querySelectorAll('.code-block-details');
          if (allCodeDetails.length === 0) return;
          const shouldOpen = !allCodeDetails[0].open;
          allCodeDetails.forEach(details => { details.open = shouldOpen; });
          toggleAllCodeBtn.textContent = shouldOpen ? 'Collapse All Code Blocks' : 'Expand All Code Blocks';
        });
      }
      if (toggleAllInputsBtn) {
        toggleAllInputsBtn.addEventListener('click', () => {
          const allExpandableInputs = document.querySelectorAll('.user-input-long.expandable');
          if (allExpandableInputs.length === 0) return;
          const isCurrentlyExpanded = allExpandableInputs[0].classList.contains('expanded');
          allExpandableInputs.forEach(input => { input.classList.toggle('expanded', !isCurrentlyExpanded); });
          toggleAllInputsBtn.textContent = !isCurrentlyExpanded ? 'Collapse All Inputs' : 'Expand All Inputs';
        });
      }
    });
  `;

  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(chatTitle)}</title>
  <style>
    :root {
      --bg-color: #f6f8fa; --text-color: #24292e; --container-bg: #fff; --border-color: #d1d5da; --header-bg: #f6f8fa;
      --label-color: #586069; --user-input-bg: #f1f8ff; --user-input-text: #032f62; --link-color: #0366d6;
      --code-bg: #2f2f2f; --code-text: #e6e6e6; --code-header-bg: #f7f7f7; --blockquote-border: #dfe2e5; --blockquote-text: #6a737d;
      --button-bg: #fff; --button-border: #ccc; --button-hover-bg: #f1f8ff;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #0d1117; --text-color: #c9d1d9; --container-bg: #161b22; --border-color: #30363d; --header-bg: #161b22;
        --label-color: #8b949e; --user-input-bg: #1c283e; --user-input-text: #a8c7fa; --link-color: #58a6ff;
        --code-bg: #111; --code-text: #e6e6e6; --code-header-bg: #21262d; --blockquote-border: #3b434b; --blockquote-text: #8b949e;
        --button-bg: #21262d; --button-border: #444c56; --button-hover-bg: #30363d;
      }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"; line-height: 1.6; background-color: var(--bg-color); color: var(--text-color); margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background-color: var(--container-bg); border: 1px solid var(--border-color); border-radius: 6px; }
    .chat-title { padding: 20px 25px; border-bottom: 1px solid var(--border-color); font-size: 1.5em; font-weight: 600; }
    .global-controls { padding: 10px 25px; border-bottom: 1px solid var(--border-color); background-color: var(--header-bg); display: flex; flex-wrap: wrap; gap: 10px; }
    .global-controls button { background-color: var(--button-bg); color: var(--text-color); border: 1px solid var(--button-border); border-radius: 6px; padding: 8px 12px; cursor: pointer; font-size: 13px; transition: background-color 0.2s; }
    .global-controls button:hover { background-color: var(--button-hover-bg); }
    .turn { padding: 25px; border-bottom: 1px solid #30363d; }
    .turn:last-child { border-bottom: none; }
    .label { font-weight: bold; font-size: 0.9em; margin-bottom: 10px; color: var(--label-color); }
    .user-input { margin-bottom: 25px; }
    .user-input .text-content { background-color: var(--user-input-bg); color: var(--user-input-text); padding: 15px; border-radius: 6px; white-space: pre-wrap; word-wrap: break-word; }
    .markdown-body a { color: var(--link-color); }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    .markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body blockquote { margin-top: 0; margin-bottom: 16px; }
    .markdown-body ul, .markdown-body ol { padding-left: 2em; }
    .markdown-body pre { background-color: var(--code-bg); color: var(--code-text); padding: 16px; border-radius: 6px; overflow: auto; white-space: pre; }
    .markdown-body code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 85%; background-color: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 3px; }
    .markdown-body pre > code { background-color: transparent; padding: 0; font-size: 100%; }
    .markdown-body blockquote { padding: 0 1em; color: var(--blockquote-text); border-left: 0.25em solid var(--blockquote-border); }
    .code-block-details { border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 16px; }
    .code-block-summary { display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: 500; padding: 8px 12px; user-select: none; background-color: var(--code-header-bg); border-bottom: 1px solid transparent; }
    .code-block-details[open] > .code-block-summary { border-bottom-color: var(--border-color); border-top-left-radius: 6px; border-top-right-radius: 6px;}
    .code-block-summary:hover { color: var(--link-color); }
    .code-block-summary::-webkit-details-marker { display: none; }
    .summary-text::before { content: '▶'; display: inline-block; margin-right: 8px; transition: transform 0.2s; font-size: 0.8em; }
    .code-block-details[open] .summary-text::before { transform: rotate(90deg); }
    .code-block-details > pre { margin: 0 !important; border-radius: 0 !important; border: none !important; border-top: 1px solid var(--border-color) !important; border-bottom-left-radius: 6px !important; border-bottom-right-radius: 6px !important;}
    .code-block-details:not([open]) > pre { display: none; }
    .copy-code-button { background-color: var(--button-bg); color: var(--text-color); border: 1px solid var(--button-border); border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; transition: background-color 0.2s; z-index: 1; }
    .copy-code-button:hover { background-color: var(--button-hover-bg); }
    .user-input-long { position: relative; cursor: pointer; background-color: var(--user-input-bg); border-radius: 6px; }
    .user-input-long .text-content { max-height: 120px; overflow: hidden; transition: max-height 0.3s ease-in-out; }
    .user-input-long.expanded .text-content { max-height: 2000px; }
    .expand-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: linear-gradient(to bottom, transparent, var(--user-input-bg)); pointer-events: none; }
    .user-input-long.expanded .expand-fade { display: none; }
    .expand-prompt { position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); background-color: rgba(255, 255, 255, 0.9); color: #333; padding: 2px 10px; border-radius: 10px; font-size: 12px; pointer-events: none; border: 1px solid #ddd; }
    .user-input-long.expanded .expand-prompt { display: none; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #6a737d; border-top: 1px solid var(--border-color); }
    .footer a { color: var(--link-color); }
    @media (prefers-color-scheme: dark) {
      .expand-prompt { background-color: rgba(42, 42, 44, 0.9); color: #fff; border-color: #555; }
      .footer { color: #8b949e; }
    }
    @media print {
      .user-input .text-content, .user-input-long { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .global-controls, .footer, .copy-code-button { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="chat-title">${escapeHtml(chatTitle)}</header>
    <div class="global-controls">
      <button id="toggle-all-code">Collapse All Code Blocks</button>
      <button id="toggle-all-inputs">Expand All Inputs</button>
    </div>
    ${bodyContent}
    ${footerContent}
  </div>
  <script>${scriptContent}</script>
</body>
</html>`;
}
