import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Poke } from 'poke';

import { requestLogger } from './middleware/requestLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_LOG = path.resolve(__dirname, '../../.cursor/debug.log');
const dbg = (loc, msg, data, hid) => { try { fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true }); fs.appendFileSync(DEBUG_LOG, JSON.stringify({location:loc,message:msg,data,timestamp:Date.now(),hypothesisId:hid})+'\n'); } catch(_){} };
const MCP_DIR = path.resolve(__dirname, '../mac_messages_mcp');
const GET_MESSAGES_SCRIPT = path.join(MCP_DIR, 'get_messages_cli.py');

const app = express();
app.use(express.json());
app.use(requestLogger);

const PORT = process.env.PORT ?? 3000;
const POKE_WEBHOOK_URL = 'https://poke.com/api/v1/inbound-sms/webhook';

/** Block-signal: pending request_ids (client not blocked; callback validates and clears). */
const pendingPokeAgentRequestIds = new Set();

function randomUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

const DEFAULT_POKE_PROMPT = `This is an API request. The caller will display your response in a mobile app. You MUST return the summary as text in your response—do NOT use send_message, tool_send_message, or any tool that sends to iMessage/SMS. If you send a message, the app will show only "Message sent successfully" instead of your summary.

Using the Messages I've provided above plus your calendar, reminders, photos, and other integrations, create a brief summary of my last 7 days. Output the summary directly in your reply. Format day by day with the top 5 interesting things. Include a short prompt to record a video/voice reflection. Keep it concise and scannable.`;

/**
 * Fetch recent messages from Mac Messages via mac_messages_mcp.
 * @param {number} hours - Hours to look back (default 168 = 7 days)
 * @param {string} [contact] - Optional contact filter
 * @returns {Promise<{ok: boolean, messages?: string, error?: string}>}
 */
async function fetchMessages(hours = 168, contact) {
  return new Promise((resolve) => {
    const args = ['run', 'python', 'get_messages_cli.py', String(hours)];
    if (contact && String(contact).trim()) {
      args.push(String(contact).trim());
    }
    const proc = spawn('uv', args, {
      cwd: MCP_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk) => { stdout += chunk; });
    proc.stderr?.on('data', (chunk) => { stderr += chunk; });
    proc.on('close', (code) => {
      try {
        const data = JSON.parse(stdout || '{}');
        if (data.ok && typeof data.messages === 'string') {
          resolve({ ok: true, messages: data.messages });
        } else {
          resolve({
            ok: false,
            messages: '',
            error: data.error || stderr || `exit code ${code}`,
          });
        }
      } catch {
        resolve({
          ok: false,
          messages: '',
          error: stderr || stdout || `exit code ${code}`,
        });
      }
    });
    proc.on('error', (err) => {
      resolve({ ok: false, messages: '', error: err.message });
    });
  });
}

app.get('/', (req, res) => {
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/poke/health', (req, res) => {
  const apiKey = process.env.POKE_API_KEY;
  if (apiKey) {
    res.status(200).json({ ok: true, poke: 'configured' });
  } else {
    res.status(503).json({ ok: false, poke: 'missing POKE_API_KEY' });
  }
});

/**
 * GET /messages
 * Retrieve recent messages from Mac Messages via mac_messages_mcp.
 * Query params: hours (default 168 = 7 days), contact (optional)
 */
app.get('/messages', async (req, res) => {
  const hours = Math.min(Math.max(1, parseInt(req.query.hours, 10) || 168), 24 * 365);
  const contact = typeof req.query.contact === 'string' ? req.query.contact.trim() : undefined;
  try {
    const result = await fetchMessages(hours, contact || undefined);
    if (result.ok) {
      res.json({ ok: true, messages: result.messages });
    } else {
      res.status(502).json({
        ok: false,
        error: result.error || 'Failed to fetch messages',
      });
    }
  } catch (err) {
    console.error('Messages fetch failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/poke/send', async (req, res) => {
  const apiKey = process.env.POKE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'POKE_API_KEY is not configured',
    });
  }

  let message =
    typeof req.body?.message === 'string' && req.body.message.trim() !== ''
      ? req.body.message.trim()
      : DEFAULT_POKE_PROMPT;

  const includeMessages = req.body?.include_messages === true;

  if (includeMessages) {
    const hours = Math.min(Math.max(1, parseInt(req.body?.message_hours, 10) || 168), 24 * 365);
    const contact = typeof req.body?.message_contact === 'string' ? req.body.message_contact.trim() : undefined;
    const msgResult = await fetchMessages(hours, contact || undefined);
    if (msgResult.ok && msgResult.messages && msgResult.messages.trim()) {
      message = `Here are my recent Messages (last ${hours} hours):\n\n${msgResult.messages}\n\n---\n\n${message}`;
    }
  }

  try {
    const pokeRes = await fetch(POKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const contentType = pokeRes.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const body = isJson ? await pokeRes.json() : await pokeRes.text();

    res.status(pokeRes.status).send(body);
  } catch (err) {
    console.error('Poke request failed:', err);
    res.status(502).json({
      ok: false,
      error: 'Failed to reach Poke API',
      details: err.message,
    });
  }
});

app.post('/poke/webhook', (req, res) => {
  if (req.body && Object.keys(req.body).length > 0) {
    console.debug('Poke webhook payload:', req.body);
  }
  res.status(200).json({ ok: true });
});

/**
 * POST /poke/agent
 * Send a message to the Poke AI agent. Returns immediately with 202 and request_id so the
 * client is not blocked. When the user has the reply (e.g. from Messages), the client
 * calls POST /poke/callback with request_id and message to complete the flow.
 */
app.post('/poke/agent', async (req, res) => {
  const t0 = Date.now();
  dbg('backend/index.js:poke/agent:entry', 'poke/agent received', { bodyKeys: req.body ? Object.keys(req.body) : [] }, 'H4');

  const apiKey = process.env.POKE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'POKE_API_KEY is not configured',
    });
  }

  const requestId =
    typeof req.body?.request_id === 'string' && req.body.request_id.trim() !== ''
      ? req.body.request_id.trim()
      : randomUUID();

  pendingPokeAgentRequestIds.add(requestId);

  const text =
    typeof req.body?.message === 'string' && req.body.message.trim() !== ''
      ? req.body.message.trim()
      : DEFAULT_POKE_PROMPT;
  console.log('Poke request body:', { ...req.body, requestId });

  const includeMessages = req.body?.include_messages === true;
  let message = text;

  if (includeMessages) {
    const hours = Math.min(Math.max(1, parseInt(req.body?.message_hours, 10) || 168), 24 * 365);
    const contact = typeof req.body?.message_contact === 'string' ? req.body.message_contact.trim() : undefined;
    const msgResult = await fetchMessages(hours, contact || undefined);
    if (msgResult.ok && msgResult.messages && msgResult.messages.trim()) {
      message = `Here are my recent Messages (last ${hours} hours):\n\n${msgResult.messages}\n\n---\n\n${message}`;
    }
  }

  message = `${message}\n\nRequest ID: ${requestId}`;

  try {
    dbg('backend/index.js:before poke.sendMessage', 'calling Poke', { messageLen: message?.length, requestId }, 'H1');
    const poke = new Poke({ apiKey });
    poke.sendMessage(message).catch((err) => {
      console.error('[Poke Agent] sendMessage failed:', err);
    });
    res.status(202).json({ request_id: requestId, accepted: true });
  } catch (err) {
    pendingPokeAgentRequestIds.delete(requestId);
    dbg('backend/index.js:poke/agent:catch', 'Poke threw', { errMessage: err?.message, durationMs: Date.now() - t0 }, 'H5');
    console.error('[Poke Agent] Error:', err);
    res.status(502).json({
      ok: false,
      error: 'Failed to reach Poke agent',
      details: err.message,
    });
  }
});

/**
 * POST /poke/callback
 * Client (phone) calls this with the agent's reply after the user pastes the summary.
 * Body: { request_id: string, message: string } (or requestId).
 */
app.post('/poke/callback', (req, res) => {
  const requestId =
    typeof req.body?.request_id === 'string' && req.body.request_id.trim() !== ''
      ? req.body.request_id.trim()
      : typeof req.body?.requestId === 'string' && req.body.requestId.trim() !== ''
        ? req.body.requestId.trim()
        : null;

  if (!requestId) {
    return res.status(400).json({ ok: false, error: 'Missing request_id' });
  }

  if (!pendingPokeAgentRequestIds.has(requestId)) {
    return res.status(404).json({ ok: false, error: 'Unknown or already used request_id' });
  }

  pendingPokeAgentRequestIds.delete(requestId);
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
