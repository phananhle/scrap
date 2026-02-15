import 'dotenv/config';
import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_DIR = path.resolve(__dirname, '../mac_messages_mcp');
const GET_MESSAGES_SCRIPT = path.join(MCP_DIR, 'get_messages_cli.py');

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;
const POKE_WEBHOOK_URL = 'https://poke.com/api/v1/inbound-sms/webhook';

const DEFAULT_POKE_PROMPT = `give me a summary of my last 7 days based on my calendar, reminders, photos, and similar with the top 5 interesting things that happened. give it to me day by day to make it easier to remind myself what i did and prompt me to provide a short video/voice message. both of this should then be used to create a summary of my last 7 days. in the next step i wanna send this to my closest friends.`;

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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
