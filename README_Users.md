
### User Setup

The app is available at:

- **`https://100.115.252.65:7300`**

The app runs over HTTPS using a self-signed certificate (not from a public authority). You need to install and trust this certificate once on each device. After that, the app works like any normal website and can be added to your home screen like a native app.

---

### iPhone / iPad

#### Step 1 — Download the certificate

1. Open **Safari** (must be Safari, not Chrome)
2. Go to: `http://100.115.252.65:7300/cert`  
   *(use http, not https)*
3. A prompt appears asking if you want to allow the download — tap **Allow**

#### Step 2 — Install the profile

6. Open the **Settings** app
7. You will see a banner at the top: **"Profile Downloaded"** — tap it
8. Tap **Install** in the top-right corner
9. Enter your iPhone passcode if asked
10. Tap **Install** again on the warning screen
11. Tap **Done**

#### Step 3 — Enable full trust

12. Go to **Settings → General → About**
13. Scroll to the very bottom and tap **Certificate Trust Settings**
14. Find **Quarc Maps** and toggle it **ON**
15. Tap **Continue** on the warning

#### Step 4 — Open the app in Safari

16. Open **Safari** and go to: `https://100.115.252.65:7300`
17. The map loads immediately — no login needed

#### Step 5 — Add to Home Screen (optional but recommended)

Adding the app to your home screen gives you a full-screen experience with no browser UI, similar to a native app.

18. While on `https://100.115.252.65:7300` in Safari, tap the **Share** button (the square with an arrow pointing up, at the bottom of the screen)
19. Scroll down in the share sheet and tap **Add to Home Screen**
20. Edit the name if you like, then tap **Add** in the top-right corner
21. The Quarc Maps icon now appears on your home screen

> **Tip:** "Certificate Trust Settings" only appears after completing steps 6–11 through Settings. If you don't see it, make sure you installed the profile via the Settings banner, not just downloaded the file.

---

### Android

#### Step 1 — Download the certificate

1. Open **Chrome**
2. Go to: `http://100.115.252.65:7300/cert`  
   *(use http, not https)*
3. The file `cert.crt` downloads automatically (check your notification bar)

#### Step 2 — Install the certificate

6. Open the **Settings** app
7. Go to **Security** (may be under **Biometrics and Security** on Samsung)
8. Tap **More security settings** or **Advanced**
9. Tap **Install a certificate**
10. Tap **CA certificate**
11. Tap **Install anyway** on the warning
12. Find and select the downloaded `cert.crt` file
13. The certificate is installed

#### Step 3 — Open the app

14. Open **Chrome** and go to: `https://100.115.252.65:7300`
15. The map loads immediately — no login needed

#### Step 4 — Add to Home Screen (optional but recommended)

16. In Chrome, tap the **three-dot menu** (top-right)
17. Tap **Add to Home screen**
18. Tap **Add**
19. The icon appears on your home screen — tap it to open

> **Note:** On some Android versions the certificate path is different:  
> Settings → Security & privacy → More security settings → Install a certificate

---

### Mac (Safari or Chrome)

#### Step 1 — Download the certificate

1. Go to: `http://100.115.252.65:7300/cert`  
   *(use http, not https)*
2. The file `cert.crt` downloads automatically

#### Step 2 — Install and trust

4. Double-click `cert.crt` — **Keychain Access** opens
5. The certificate appears in the list — double-click it to open
6. Expand the **Trust** section at the top
7. Set **"When using this certificate"** to **Always Trust**
8. Close the window
9. Enter your Mac password to confirm

#### Step 3 — Open the app

10. Go to: `https://100.115.252.65:7300`
11. The map loads immediately — no login needed

---

### Windows

#### Step 1 — Download the certificate

1. Open Chrome and go to: `http://100.115.252.65:7300/cert`  
   *(use http, not https)*
2. The file `cert.crt` downloads automatically

#### Step 2 — Install the certificate

4. Double-click `cert.crt`
5. Click **Install Certificate**
6. Select **Local Machine** → click **Next**  
   *(If asked for administrator permission, click Yes)*
7. Select **"Place all certificates in the following store"** → click **Browse**
8. Select **Trusted Root Certification Authorities** → click **OK**
9. Click **Next** → click **Finish**
10. Click **OK** on the success message

#### Step 3 — Open the app

11. Go to: `https://100.115.252.65:7300` in Chrome or Edge
12. The map loads immediately — no login needed

---

### PC browser — quick bypass (no install)

If you just want to access the app without installing the certificate permanently:

- **Chrome / Edge:** Click anywhere on the warning page and type `thisisunsafe` (no input field — just type it). The page loads immediately.
- **Firefox:** Click **Advanced** → **Accept the Risk and Continue**
- **Safari (Mac):** Click **Show Details** → **visit this website** → **Visit Website**

> This only bypasses the warning for the current session. The warning reappears after restarting the browser. GPS location will **not** work with this method on mobile.

---

### How to use

- **Search** — type any address, city, or place in the search bar
- **Directions** — tap the directions icon or long-press/right-click any point on the map
- **Transit** — select the transit mode, then choose *Now*, *Depart at*, or *Arrive by* and pick a date and time
- **Your location** — the app detects your approximate location automatically; tap the locate button for precise GPS
- **Dark / light mode** — toggle in the top-right corner
- **Satellite view** — toggle in the top-right corner

---

### Troubleshooting

**"Your connection is not private" / certificate warning after installing**  
Make sure you completed all three steps: installed the profile, AND enabled full trust in Certificate Trust Settings (iPhone), or set Always Trust in Keychain Access (Mac), or installed in Trusted Root Certification Authorities (Windows).

**Certificate Trust Settings doesn't appear on iPhone**  
Make sure you installed the profile through Settings (steps 6–11 above), not just downloaded the file. The toggle only appears after the profile is properly installed.

**Transit shows "downloading data" for a long time**  
The first transit request for any city downloads GTFS schedule data and builds a routing graph. This takes 5–15 minutes. The app shows a progress message — just wait and try again after a few minutes.

**GPS location not working**  
GPS requires a trusted HTTPS connection. Make sure you have completed the full certificate install for your device. The quick bypass method does not enable GPS.

**Map doesn't load**  
Make sure you are connected to the same network as the server.
