# Nextup Hub: Android app

The `android/` folder is the phone app. It shows the same screens as this dashboard, with the hub
address built in: nobody sees it or can change it on the phone.

## 1. Set the hub address (once)

Open `.env.mobile` in Notepad and put your Render address:

```
VITE_HUB_URL=https://your-service.onrender.com
```

## 2. Build the APK

You need **Android Studio** (free; it brings Java and the Android SDK) and **Node 18+**.

1. Put the signing key in `android/`: unzip `nextup-hub-signing-key.zip` there, so you have
   `android\nextup-hub.jks` and `android\keystore.properties`. Keep this key safe and private.
2. In this folder (the dashboard folder), in a terminal:
   ```
   npm install
   npm run android
   ```
3. In Android Studio: **File → Open** → pick the `android` folder. Wait until it finishes syncing.
4. In Android Studio's **Terminal** tab (bottom):
   ```
   .\gradlew assembleRelease
   ```
   (on Mac or Linux: `./gradlew assembleRelease`)
5. The app is `android\app\build\outputs\apk\release\app-release.apk`.

## 3. Hand it out

Send the APK by WhatsApp, Drive or email. On the phone, tap it and allow **Install unknown apps**
for the app it was opened from. Google Play Protect may say the developer is unknown: tap
**More details → Install anyway**. Works on Android 7 and newer.

## Updating the app

1. In `android/app/build.gradle`, raise `versionCode` (1 → 2 → 3…) and `versionName`.
2. Build again with **the same signing key**. Phones install it over the old one and stay signed in.
   (A different key means everyone has to uninstall first.)

A new hub address also means a new APK: change `.env.mobile`, then repeat step 2.

## About the hidden address

The address is never shown or editable in the app, but it is not a secret: anyone who unpacks the
APK or watches their phone's network traffic can find it. That is true of every app. What keeps the
hub safe is on the server: every request needs a signed-in account, roles are checked on every
call, and sign-in is rate limited. Don't put passwords or keys in `.env.mobile`.

## What works on the phone

- Everything in the dashboard, laid out for a phone: a tab bar at the bottom for the main pages, and a
  menu (☰, or **More**) with your profile, the other pages, dark mode, refresh and sign out. The back
  button closes the menu or goes back a page.
- One loading screen when the app opens or after sign-in that loads everything at once (main pages,
  then every project, client, robot and asset tree, with a progress ring); after that pages open
  instantly and refresh themselves in the background when something changes on the hub.
- A calmer phone look (`src/mobile.css`): plain labels, rounder cards, sideways chip rows, dialogs
  that slide up from the bottom and light animations. The desktop is unchanged.
- Phone numbers, email, WhatsApp and websites open in the phone's own apps.
- CSV exports and templates save to **Downloads** (Android 10+) or open the share sheet (older).
- Bulk import can pick a CSV file from the phone.
- **Settings → Alerts → Turn on** gives phone notifications for new enquiries and bug reports while
  the app is open or was used a moment ago. Android stops apps in the background, so for alerts at
  any time keep Telegram on.

## Files

- `.env.mobile`: the hub address for the app
- `scripts/build-android.mjs`: `npm run android` (builds the screens into `android/app/src/main/assets/www`)
- `src/native.js`: what the screens do differently inside the app
- `android/app/src/main/java/com/nextuprobotics/hub/`: the app itself (a WebView; no extra libraries)
