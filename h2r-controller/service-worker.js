// Service worker for H2R Graphics Controller extension
// Handles Google Sheet htmlview fetching to discover tabs and fetches individual CSV data
// Also acts as a proxy for H2R Graphics HTTP POST requests to bypass CORS limitations

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FETCH_TABS') {
    (async () => {
      try {
        const response = await fetch(message.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch sheet page: HTTP ${response.status}`);
        }
        const html = await response.text();
        
        const sheets = [];
        const regex = /items\.push\(\{\s*name:\s*"([^"]+)",\s*pageUrl:\s*"[^"]+",\s*gid:\s*"([0-9]+)"/g;
        let match;
        
        while ((match = regex.exec(html)) !== null) {
          sheets.push({
            name: match[1].replace(/\\x3d/g, '=').replace(/\\u0026/g, '&'),
            gid: match[2]
          });
        }
        
        sendResponse({ success: true, sheets });
      } catch (error) {
        console.error('Error in FETCH_TABS:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  }

  if (message.action === 'FETCH_CSV') {
    (async () => {
      try {
        const response = await fetch(message.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch CSV: HTTP ${response.status}`);
        }
        const text = await response.text();
        sendResponse({ success: true, data: text });
      } catch (error) {
        console.error('Error in FETCH_CSV:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  }

  if (message.action === 'PUSH_H2R') {
    (async () => {
      try {
        const response = await fetch(message.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message.payload)
        });
        
        if (!response.ok) {
          throw new Error(`H2R server returned HTTP ${response.status}`);
        }
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error pushing to H2R Graphics:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  }

  if (message.action === 'PUSH_H2R_ACTION') {
    (async () => {
      try {
        const response = await fetch(message.url, {
          method: 'POST'
        });
        
        if (!response.ok) {
          throw new Error(`H2R action returned HTTP ${response.status}`);
        }
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error executing H2R action:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  }
});
