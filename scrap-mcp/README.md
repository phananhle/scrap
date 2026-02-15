# scrap-mcp

MCP server for **Scrap**: when you ping it via Poke, the agent gathers your recent important stuff (from Google, reminders, calendar — whatever Poke can see), builds a short **primer** of what you can talk about, waits for your input, then suggests **people to share it with** and helps you draft messages.

## Flow

1. **Gather** — Agent pulls from all available context (calendar, reminders, Google, notes, recent chats).
2. **Primer** — Builds a short, scannable list (recent wins, what you’re working on, personal updates).
3. **Your input** — Presents the list and waits for you to confirm or edit.
4. **Share** — Suggests specific people to message and helps you draft and send updates.

## Quick start

```bash
npm install
npm run dev
```

In another terminal:

```bash
npx poke login
npx poke tunnel http://localhost:8787/mcp --name "Scrap MCP"
```

Connect the tunnel to your agent at [poke.com/integrations/new](https://poke.com/integrations/new).

## How to trigger it

Text your Poke agent something like:

- *"Run scrap"* / *"Ping scrap"*
- *"What should I tell people I've been up to?"*
- *"Build me a primer of what I did lately and who to share it with"*

The agent will call the Scrap MCP tools, follow the protocol (gather → primer → your input → suggest recipients and drafts), and guide you through the flow.

## Tools (for the agent)

| Tool | Purpose |
|------|--------|
| `start_scrap` | Start the full flow: gather context, build primer, wait for input, then suggest recipients and drafts. |
| `get_primer_template` | Get the suggested structure for the primer list. |
| `get_share_suggestions_prompt` | Get instructions for suggesting people and drafting messages (used after you confirm the primer). |

The more Poke knows (calendar, reminders, Google, contacts), the better the primer and suggestions.

## Logs

Logs go to **stderr** (the terminal where you run `npm run dev`) and to a file:

- **File:** `data/scrap-mcp.log` (next to the server, so `scrap-mcp/data/scrap-mcp.log`)

To watch logs in real time:

```bash
tail -f scrap-mcp/data/scrap-mcp.log
```

Useful when the server is started by the tunnel or in the background. You’ll see startup lines and each `save_recap` call.
