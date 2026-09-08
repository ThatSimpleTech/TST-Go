# TST Go

**Location simulator for computer and phone.**

TST Go lets you jump anywhere on the map, walk, cycle, or drive a real route, and copy live GPS coordinates.

On **Android** you can install a real APK. That app can also **broadcast** the simulated location to other apps after you pick TST Go as the mock location app in Developer options.

On **Mac, Windows, and Linux**, install the **browser extension**. It spoofs GPS for websites in Chrome, Edge, Brave, Arc, or Firefox (Google Maps in a tab, store locators, weather). Native desktop apps (Find My, system Maps, most games) still use the real OS location — those platforms do not allow a regular app to replace system GPS.

A **browser tab without the extension** cannot inject GPS into other apps. The web version still simulates location inside TST Go and gives you coordinates, map links, and GPX.

---

## Download / install

### Android APK (recommended on phones)

1. Download **[TST-Go.apk](https://github.com/ThatSimpleTech/TST-Go/raw/main/public/tst-go.apk)** (also in this repo at `public/tst-go.apk`).
2. Open the file on your phone. If Android blocks it, allow installs from that source, then tap the APK again.
3. Open **TST Go**.
4. Optional — feed GPS to other apps:
   - Settings → About phone → tap **Build number** seven times
   - Settings → **Developer options** → **Select mock location app** → **TST Go**
   - In TST Go, turn on **Broadcast to other apps**, then Jump / Walk / Cycle / Drive

Requires Android 8 or newer. Not listed on the Play Store; sideload only.

### Phone (browser app)

1. Open TST Go in **Safari** (iPhone / iPad) or **Chrome** (Android).
2. **iPhone / iPad:** tap Share, then **Add to Home Screen**.
3. **Android (no APK):** tap the browser menu, then **Install app** / **Add to Home Screen**. This does **not** spoof GPS for other apps.

### Computer (Mac, Windows, Linux)

**Change GPS for websites** (recommended):

1. Download **[TST-Go-extension.zip](https://github.com/ThatSimpleTech/TST-Go/raw/main/public/tst-go-extension.zip)**.
2. Unzip it.
3. **Chrome / Edge / Brave / Arc:** open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, pick the unzipped folder (the one with `manifest.json`).
4. **Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.
5. Open TST Go in a tab, move the pin. Open Maps (or any site that asks for location) in another tab — it should follow the pin. The extension popup also has search.

The extension cannot spoof native OS apps. That is an OS limit, not a TST Go setting.

**Install the map as a desktop app:**

1. Open TST Go in **Chrome** or **Edge**.
2. Open the browser menu (or the install icon in the address bar).
3. Choose **Install app**.

Inside the web app you can tap the **download** icon in the header for the APK or home-screen steps.

### From this repository

```bash
git clone https://github.com/ThatSimpleTech/TST-Go.git
cd TST-Go
npm install
npm run dev
```

Then open the URL printed in the terminal.

To build the Android APK yourself (Android SDK required):

```bash
cd android
./gradlew assembleDebug
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

Requires **Node.js 22+** for the web app, **JDK 17** plus an Android SDK for the APK.

You can also use GitHub → **Code** → **Download ZIP** if you do not use git.

---

## What you can do

- **Search** a city, landmark, or `lat, lng`
- **Jump** to teleport instantly
- **Walk / cycle / drive** along a plotted road route at real-world speed
- **Joystick** on phone, **WASD** on a keyboard (web)
- **Copy** coordinates, GPS JSON, or a share link
- **Export GPX** of the route (web)
- **Streets or satellite** map (web)
- Save **favorite pins** on this device (web)
- **Broadcast to other apps** (Android APK, mock location)
- **Spoof GPS in Chrome/Edge/Firefox** (Mac / Windows / Linux extension)

Favorites and history stay on this device. There is no account.

---

## Keyboard

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` or arrows | Nudge while a live signal is running |
| `Space` | Start / pause |
| `Esc` | Stop |
| `+` / `-` | Zoom |
| `F` | Follow the pin |

---

## Limits

- **Web / installed browser app:** other apps keep using the device’s real GPS.
- **Android APK:** other apps can use the simulated GPS **only** after you select TST Go as the mock location app. This is the official Android testing hook, not a Play Store fake-GPS listing.
- Routers, Tailscale, and VPNs move **network traffic**. They cannot install this APK, and they cannot spoof a phone’s GPS sensor.

Use TST Go for demos, QA, sharing a point, or planning a route.

---

## Stack

Web: React 19, TanStack Start, Leaflet, Tailwind CSS v4.

Android: Kotlin, osmdroid, Android mock location APIs.

---

## License

Source is published by [That Simple Tech](https://github.com/ThatSimpleTech).
