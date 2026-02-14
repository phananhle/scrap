# Scrap

Using Poke AI to journal succint and furnished videos to share with close friends and family.

## Run the backend

From the repo root, start the backend first (for the "Send notification" button):

```bash
cd backend && npm install && npm run dev
```

Runs at `http://localhost:3000`. Use `EXPO_PUBLIC_API_URL` in the mobile app to point to this URL (or your machine's LAN IP when using a physical device).

## Run the app (Expo)

From the repo root:

```bash
npm start
```

Or run the Expo app from the mobile folder:

```bash
cd mobile && npx expo start
```

Set `EXPO_PUBLIC_API_URL` so the app hits the backend (e.g. copy `mobile/.env.example` to `mobile/.env` and set the URL). Then press `i` for iOS simulator or scan the QR code with Expo Go.