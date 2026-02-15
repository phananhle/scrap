import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

const PORT = parseInt(process.env.PORT || "8787", 10);
const DATA_DIR = join(process.cwd(), "data");
const RECAP_FILE = join(DATA_DIR, "recap-temp.json");

const SCRAP_PROTOCOL = `SCRAP PROTOCOL — follow in order. Do not skip step 1.

1. FETCH ACTUAL CONTENTS (required)
   Retrieve the user's real data from every integration you have: calendar (events, past 3–7 days), reminders, Google, notes, recent messages. Build the full list with dates and sources (e.g. "Feb 14 – Calendar: Team standup", "Reminder: Book dinner"). Do NOT use placeholders. If you have no access, say so and ask the user to paste recent activity.

2. SAVE THE RECAP TO JSON (do not send the full recap back in chat)
   Call save_recap with the full recap text (the complete list you fetched). The server saves it to a temporary JSON file (data/recap-temp.json). In chat, only confirm that you saved it — do not paste the full recap into the conversation.

3. BUILD THE PRIMER
   Turn the recap into a short, shareable primer (3–7 bullets). Use get_primer_template for structure. Every bullet must come from the saved recap or user additions. Show only this short primer in chat and ask: "What do you want to add or change?"

4. AFTER USER INPUT
   Once they confirm or edit, call get_share_suggestions_prompt: suggest people to share with and help draft messages.`;

const PRIMER_TEMPLATE = `PRIMER STRUCTURE (use as a guide when building the list):

• **Recent wins** — completed work, shipped things, achievements
• **What I'm working on** — current projects, goals
• **Personal / life** — trips, family, health, hobbies
• **Asks / could use help with** — optional

Keep each line one short phrase. The goal is a list the user can quickly scan and say "yes, that’s what I want to share" or "add X" or "drop Y."`;

const SHARE_SUGGESTIONS_PROMPT = `SUGGEST RECIPIENTS & DRAFT:

1. Based on the primer and the user's contacts (or recent conversations), suggest 2–5 people who would care about this update. Say why each person might be a good fit (e.g. "worked with you on X", "you haven’t touched base in a while").

2. For each suggested recipient, offer to draft a short message (1–3 sentences) that includes the relevant parts of the primer. Keep it casual and personal.

3. Ask the user which people they want to message and in what form (e.g. text, email, WhatsApp). Then help them send it.`;

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/recap") {
    res.setHeader("Content-Type", "application/json");
    if (!existsSync(RECAP_FILE)) {
      res.writeHead(404);
      res.end(JSON.stringify({ ok: false, error: "No recap file yet" }));
      return;
    }
    try {
      const raw = readFileSync(RECAP_FILE, "utf-8");
      const data = JSON.parse(raw);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, recap: data.recap ?? "", savedAt: data.savedAt ?? null }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }
  if (req.url === "/mcp" || req.url?.startsWith("/mcp?")) {
    const server = new McpServer(
      { name: "scrap-mcp", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    server.tool(
      "start_scrap",
      "Start a Scrap session. You MUST first fetch and show the user's actual contents: real calendar events, reminders, and any other activity from the past 3–7 days. Do not show a generic template — show the real list you retrieved, then build the primer from it. Call this when the user says 'run scrap', 'ping scrap', or wants to see what they did recently.",
      {},
      async () =>
        text(
          `Scrap session started.\n\n${SCRAP_PROTOCOL}\n\nBegin by actually fetching the user's calendar events, reminders, and any other data you have access to for the past 3–7 days. Show that real list first (with dates and sources), then build the primer from it. Do not reply with placeholders or a generic template.`
        )
    );

    server.tool(
      "get_primer_template",
      "Get the suggested structure for the Scrap primer list (sections and format). Use this when building the primer in step 2 of the Scrap protocol.",
      {},
      async () => text(PRIMER_TEMPLATE)
    );

    server.tool(
      "get_share_suggestions_prompt",
      "Get instructions for suggesting recipients and drafting share messages. Call this after the user has confirmed or edited their primer (step 4 of the Scrap protocol).",
      {},
      async () => text(SHARE_SUGGESTIONS_PROMPT)
    );

    server.tool(
      "save_recap",
      "Save the user's recap (full list of what they did in the past days, with dates and sources) to a JSON file on disk. Call this after you have fetched their actual calendar/reminders/activity — pass the full recap text. Do not return the full recap in chat; just confirm it was saved.",
      { recap: z.string().describe("Full recap text: list of activities with dates and sources") },
      async ({ recap }) => {
        try {
          mkdirSync(DATA_DIR, { recursive: true });
          const payload = {
            recap,
            savedAt: new Date().toISOString(),
          };
          writeFileSync(RECAP_FILE, JSON.stringify(payload, null, 2), "utf-8");
          return text(`Recap saved to ${RECAP_FILE}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return text(`Failed to save recap: ${msg}`);
        }
      }
    );

    const transport = new StreamableHTTPServerTransport({});
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } else {
    res.writeHead(404);
    res.end("Not found — MCP endpoint is at /mcp");
  }
});

httpServer.listen(PORT, () => {
  console.error(`scrap-mcp running at http://localhost:${PORT}/mcp`);
  console.error(`Tools: start_scrap, save_recap, get_primer_template, get_share_suggestions_prompt`);
  console.error(`\nNext: npx poke tunnel http://localhost:${PORT}/mcp --name "Scrap MCP"\n`);
});
