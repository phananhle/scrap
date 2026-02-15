# Scrap

Scrap is the way to stay in touch with the people you love when you can’t be on the phone every day.


![Scrap Logo](./static/scrap_logo.jpg)
![Scrap MVP Screenshot](./static/mvp.jpg)




## Usage: Run the backend

From the repo root, start the backend first (for the "Send notification" button):

```bash
cd backend && npm install && npm run dev
```

Runs at `http://localhost:3000`. Use `EXPO_PUBLIC_API_URL` in the mobile app to point to this URL (or your machine's LAN IP when using a physical device).

## Usage: Run the app (Expo)

From the repo root:

```bash
npm start
```

Or run the Expo app from the mobile folder:

```bash
cd mobile && npx expo start
```

Set `EXPO_PUBLIC_API_URL` so the app hits the backend (e.g. copy `mobile/.env.example` to `mobile/.env` and set the URL). Then press `i` for iOS simulator or scan the QR code with Expo Go.