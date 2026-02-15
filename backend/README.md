# Scrap backend

Minimal API for the Scrap app.

## Run

```bash
npm install && npm run dev
```

Listens on port 3000. `POST /notifications/send` accepts optional `{ "title", "body" }` and returns `{ "ok": true }`.

## Poke.AI integration

The backend can forward messages to Poke via its inbound webhook API.

### Environment variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `POKE_API_KEY` | API key from [poke.com/settings/advanced](https://poke.com/settings/advanced) |
| `POKE_WEBHOOK_SECRET` | Optional; for verifying Poke outbound webhooks (future use) |

### Poke routes

| Route | Method | Description |
|-------|--------|-------------|
| `/poke/send` | POST | Forward `{ "message": "..." }` to Poke. Default prompt: 7-day recap (weekly_vibe, daily_breakdown, top_3_highlights, video_script_prompt, suggested_recipients). |
| `/poke/webhook` | POST | Placeholder for Poke outbound webhooks |
| `/poke/health` | GET | Check that `POKE_API_KEY` is configured |

### Exposing Mac Messages MCP to Poke

`mac_messages_mcp` uses stdio; Poke requires HTTP at `/mcp`. From `scrap/`:

1. Install ngrok CLI (required for `--ngrok`): `brew install ngrok`
2. Run the proxy with ngrok:

```bash
./scripts/start-mcp-proxy.sh --ngrok
```

Starts the MCP proxy and ngrok in one command. Copy the ngrok URL (e.g. `https://abc123.ngrok-free.app`) and add it in Poke at [poke.com/settings/connections/integrations/new](https://poke.com/settings/connections/integrations/new) as `https://<ngrok-host>/mcp`. Test in Poke: e.g. "Use the mac-messages integration's tool_send_message tool to..."

Without `--ngrok`, runs only the proxy on port 8000 (for local use).
