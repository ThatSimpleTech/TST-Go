(function () {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  script.onload = () => script.remove();
  (document.documentElement || document.head || document.body).appendChild(script);

  function push(fix) {
    if (!fix) return;
    window.postMessage({ source: "tst-go-extension", type: "FIX", fix }, "*");
  }

  chrome.storage.local.get(["fix"], (r) => push(r.fix));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.fix) push(changes.fix.newValue);
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "tst-go" || data.type !== "TST_GO_FIX") return;
    try {
      chrome.runtime.sendMessage({ type: "fromPage", fix: data });
    } catch (_) {
      /* extension reloaded */
    }
  });
})();
