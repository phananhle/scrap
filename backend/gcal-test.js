/**
 * Tests for GET /gcal/events, fetchGcalEvents, and Gemini summarize: auth, mocks, and API key verification.
 */
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.POKE_API_KEY = 'test-key';

const hasGcalKeys = () =>
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const hasGeminiKey = () => !!process.env.GEMINI_API_KEY;

describe('GET /gcal/events', () => {
  let app;

  before(async () => {
    const mod = await import('./index.js');
    app = mod.app;
  });

  beforeEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete app.locals.fetchGcalEvents;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/gcal/events');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.ok, false);
    assert.match(res.body.error, /Authorization|Bearer/);
  });

  it('returns 401 when Authorization is not Bearer', async () => {
    const res = await request(app)
      .get('/gcal/events')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.ok, false);
  });

  it('returns 401 when Authorization is "Bearer " with no token', async () => {
    const res = await request(app)
      .get('/gcal/events')
      .set('Authorization', 'Bearer ');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.ok, false);
  });

  it('returns 502 when Google credentials are not set (no mock)', async () => {
    const res = await request(app)
      .get('/gcal/events')
      .set('Authorization', 'Bearer fake-token');
    assert.strictEqual(res.status, 502);
    assert.strictEqual(res.body.ok, false);
    assert.match(res.body.error, /GOOGLE_CLIENT|Calendar/);
  });

  it('returns 200 with events when mock returns ok', async () => {
    const events = [
      { summary: 'Team standup', start: '2026-02-15T10:00:00Z', end: '2026-02-15T10:30:00Z', id: 'evt1' },
    ];
    app.locals.fetchGcalEvents = async () => ({ ok: true, events });

    const res = await request(app)
      .get('/gcal/events')
      .set('Authorization', 'Bearer fake-token');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.deepStrictEqual(res.body.events, events);
  });

  it('returns 200 with events when both client keys are set and fetch succeeds', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    const events = [
      { summary: 'Sync', start: '2026-02-15T14:00:00Z', end: '2026-02-15T14:30:00Z', id: 'evt2' },
    ];
    app.locals.fetchGcalEvents = async () => ({ ok: true, events });

    const res = await request(app)
      .get('/gcal/events?hours=12')
      .set('Authorization', 'Bearer user-access-token');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.deepStrictEqual(res.body.events, events);
    console.log('events retrieved:', res.body.events);
  });

  it('returns 401 when mock returns credentials/invalid error', async () => {
    app.locals.fetchGcalEvents = async () => ({
      ok: false,
      error: 'invalid_grant or invalid credentials',
    });

    const res = await request(app)
      .get('/gcal/events')
      .set('Authorization', 'Bearer expired-token');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.ok, false);
    assert.match(res.body.error, /invalid|credentials/);
  });

  it('returns 502 when mock returns other error', async () => {
    app.locals.fetchGcalEvents = async () => ({
      ok: false,
      error: 'Calendar API quota exceeded',
    });

    const res = await request(app)
      .get('/gcal/events')
      .set('Authorization', 'Bearer fake-token');

    assert.strictEqual(res.status, 502);
    assert.strictEqual(res.body.ok, false);
    assert.strictEqual(res.body.error, 'Calendar API quota exceeded');
  });

  it('passes hours query param to fetch (default 24)', async () => {
    let capturedHours;
    app.locals.fetchGcalEvents = async (_token, hours) => {
      capturedHours = hours;
      return { ok: true, events: [] };
    };

    await request(app)
      .get('/gcal/events')
      .set('Authorization', 'Bearer t');

    assert.strictEqual(capturedHours, 24);
  });

  it('passes hours query param when given', async () => {
    let capturedHours;
    app.locals.fetchGcalEvents = async (_token, hours) => {
      capturedHours = hours;
      return { ok: true, events: [] };
    };

    await request(app)
      .get('/gcal/events?hours=48')
      .set('Authorization', 'Bearer t');

    assert.strictEqual(capturedHours, 48);
  });

  it('clamps hours to max 8760', async () => {
    let capturedHours;
    app.locals.fetchGcalEvents = async (_token, hours) => {
      capturedHours = hours;
      return { ok: true, events: [] };
    };

    await request(app)
      .get('/gcal/events?hours=99999')
      .set('Authorization', 'Bearer t');

    assert.strictEqual(capturedHours, 8760);
  });

  it('clamps hours to min 1', async () => {
    let capturedHours;
    app.locals.fetchGcalEvents = async (_token, hours) => {
      capturedHours = hours;
      return { ok: true, events: [] };
    };

    await request(app)
      .get('/gcal/events?hours=0')
      .set('Authorization', 'Bearer t');

    assert.strictEqual(capturedHours, 24);
  });
});

describe('fetchGcalEvents (unit)', () => {
  it('returns error when GOOGLE_CLIENT_ID is not set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const { fetchGcalEvents } = await import('./index.js');
    const result = await fetchGcalEvents('token', 24);
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /GOOGLE_CLIENT/);
  });

  it('returns error when GOOGLE_CLIENT_SECRET is not set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'cid';
    delete process.env.GOOGLE_CLIENT_SECRET;
    const { fetchGcalEvents } = await import('./index.js');
    const result = await fetchGcalEvents('token', 24);
    assert.strictEqual(result.ok, false);
    assert.match(result.error, /GOOGLE_CLIENT/);
  });
});

describe('GCal API key verification (integration)', () => {
  it('reaches Google Calendar API when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set', async () => {
    if (!hasGcalKeys()) {
      console.log('Skipping: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to run');
      return;
    }
    const { fetchGcalEvents } = await import('./index.js');
    const result = await fetchGcalEvents('invalid-access-token-for-test', 24);
    assert.strictEqual(result.ok, false, 'expected failure with bad token');
    assert(result.error, 'expected an error message');
    assert(
      !result.error.includes('GOOGLE_CLIENT_ID') && !result.error.includes('GOOGLE_CLIENT_SECRET'),
      'expected Google API error (e.g. invalid_grant), not missing env – keys are working'
    );
  });
});

describe('Gemini API key verification (integration)', () => {
  it('returns a summary when GEMINI_API_KEY is set (runSummarize)', async () => {
    if (!hasGeminiKey()) {
      console.log('Skipping: set GEMINI_API_KEY to run');
      return;
    }
    const { runSummarize } = await import('./index.js');
    const calendarText = 'Feb 15 10am – Team standup (30min)\nFeb 15 2pm – 1:1 with Sarah (30min)';
    const result = await runSummarize(calendarText, '');
    assert.strictEqual(result.ok, true, result.error || 'runSummarize failed');
    assert(result.summary && result.summary.length > 0, 'expected non-empty summary');
    assert(!result.summary.includes('GEMINI_API_KEY'), 'expected real summary, not env error');
  });
});

describe('GET /gcal/summarize (with real Gemini when key set)', () => {
  let app;

  before(async () => {
    const mod = await import('./index.js');
    app = mod.app;
  });

  beforeEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete app.locals.fetchGcalEvents;
    delete app.locals.runSummarizeWithGcal;
  });

  it('returns 401 when Authorization is missing', async () => {
    const res = await request(app).get('/gcal/summarize');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.ok, false);
  });

  it('returns 200 with "no events" when mock returns empty events', async () => {
    app.locals.runSummarizeWithGcal = async () => ({
      ok: true,
      summary: '(No calendar events in this period to summarize.)',
    });
    const res = await request(app)
      .get('/gcal/summarize')
      .set('Authorization', 'Bearer fake-token');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.match(res.body.summary, /no calendar events|No calendar/);
  });

  it('returns 200 with Gemini summary when GCal mock returns events and GEMINI_API_KEY is set', async () => {
    if (!hasGeminiKey()) {
      console.log('Skipping /gcal/summarize Gemini test: set GEMINI_API_KEY to run');
      return;
    }
    app.locals.runSummarizeWithGcal = async () => ({
      ok: true,
      summary: '• Standup meeting (30 min)',
    });
    const res = await request(app)
      .get('/gcal/summarize?hours=24')
      .set('Authorization', 'Bearer fake-token');
    assert.strictEqual(res.status, 200, res.body.error || res.body);
    assert.strictEqual(res.body.ok, true);
    assert(res.body.summary && res.body.summary.length > 0);
  });
});
