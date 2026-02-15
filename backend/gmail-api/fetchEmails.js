import { getGmailClient } from './client.js';

/**
 * Convert a timestamp (ms or s) or ISO date string to Gmail search date (YYYY/MM/DD).
 * @param {number | string} after - Unix ms, Unix s, or ISO date string
 * @returns {string} Date string for Gmail query
 */
function toGmailDate(after) {
  let date;
  if (typeof after === 'number') {
    const ms = after < 1e12 ? after * 1000 : after;
    date = new Date(ms);
  } else if (typeof after === 'string') {
    date = new Date(after);
  } else {
    date = new Date(0); // epoch
  }
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date for "after"');
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * Extract header value from Gmail message payload.
 * @param {import('googleapis').gmail_v1.Schema$Message} message
 * @param {string} name - Header name (e.g. 'Subject', 'From', 'Date')
 * @returns {string}
 */
function getHeader(message, name) {
  const headers = message.payload?.headers;
  if (!headers || !Array.isArray(headers)) return '';
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return (h && h.value) || '';
}

/**
 * Fetch emails from Gmail in the range [after, now].
 * @param {number | string} after - Start of range: Unix timestamp (ms or s) or ISO date string
 * @param {{ maxResults?: number }} [opts] - maxResults (default 50, max 500)
 * @returns {Promise<{ ok: boolean, emails?: Array<{ id: string, threadId: string, subject: string, from: string, date: string, snippet: string }>, error?: string }>}
 */
export async function fetchEmails(after, opts = {}) {
  const maxResults = Math.min(500, Math.max(1, opts.maxResults ?? 50));

  const gmail = await getGmailClient();
  if (!gmail) {
    return { ok: false, error: 'Gmail not configured (set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)' };
  }

  let afterDateStr;
  try {
    afterDateStr = toGmailDate(after);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  const q = `after:${afterDateStr}`;

  try {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults,
    });

    const messageList = listRes.data.messages || [];
    const emails = [];

    for (const ref of messageList) {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: ref.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });
      const msg = msgRes.data;
      emails.push({
        id: msg.id,
        threadId: msg.threadId || '',
        subject: getHeader(msg, 'Subject'),
        from: getHeader(msg, 'From'),
        date: getHeader(msg, 'Date'),
        snippet: (msg.snippet || '').replace(/\n/g, ' ').trim(),
      });
    }

    return { ok: true, emails };
  } catch (err) {
    const message = err.message || String(err);
    const code = err.code || err.response?.status;
    return {
      ok: false,
      error: code ? `Gmail API error (${code}): ${message}` : message,
    };
  }
}
