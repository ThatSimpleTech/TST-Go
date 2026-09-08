# TST Go

**Location simulator for computer and phone.**

TST Go lets you jump anywhere on the map, walk, cycle, or drive a real route, and copy live GPS coordinates. Install it like an app on a phone or desktop — no store listing required.

A browser **cannot** inject GPS into other native apps. TST Go simulates location inside this app and gives you coordinates, map links, and GPX to take elsewhere.

---

## Download / install

You can run TST Go as an installed app (recommended) or clone the source.

### Phone

1. Open TST Go in **Safari** (iPhone / iPad) or **Chrome** (Android).
2. **iPhone / iPad:** tap Share, then **Add to Home Screen**.
3. **Android:** tap the browser menu, then **Install app** / **Add to Home Screen**.

It opens full-screen like a normal app, with the lock + pin on your home screen.

### Computer

1. Open TST Go in **Chrome** or **Edge**.
2. Open the browser menu (or the install icon in the address bar).
3. Choose **Install app**.

TST Go gets its own window, separate from the browser.

Inside the app you can also tap the **download** icon in the header, or **Install TST Go** on the welcome screen.

### From this repository

```bash
git clone https://github.com/ThatSimpleTech/TST-Go.git
cd TST-Go
npm install
npm run dev
```

Then open the URL printed in the terminal (typically `http://localhost:8080`).

To build a production bundle:

```bash
npm run build
npm run preview
```

Requires **Node.js 22+**.

You can also use GitHub → **Code** → **Download ZIP** if you do not use git.

---

## What you can do

- **Search** a city, landmark, or `lat, lng`
- **Jump** to teleport instantly
- **Walk / cycle / drive** along a plotted road route at real-world speed
- **Joystick** on phone, **WASD** on a keyboard
- **Copy** coordinates, GPS JSON, or a share link
- **Export GPX** of the route
- **Streets or satellite** map
- Save **favorite pins** on this device

Favorites and history stay in this browser (local storage). There is no account.

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

TST Go is a **web location simulator**. Other apps on your phone or computer keep using the device’s real GPS. Use it for demos, QA, sharing a point, or planning a route — not as a system-wide fake-GPS driver.

---

## Stack

React 19, TanStack Start, Leaflet, Tailwind CSS v4.

---

## License

Source is published by [That Simple Tech](https://github.com/ThatSimpleTech).
