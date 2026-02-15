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
| `/poke/send` | POST | Forward `{ "message": "..." }` to Poke. Add `"include_messages": true` to fetch recent Mac Messages and prepend them to the prompt. Optional: `message_hours` (default 168), `message_contact`. |
| `/poke/agent` | POST | Send a message to the Poke AI agent via the [poke](https://www.npmjs.com/package/poke) SDK. Same body as `/poke/send`. Response is **logged to console** only (placeholder; no frontend integration yet). |
| `/poke/webhook` | POST | Placeholder for Poke outbound webhooks |
| `/poke/health` | GET | Check that `POKE_API_KEY` is configured |

### Messages routes (mac_messages_mcp)

| Route | Method | Description |
|-------|--------|-------------|
| `/messages` | GET | Retrieve recent Mac Messages via `mac_messages_mcp`. Query: `hours` (default 168), `contact` (optional). Requires `uv` and local `mac_messages_mcp` at `../mac_messages_mcp`. |

### Exposing Mac Messages MCP to Poke

`mac_messages_mcp` uses stdio; Poke requires HTTP at `/mcp`. From `scrap/`:

1. Install ngrok CLI (required for `--ngrok`): `brew install ngrok`
2. Run the proxy with ngrok:

```bash
./scripts/start-mcp-proxy.sh --ngrok
```

Starts the MCP proxy and ngrok in one command. Copy the ngrok URL (e.g. `https://abc123.ngrok-free.app`) and add it in Poke at [poke.com/settings/connections/integrations/new](https://poke.com/settings/connections/integrations/new) as `https://<ngrok-host>/mcp`. Test in Poke: e.g. "Use the mac-messages integration's tool_send_message tool to..."

Without `--ngrok`, runs only the proxy on port 8000 (for local use).

### Backend message retrieval

The backend can retrieve Mac Messages and include them in Poke prompts without running the MCP proxy:

1. Ensure `mac_messages_mcp` is at `../mac_messages_mcp` and has `uv` installed (`brew install uv`).
2. Run `uv sync` in `mac_messages_mcp` (or `uv pip install -e .`).
3. Grant Full Disk Access to your terminal/Node process for Messages DB access.
4. Call `GET /messages?hours=168` or `POST /poke/send` with `{ "include_messages": true }`.

## TODO

- [x] **Poke agent frontend integration**: `POST /poke/agent` uses the official [poke](https://www.npmjs.com/package/poke) SDK to send messages to the Poke AI agent. The agent response is returned to the client and wired to the mobile app via `journalService.getPrimingText()` → `usePriming` → priming text UI.
