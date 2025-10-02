/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */

// Wait for DOM to be ready and electronAPI to be available
document.addEventListener('DOMContentLoaded', async () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  // Check if electronAPI is available
  if (window.electronAPI && window.electronAPI.streamWithFetch) {
    replaceText('fetch-streaming-client', 'Fetching...');
    
    try {
      const stats = await window.electronAPI.streamWithFetch();
      replaceText('fetch-streaming-client', `Fetch stats (chunk length -> count / ttfb ms -> count): ${JSON.stringify(stats, null, 2)}`);
    } catch (err) {
      replaceText('fetch-streaming-client', `Fetch error: ${err}`);
    }
  } else {
    replaceText('fetch-streaming-client', 'electronAPI not available');
  }
});
