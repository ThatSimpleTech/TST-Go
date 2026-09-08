# TST Go

**Location simulator for computer and phone.**

TST Go lets you jump anywhere on the map, walk, cycle, or drive a real route, and copy live GPS coordinates.

On **Android** you can install a real APK. That app can also **broadcast** the simulated location to other apps after you pick TST Go as the mock location app in Developer options.

A **browser** cannot inject GPS into other native apps. The web version simulates location inside TST Go and gives you coordinates, map links, and GPX to take elsewhere.

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

### Computer

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
