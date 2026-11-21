chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SNAPFORGE_CAPTURE_VISIBLE") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      await chrome.storage.local.set({
        sf_latest_capture: {
          dataUrl,
          title: tab.title || "Screenshot",
          url: tab.url || "",
          at: Date.now(),
          crop: msg.crop || null
        }
      });
      await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
      sendResponse({ ok: true });
    })().catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg?.type === "SNAPFORGE_REGION_SELECTED") {
    (async () => {
      const tabId = sender.tab?.id;
      const winId = sender.tab?.windowId;
      const dataUrl = await chrome.tabs.captureVisibleTab(winId, { format: "png" });
      await chrome.storage.local.set({
        sf_latest_capture: {
          dataUrl,
          title: sender.tab?.title || "Region Capture",
          url: sender.tab?.url || "",
          at: Date.now(),
          crop: msg.rect
        }
      });
      await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
      sendResponse({ ok: true, tabId });
    })().catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg?.type === "SNAPFORGE_CAPTURE_SLICE") {
    chrome.tabs.captureVisibleTab(msg.windowId, { format: "png" })
      .then(dataUrl => sendResponse({ ok: true, dataUrl }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
