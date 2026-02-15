import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";

const PORT = parseInt(process.env.PORT || "8787", 10);

const SCRAP_PROTOCOL = `SCRAP PROTOCOL — follow in order. Do not skip step 1.

1. FETCH ACTUAL CONTENTS (required)
   You MUST retrieve the user's real data first. Use every integration you have:
   - Calendar: list actual events from the past 3–7 days (title, date, time).
   - Reminders: list completed or due items from the past few days.
   - Google / notes / recent messages: any concrete activity you can read.
   Do NOT show a generic template or placeholders like "valentine's day plans" or "your recent work" without having pulled real items. If you have no access to calendar/reminders, say so clearly and ask the user to paste recent activity, or list only what you can actually see.

2. SHOW THE REAL LIST FIRST
   Present the actual contents you fetched: "Here's what I found from the past few days:" then list each item with date/source (e.g. "Feb 14 – Calendar: Team standup", "Reminder: Book dinner"). This is the raw input — the user must see their real data.

3. BUILD THE PRIMER FROM THAT
   Turn that real list into a short, shareable primer (3–7 bullets). Use get_primer_template only for structure. Every bullet must come from the actual contents you showed in step 2 (or user additions). Then ask: "What do you want to add or change?"

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
  console.error(`Tools: start_scrap, get_primer_template, get_share_suggestions_prompt`);
  console.error(`\nNext: npx poke tunnel http://localhost:${PORT}/mcp --name "Scrap MCP"\n`);
});
