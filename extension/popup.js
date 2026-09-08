const enabledEl = document.getElementById("enabled");
const statusEl = document.getElementById("status");
const coordsEl = document.getElementById("coords");
const labelEl = document.getElementById("label");
const hitsEl = document.getElementById("hits");
const form = document.getElementById("searchForm");
const queryEl = document.getElementById("query");

function pair(lat, lng) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(6)}° ${ns},  ${Math.abs(lng).toFixed(6)}° ${ew}`;
}

function render(fix) {
  if (!fix) return;
  enabledEl.checked = Boolean(fix.enabled);
  coordsEl.textContent = pair(fix.lat, fix.lng);
  labelEl.textContent = fix.label || "";
  if (!fix.enabled) {
    statusEl.className = "off";
    statusEl.textContent = "Off — websites still see real GPS";
  } else {
    statusEl.className = "live";
    statusEl.textContent = "Live — websites in this browser follow this pin";
  }
}

chrome.storage.local.get(["fix"], (r) => render(r.fix));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.fix) render(changes.fix.newValue);
});

enabledEl.addEventListener("change", () => {
  chrome.runtime.sendMessage({ type: "setEnabled", enabled: enabledEl.checked });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const q = queryEl.value.trim();
  if (!q) return;
  const coord = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (coord) {
    chrome.runtime.sendMessage({
      type: "setFix",
      fix: { lat: Number(coord[1]), lng: Number(coord[2]), label: "Pinned coordinates" },
    });
    hitsEl.replaceChildren();
    return;
  }
  hitsEl.textContent = "Searching…";
  try {
    const url = "https://photon.komoot.io/api/?limit=5&q=" + encodeURIComponent(q);
    const data = await fetch(url).then((r) => r.json());
    const features = data.features || [];
    hitsEl.replaceChildren();
    if (!features.length) {
      hitsEl.textContent = "No places match";
      return;
    }
    for (const f of features) {
      const p = f.properties || {};
      const c = f.geometry?.coordinates || [];
      const lng = c[0];
      const lat = c[1];
      const name = p.name || p.street || "Place";
      const detail = [p.city || p.locality, p.state, p.country].filter(Boolean).join(", ");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = detail ? `${name} — ${detail}` : name;
      btn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "setFix", fix: { lat, lng, label: name } });
        hitsEl.replaceChildren();
      });
      hitsEl.appendChild(btn);
    }
  } catch (err) {
    hitsEl.textContent = "Search failed";
  }
});
