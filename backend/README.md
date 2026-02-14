# Scrap backend

Minimal API for the Scrap app.

## Run

```bash
npm install && npm run dev
```

Listens on port 3000. `POST /notifications/send` accepts optional `{ "title", "body" }` and returns `{ "ok": true }`.
