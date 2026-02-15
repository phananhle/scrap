import dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { google } from 'googleapis';
import { Poke } from 'poke';

import { requestLogger } from './middleware/requestLogger.js';
import { fetchEmails } from './gmail-api/fetchEmails.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env: backend/.env first (so Google Calendar vars here are used), then scrap/.env for shared vars
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const DEBUG_LOG = path.resolve(__dirname, '../../.cursor/debug.log');
const dbg = (loc, msg, data, hid) => { try { fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true }); fs.appendFileSync(DEBUG_LOG, JSON.stringify({location:loc,message:msg,data,timestamp:Date.now(),hypothesisId:hid})+'\n'); } catch(_){} };
const MCP_DIR = path.resolve(__dirname, '../mac_messages_mcp');
const GET_MESSAGES_SCRIPT = path.join(MCP_DIR, 'get_messages_cli.py');

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

const PORT = process.env.PORT ?? 3000;
const POKE_WEBHOOK_URL = 'https://poke.com/api/v1/inbound-sms/webhook';

const POKE_MESSAGES_CONTACT = (process.env.POKE_MESSAGES_CONTACT || 'Poke').trim();
const POKE_POLL_INTERVAL_MS = Math.max(2000, parseInt(process.env.POKE_POLL_INTERVAL_MS, 10) || 5000);
const POKE_POLL_TIMEOUT_MS = Math.min(600000, Math.max(15000, parseInt(process.env.POKE_POLL_TIMEOUT_MS, 10) || 180000));
const POKE_FIRST_POLL_DELAY_MS = Math.max(0, parseInt(process.env.POKE_FIRST_POLL_DELAY_MS, 10) || 5000);

/**
 * Block-signal: pending request_ids for paste fallback when Mac polling times out.
 * Used only by POST /poke/callback—does not affect Poke send or poll loop latency.
 */
const pendingPokeAgentRequestIds = new Set();

const APPLE_EPOCH_MS = new Date('2001-01-01T00:00:00Z').getTime();
function appleTimestampToMs(appleNanos) {
  if (appleNanos == null || typeof appleNanos !== 'number') return 0;
  return (appleNanos / 1e9) * 1000 + APPLE_EPOCH_MS;
}

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

/**
 * Fetch the single most recent message from a contact via get_latest_message_cli.py.
 * @param {string} contact - Contact name (e.g. "Poke")
 * @param {number} hours - Hours to look back (default 1)
 * @returns {Promise<{ok: boolean, body?: string, is_from_me?: boolean, date?: number, error?: string}>}
 */
async function fetchLatestMessageFromContact(contact, hours = 1) {
  return new Promise((resolve) => {
    const args = ['run', 'python', 'get_latest_message_cli.py', String(contact).trim(), String(hours)];
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
        if (data.ok && typeof data.body === 'string') {
          resolve({
            ok: true,
            body: data.body,
            is_from_me: Boolean(data.is_from_me),
            date: typeof data.date === 'number' ? data.date : undefined,
          });
        } else {
          resolve({ ok: false, error: data.error || stderr || `exit code ${code}` });
        }
      } catch {
        resolve({ ok: false, error: stderr || stdout || 'Invalid JSON' });
      }
    });
    proc.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

/**
 * Fetch the user's Google Calendar events from the last h hours through now.
 * Uses the Calendar API (https://developers.google.com/workspace/calendar/api) with the
 * user's OAuth access token. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (same
 * GCP project as the app that issued the token).
 * @param {string} accessToken - User's OAuth2 access token (e.g. from Authorization header)
 * @param {number} hours - Number of hours back from now to fetch events (default 24)
 * @returns {Promise<{ok: boolean, events?: Array<{summary: string, start: string, end: string}>, error?: string}>}
 */
async function fetchGcalEvents(accessToken, hours = 24) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for Google Calendar',
    };
  }
  const hoursClamped = Math.min(Math.max(1, Math.floor(Number(hours) || 24)), 24 * 365);
  const timeMax = new Date();
  const timeMin = new Date(timeMax.getTime() - hoursClamped * 60 * 60 * 1000);
  const GCAL_TIMEOUT_MS = 20000;
  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const listPromise = calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Google Calendar API timeout')), GCAL_TIMEOUT_MS)
    );
    const response = await Promise.race([listPromise, timeoutPromise]);
    const items = response.data.items || [];
    const events = items.map((e) => ({
      summary: e.summary || '(No title)',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      id: e.id,
      ...(e.location ? { location: e.location } : {}),
    }));
    return { ok: true, events };
  } catch (err) {
    const message = err.message || String(err);
    return {
      ok: false,
      error: message,
    };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

/**
 * GET /gcal/events
 * Retrieve the user's Google Calendar events from now through the next h hours.
 * Requires Authorization: Bearer <access_token> (user's OAuth2 access token from Google Sign-In).
 * Query params: hours (default 24, max 8760).
 */
app.get('/gcal/events', async (req, res) => {
  console.log('[GCal] GET /gcal/events hit', { query: req.query, hasAuth: !!req.get('Authorization') });
  const authHeader = req.get('Authorization');
  const token =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, '').trim()
      : null;
  if (!token) {
    console.log('[GCal] 401 - no Bearer token');
    return res.status(401).json({
      ok: false,
      error: 'Missing or invalid Authorization header. Use: Bearer <access_token>',
    });
  }
  const hours = Math.min(
    Math.max(1, parseInt(req.query.hours, 10) || 24),
    24 * 365
  );
  try {
    const fetchGcal = app.locals.fetchGcalEvents ?? fetchGcalEvents;
    const result = await fetchGcal(token, hours);
    if (result.ok) {
      console.log('GCal events retrieved:', result.events);
      return res.json({ ok: true, events: result.events });
    }
    const status = result.error?.includes('credentials') || result.error?.includes('invalid')
      ? 401
      : 502;
    return res.status(status).json({ ok: false, error: result.error });
  } catch (err) {
    console.error('GCal fetch failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

const GEMINI_DIR = path.resolve(__dirname, 'gemini');
const SUMMARIZE_SCRIPT = path.join(GEMINI_DIR, 'summarize.py');
const SUMMARIZE_WITH_GCAL_SCRIPT = path.join(GEMINI_DIR, 'summarize_with_gcal.py');

/**
 * Format gcal events as text for Gemini summarizer (e.g. "Feb 14 10am – Team standup (30min) @ Room 101").
 */
function formatGcalEventsAsText(events) {
  if (!Array.isArray(events) || events.length === 0) return '';
  return events
    .map((e) => {
      const d = e.start ? new Date(e.start) : null;
      const dateStr = d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      const duration = e.start && e.end ? Math.round((new Date(e.end) - new Date(e.start)) / 60000) : null;
      const durStr = duration ? ` (${duration}min)` : '';
      const loc = e.location ? ` @ ${e.location}` : '';
      return `${dateStr} – ${e.summary || '(No title)'}${durStr}${loc}`;
    })
    .join('\n');
}

/**
 * Run summarize_with_gcal.py: fetch GCal in Python and summarize with Gemini.
 * Uses --token and --hours; returns { ok, summary?, error? }.
 * Waits for the subprocess to exit before resolving.
 */
async function runSummarizeWithGcal(accessToken, hours = 24) {
  const hoursClamped = Math.min(Math.max(1, Math.floor(Number(hours) || 24)), 24 * 365);
  const startedAt = Date.now();
  console.log('[runSummarizeWithGcal] start', { hours: hoursClamped });

  return new Promise((resolve) => {
    const py = path.join(GEMINI_DIR, '.venv', 'bin', 'python');
    const useVenv = fs.existsSync(py);
    const pythonBin = useVenv ? py : 'python3';
    const proc = spawn(pythonBin, [SUMMARIZE_WITH_GCAL_SCRIPT, '--token', accessToken, '--hours', String(hoursClamped)], {
      cwd: GEMINI_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk) => { stdout += chunk; });
    proc.stderr?.on('data', (chunk) => { stderr += chunk; });
    proc.on('close', (code) => {
      const durationMs = Date.now() - startedAt;
      if (code === 0 && stdout.trim()) {
        console.log('[runSummarizeWithGcal] success', { code, durationMs, summaryLength: stdout.trim().length });
        resolve({ ok: true, summary: stdout.trim() });
      } else if (code === 0 && !stdout.trim()) {
        console.log('[runSummarizeWithGcal] success (no events)', { code, durationMs });
        resolve({ ok: true, summary: '(No calendar events in this period to summarize.)' });
      } else {
        const errMsg = stderr || stdout || `exit code ${code}`;
        console.warn('[runSummarizeWithGcal] failed', { code, durationMs, stderr: stderr.slice(0, 300) });
        resolve({ ok: false, error: errMsg });
      }
    });
    proc.on('error', (err) => {
      const durationMs = Date.now() - startedAt;
      console.error('[runSummarizeWithGcal] spawn error', { durationMs, message: err.message });
      resolve({ ok: false, error: err.message });
    });
  });
}

/**
 * Run Gemini summarizer with calendar and optional Gmail text. Returns summary string or error.
 * Waits for the subprocess to exit before resolving.
 */
async function runSummarize(calendarText, gmailText = '') {
  const calLen = (calendarText && calendarText.trim()) ? calendarText.trim().length : 0;
  const mailLen = (gmailText && gmailText.trim()) ? gmailText.trim().length : 0;
  const startedAt = Date.now();
  console.log('[runSummarize] start', { calendarChars: calLen, gmailChars: mailLen });

  return new Promise((resolve) => {
    const body = [];
    if (calendarText?.trim()) body.push('## Calendar\n' + calendarText.trim());
    if (gmailText?.trim()) body.push('## Gmail\n' + gmailText.trim());
    if (body.length === 0) {
      console.log('[runSummarize] skipped: no calendar or Gmail content');
      resolve({ ok: false, error: 'No calendar or Gmail content to summarize' });
      return;
    }
    const stdinData = body.join('\n\n');
    const py = path.join(GEMINI_DIR, '.venv', 'bin', 'python');
    const useVenv = fs.existsSync(py);
    const pythonBin = useVenv ? py : 'python3';
    console.log('[runSummarize] spawning', { python: pythonBin, script: SUMMARIZE_SCRIPT, stdinBytes: Buffer.byteLength(stdinData, 'utf8') });

    const proc = spawn(pythonBin, [SUMMARIZE_SCRIPT], {
      cwd: GEMINI_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (chunk) => { stdout += chunk; });
    proc.stderr?.on('data', (chunk) => { stderr += chunk; });
    proc.stdin?.end(stdinData, 'utf8');
    proc.on('close', (code) => {
      const durationMs = Date.now() - startedAt;
      if (code === 0 && stdout.trim()) {
        console.log('[runSummarize] success', { code, durationMs, summaryLength: stdout.trim().length });
        resolve({ ok: true, summary: stdout.trim() });
      } else {
        const errMsg = stderr || stdout || `exit code ${code}`;
        console.warn('[runSummarize] failed', { code, durationMs, stderr: stderr.slice(0, 300), stdout: stdout.slice(0, 200) });
        resolve({ ok: false, error: errMsg });
      }
    });
    proc.on('error', (err) => {
      const durationMs = Date.now() - startedAt;
      console.error('[runSummarize] spawn error', { durationMs, message: err.message });
      resolve({ ok: false, error: err.message });
    });
  });
}

/**
 * GET /gcal/summarize
 * Fetch Google Calendar events and summarize via Gemini (backend/gemini/summarize_with_gcal.py).
 * Requires Authorization: Bearer <access_token>. Query params: hours (default 24, max 8760).
 */
app.get('/gcal/summarize', async (req, res) => {
  const routeStartedAt = Date.now();
  const authHeader = req.get('Authorization');
  const token =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, '').trim()
      : null;
  if (!token) {
    console.log('[GET /gcal/summarize] 401 no token');
    return res.status(401).json({
      ok: false,
      error: 'Missing or invalid Authorization header. Use: Bearer <access_token>',
    });
  }
  const hours = Math.min(
    Math.max(1, parseInt(req.query.hours, 10) || 24),
    24 * 365
  );
  console.log('[GET /gcal/summarize] request', { hours });
  try {
    const runWithGcal = app.locals.runSummarizeWithGcal ?? runSummarizeWithGcal;
    const sumResult = await runWithGcal(token, hours);
    const durationMs = Date.now() - routeStartedAt;
    if (!sumResult.ok) {
      const status =
        sumResult.error?.includes('credentials') || sumResult.error?.includes('invalid') || sumResult.error?.includes('401')
          ? 401
          : 502;
      console.warn('[GET /gcal/summarize] error', { status, durationMs, error: sumResult.error?.slice(0, 200) });
      return res.status(status).json({ ok: false, error: sumResult.error });
    }
    console.log('[GET /gcal/summarize] 200', { durationMs, summaryLength: sumResult.summary?.length ?? 0 });
    return res.json({ ok: true, summary: sumResult.summary });
  } catch (err) {
    const durationMs = Date.now() - routeStartedAt;
    console.error('[GET /gcal/summarize] 500', { durationMs, message: err.message });
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /summarize
 * Fetch Google Calendar events (and optionally Gmail), then summarize via Gemini.
 * Calendar-only path uses summarize_with_gcal.py; with Gmail uses Node fetch + summarize.py.
 * Requires Authorization: Bearer <access_token>. Query params: hours (default 168), includeGmail (optional).
 */
app.get('/summarize', async (req, res) => {
  console.log('[GET /summarize] request received');
  const routeStartedAt = Date.now();
  const authHeader = req.get('Authorization');
  const token = authHeader && /^Bearer\s+/i.test(authHeader)
    ? authHeader.replace(/^Bearer\s+/i, '').trim()
    : null;
  if (!token) {
    console.log('[GET /summarize] 401 no token');
    return res.status(401).json({ ok: false, error: 'Missing or invalid Authorization header. Use: Bearer <access_token>' });
  }
  const hours = Math.min(Math.max(1, parseInt(req.query.hours, 10) || 168), 24 * 365);
  const includeGmail = req.query.includeGmail === 'true' || req.query.includeGmail === '1';
  console.log('[GET /summarize] request', { hours, includeGmail });

  try {
    if (!includeGmail) {
      const runWithGcal = app.locals.runSummarizeWithGcal ?? runSummarizeWithGcal;
      const sumResult = await runWithGcal(token, hours);
      const durationMs = Date.now() - routeStartedAt;
      if (!sumResult.ok) {
        const status = sumResult.error?.includes('credentials') || sumResult.error?.includes('invalid') || sumResult.error?.includes('401') ? 401 : 502;
        console.warn('[GET /summarize] error (calendar path)', { status, durationMs, error: sumResult.error?.slice(0, 200) });
        return res.status(status).json({ ok: false, error: sumResult.error });
      }
      console.log('[GET /summarize] 200', { durationMs, summaryLength: sumResult.summary?.length ?? 0 });
      return res.json({ ok: true, summary: sumResult.summary });
    }

    const fetchGcal = app.locals.fetchGcalEvents ?? fetchGcalEvents;
    const gcalResult = await fetchGcal(token, hours);
    if (!gcalResult.ok) {
      const status = gcalResult.error?.includes('credentials') || gcalResult.error?.includes('invalid') ? 401 : 502;
      console.warn('[GET /summarize] GCal fetch failed', { status, error: gcalResult.error });
      return res.status(status).json({ ok: false, error: gcalResult.error });
    }
    const calendarText = formatGcalEventsAsText(gcalResult.events || []);
    let gmailText = '';
    const after = Date.now() - hours * 60 * 60 * 1000;
    const emailResult = await fetchEmails(after, { maxResults: 50 });
    if (emailResult.ok && emailResult.emails?.length) {
      gmailText = emailResult.emails
        .map((e) => `From: ${e.from} | Subject: ${e.subject} | ${e.snippet || ''}`)
        .join('\n');
    }
    const sumResult = await runSummarize(calendarText, gmailText);
    const durationMs = Date.now() - routeStartedAt;
    if (!sumResult.ok) {
      console.warn('[GET /summarize] error (Gmail path)', { durationMs, error: sumResult.error?.slice(0, 200) });
      return res.status(502).json({ ok: false, error: sumResult.error || 'Gemini summarization failed' });
    }
    console.log('[GET /summarize] 200', { durationMs, summaryLength: sumResult.summary?.length ?? 0 });
    return res.json({ ok: true, summary: sumResult.summary });
  } catch (err) {
    const durationMs = Date.now() - routeStartedAt;
    console.error('[GET /summarize] 500', { durationMs, message: err.message });
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /gmail/emails
 * Fetch Gmail messages from a given timestamp to now.
 * Query params: after (required) - Unix ms, Unix s, or ISO date string; maxResults (optional, default 50, max 500)
 */
app.get('/gmail/emails', async (req, res) => {
  const afterRaw = req.query.after;
  if (afterRaw === undefined || afterRaw === '') {
    return res.status(400).json({ ok: false, error: 'Query param "after" is required (Unix timestamp or ISO date)' });
  }
  const after = /^\d+$/.test(String(afterRaw).trim()) ? parseInt(afterRaw, 10) : String(afterRaw).trim();
  const maxResults = Math.min(500, Math.max(1, parseInt(req.query.maxResults, 10) || 50));
  try {
    const result = await fetchEmails(after, { maxResults });
    if (result.ok) {
      res.json({ ok: true, emails: result.emails });
    } else {
      res.status(result.error?.includes('not configured') ? 503 : 502).json({
        ok: false,
        error: result.error || 'Failed to fetch emails',
      });
    }
  } catch (err) {
    console.error('Gmail fetch failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const SCRAP_RECAP_FILE = path.resolve(__dirname, '../scrap-mcp/data/recap-temp.json');

/**
 * GET /recap
 * Return the latest Scrap recap from the temp JSON file (written by scrap-mcp when Poke agent calls save_recap).
 */
app.get('/recap', (req, res) => {
  try {
    if (!fs.existsSync(SCRAP_RECAP_FILE)) {
      return res.status(404).json({ ok: false, error: 'No recap file yet' });
    }
    const raw = fs.readFileSync(SCRAP_RECAP_FILE, 'utf-8');
    const data = JSON.parse(raw);
    res.json({ ok: true, recap: data.recap ?? '', savedAt: data.savedAt ?? null });
  } catch (err) {
    console.error('Recap read failed:', err);
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
 * Send a message to the Poke AI agent, then poll Mac Messages for the latest reply from
 * POKE_MESSAGES_CONTACT. Returns 200 with the message when found, or 504 on timeout
 * (client can use paste fallback via POST /poke/callback).
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
    await poke.sendMessage(message);
  } catch (err) {
    pendingPokeAgentRequestIds.delete(requestId);
    dbg('backend/index.js:poke/agent:catch', 'Poke threw', { errMessage: err?.message, durationMs: Date.now() - t0 }, 'H5');
    console.error('[Poke Agent] Error:', err);
    return res.status(502).json({
      ok: false,
      error: 'Failed to reach Poke agent',
      details: err.message,
    });
  }

  await sleep(POKE_FIRST_POLL_DELAY_MS);
  const deadline = t0 + POKE_POLL_TIMEOUT_MS;

  const fetchLatest = app.locals.fetchLatestMessageFromContact ?? fetchLatestMessageFromContact;
  // Poll loop: block until incoming message found or timeout. Block-signal (callback) is paste fallback only.
  while (Date.now() < deadline) {
    const latest = await fetchLatest(POKE_MESSAGES_CONTACT, 1);
    if (latest.ok && latest.body && !latest.is_from_me) {
      const messageMs = appleTimestampToMs(latest.date);
      if (messageMs >= t0) {
        pendingPokeAgentRequestIds.delete(requestId);
        dbg('backend/index.js:poke/agent:reply', 'Reply from Messages', { requestId, bodyLen: latest.body.length });
        return res.status(200).json({ success: true, message: latest.body });
      }
    }
    await sleep(POKE_POLL_INTERVAL_MS);
  }

  return res.status(504).json({
    ok: false,
    error: 'Poke agent reply not seen in Messages before timeout. Use paste fallback if the reply arrived.',
    request_id: requestId,
  });
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (0.0.0.0)`);
  });
}
export { app, pendingPokeAgentRequestIds, fetchGcalEvents, runSummarize, runSummarizeWithGcal };
