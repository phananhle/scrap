# Mobile (Expo / React Native)

iOS-focused Expo app with clear **backend/data** vs **frontend** separation.

## Structure

- **Backend (data layer)** — no UI, no `react-native` or `app/` imports:
  - `src/api/` — HTTP client, base URL, auth token
  - `src/services/` — user, auth (data retrieval and session)
  - `src/hooks/` — `useUser`, `useAuth` (expose data to UI)
  - `src/types/` — shared models (e.g. `User`, `AuthState`)

- **Frontend** — screens and presentational components only:
  - `app/` — Expo Router screens (thin: layout + hooks + components)
  - `src/components/` — presentational UI (e.g. `UserCard`); use `@/ui/*`
  - Root `components/`, `constants/` — template boilerplate

Screens call hooks (e.g. `useUser()`); hooks use services; services use `src/api`. UI only consumes hook results.

## Path aliases

- `@/api/*`, `@/services/*`, `@/hooks/*`, `@/types/*` — under `src/`
- `@/ui/*` — `src/components/*`
- `@/*` — project root (e.g. `@/components`, `@/constants`)

## Run

```bash
npm install
npm run ios    # or: npx expo start
```

Set `EXPO_PUBLIC_API_URL` for the API base URL when you add a real backend.
