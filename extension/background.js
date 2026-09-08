const DEFAULT_FIX = {
  enabled: false,
  lat: 40.758,
  lng: -73.9855,
  heading: 0,
  speed: 0,
  accuracy: 5,
  label: "Times Square",
  updatedAt: 0,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["fix"], (r) => {
    if (!r.fix) chrome.storage.local.set({ fix: DEFAULT_FIX });
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "fromPage" && msg.fix) {
    chrome.storage.local.get(["fix"], (r) => {
      const prev = r.fix || DEFAULT_FIX;
      const next = {
        ...prev,
        enabled: true,
        lat: Number(msg.fix.lat),
        lng: Number(msg.fix.lng),
        heading: msg.fix.heading ?? prev.heading,
        speed: msg.fix.speed ?? prev.speed,
        accuracy: 5,
        label: msg.fix.label || prev.label,
        updatedAt: Date.now(),
      };
      chrome.storage.local.set({ fix: next });
    });
    return;
  }
  if (msg?.type === "setEnabled") {
    chrome.storage.local.get(["fix"], (r) => {
      const prev = r.fix || DEFAULT_FIX;
      chrome.storage.local.set({ fix: { ...prev, enabled: Boolean(msg.enabled), updatedAt: Date.now() } });
    });
    return;
  }
  if (msg?.type === "setFix") {
    chrome.storage.local.get(["fix"], (r) => {
      const prev = r.fix || DEFAULT_FIX;
      chrome.storage.local.set({
        fix: {
          ...prev,
          ...msg.fix,
          enabled: true,
          updatedAt: Date.now(),
        },
      });
    });
    return;
  }
  if (msg?.type === "getFix") {
    chrome.storage.local.get(["fix"], (r) => sendResponse(r.fix || DEFAULT_FIX));
    return true;
  }
});
