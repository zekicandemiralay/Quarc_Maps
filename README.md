# Quarc Maps

Open-source maps with automatic global transit coverage. Google Maps-style UI — dark/light mode, car/bike/walk/transit routing, mobile bottom sheet, location detection.

---

## Stack

| Layer | Technology |
|---|---|
| Map rendering | [MapLibre GL JS](https://maplibre.org/) |
| Map tiles | [MapTiler Cloud](https://maptiler.com) |
| Geocoding | [Photon](https://photon.komoot.io) (no key needed) |
| Routing (car/bike/walk) | [OpenRouteService](https://openrouteservice.org) |
| Routing (transit) | [OpenTripPlanner 2.5](https://www.opentripplanner.org/) |
| Transit feeds | Auto-downloaded via [Transitland](https://transit.land/) + [MobilityData](https://mobilitydatabase.org/) |
| Street data | [Geofabrik](https://download.geofabrik.de/) OSM extracts (auto-downloaded, cached) |
| Frontend | React + Vite + MapLibre GL + Zustand + Tailwind CSS |
| Backend | Node.js + Express |
| Container | Docker Compose |

---

## Server Setup

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone the repo

```bash
git clone https://github.com/zekicandemiralay/Quarc_Maps.git
cd Quarc_Map
```

### 3. Configure

```bash
cp .env.example .env
nano .env
```

Fill in these values:

| Key | Where to get it |
|---|---|
| `MAPTILER_API_KEY` | [maptiler.com](https://maptiler.com) — free, 100k tiles/month |
| `ORS_API_KEY` | [openrouteservice.org](https://openrouteservice.org) — free, 2000 req/day |
| `TRANSITLAND_API_KEY` | [transit.land](https://transit.land) — free, needs account |
| `MDB_REFRESH_TOKEN` | [mobilitydatabase.org](https://mobilitydatabase.org) — optional fallback |
| `SERVER_IP` | Your server's LAN IP — run `hostname -I \| awk '{print $1}'` |

Ports (defaults work fine, change if needed):

| Key | Default | Description |
|---|---|---|
| `FRONTEND_PORT` | `7300` | HTTPS — main app + cert download at `/cert` |

### 4. Start

```bash
docker compose up -d
```

App is live at `https://<SERVER_IP>:7300`

**First visit:** go to `http://<SERVER_IP>:7300/cert` (plain HTTP — no warning) to download the certificate, install it on your device, and all HTTPS connections to port 7300 are trusted permanently. See [README_Users.md](README_Users.md) for per-device instructions.

### 5. Update

```bash
git pull origin main
docker compose up -d --build
```

---

## Transit routing

Transit data downloads automatically the first time you request a transit route for any city:

1. Backend detects the city from your route's origin coordinates
2. Finds all GTFS feeds for that region via Transitland (primary) and MobilityData (fallback)
3. Downloads OSM street data from Geofabrik — **cached, never re-downloaded**
4. Builds an OpenTripPlanner routing graph (~5–15 min first time)
5. **Re-downloads GTFS feeds weekly** to keep schedules current

The app shows a progress card while data is downloading. No manual data management needed.

---

## Installing the certificate

The app uses a self-signed TLS certificate so GPS and other browser features work on phones. You need to install it once per device. Pick your platform:

---

### iPhone / iPad

1. Open **Safari** *(must be Safari, not Chrome)*
2. Go to `http://<SERVER_IP>:7303/cert`
3. A prompt asks if you want to allow the download — tap **Allow**
4. Open the **Settings** app
5. You will see a banner at the top: **"Profile Downloaded"** — tap it
6. Tap **Install** in the top-right corner
7. Enter your passcode if asked
8. Tap **Install** again on the warning screen → tap **Done**
9. Go to **Settings → General → About**
10. Scroll to the very bottom → tap **Certificate Trust Settings**
11. Find **Quarc Maps** → toggle it **ON** → tap **Continue**

Now open `https://<SERVER_IP>:7300` in Safari.

**Add to Home Screen** (recommended — gives a full-screen, app-like experience):
- Tap the **Share** button (square with arrow) at the bottom of Safari
- Tap **Add to Home Screen** → **Add**

> **Tip:** "Certificate Trust Settings" only appears after you complete steps 4–9 via Settings. If you don't see it, re-do those steps.

---

### Android

1. Open **Chrome**
2. Go to `http://<SERVER_IP>:7303/cert`
3. The file downloads automatically (check the notification bar)
4. Open **Settings → Security**
   - Samsung: **Biometrics and Security → More security settings**
   - Stock Android: **Security & privacy → More security settings**
5. Tap **Install a certificate → CA certificate → Install anyway**
6. Select the downloaded `cert.crt` file

Open `https://<SERVER_IP>:7300` in Chrome.

**Add to Home Screen** (recommended):
- Tap the **three-dot menu** → **Add to Home screen** → **Add**

> On some Android versions the path is: **Settings → Security & privacy → More security settings → Install a certificate**

---

### Mac

1. Go to `http://<SERVER_IP>:7303/cert` — `cert.crt` downloads automatically
2. Double-click `cert.crt` — **Keychain Access** opens
3. Double-click the **Quarc Maps** certificate in the list
4. Expand the **Trust** section at the top
5. Set **"When using this certificate"** to **Always Trust**
6. Close the window → enter your Mac password to confirm

Open `https://<SERVER_IP>:7300` in Safari or Chrome.

---

### Windows

1. Go to `http://<SERVER_IP>:7303/cert` — `cert.crt` downloads automatically
2. Double-click `cert.crt`
3. Click **Install Certificate**
4. Select **Local Machine** → click **Next** *(allow admin prompt if it appears)*
5. Select **"Place all certificates in the following store"** → click **Browse**
6. Select **Trusted Root Certification Authorities** → **OK**
7. Click **Next** → **Finish** → **OK**

Open `https://<SERVER_IP>:7300` in Chrome or Edge.

---

### Linux

```bash
# Download
curl -o quarc-maps.crt http://<SERVER_IP>:7303/cert

# Install system-wide (Ubuntu/Debian)
sudo cp quarc-maps.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates

# Chrome/Chromium also needs it in its own store
certutil -d sql:$HOME/.pki/nssdb -A -t "CT,," -n "Quarc Maps" -i quarc-maps.crt
```

Open `https://<SERVER_IP>:7300`.

---

### Quick bypass (no install)

If you just want to access the app without installing the certificate:

- **Chrome / Edge:** Click anywhere on the warning page and type `thisisunsafe` (no input field — just type it). The page loads immediately.
- **Firefox:** Click **Advanced** → **Accept the Risk and Continue**
- **Safari:** Click **Show Details** → **visit this website** → **Visit Website**

> This bypasses the warning for the current session only. GPS location will not work with this method on mobile.

---

## Features

- **Auto transit** — any city with GTFS coverage works automatically on first use
- **Weekly GTFS refresh** — schedules stay current; OSM data never re-downloaded
- **Mobile-optimised** — drag-up bottom sheet on phones, full sidebar on desktop
- **Location detection** — IP geolocation on load, GPS overrides if granted (requires HTTPS)
- **Modes** — Car · Bike · Walk · Transit
- **Transit planner** — Depart now / Depart at / Arrive by with date + time picker
- **Multiple itineraries** — compare transit options side by side
- **Search history** — remembered in all location inputs
- **Right-click / long-press map** → set as origin or destination
- **Dark / light mode**
- **Satellite toggle**

---

## Debug

Check transit pipeline status for any location:

```
GET http://<SERVER_IP>:7301/debug/transit?lat=52.5&lng=13.4
```

Returns: geocode result, GTFS feed discovery, OTP status, and data directory contents.
