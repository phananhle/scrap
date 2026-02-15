/**
 * Unit tests for Poke agent: signal-wake (poll loop returns when message appears)
 * and block-signal callback (POST /poke/callback clears pending request_id).
 */
import { describe, it, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';

const APPLE_EPOCH_MS = new Date('2001-01-01T00:00:00Z').getTime();
function msToAppleNanos(ms) {
  return Math.floor(((ms - APPLE_EPOCH_MS) / 1000) * 1e9);
}

// Must set env before index.js loads
process.env.NODE_ENV = 'test';
process.env.POKE_API_KEY = 'test-key';
process.env.POKE_POLL_TIMEOUT_MS = '3500';
process.env.POKE_FIRST_POLL_DELAY_MS = '20';
process.env.POKE_POLL_INTERVAL_MS = '50';

/** Queue of responses for fetchLatestMessageFromContact. Shifted per poll. Empty = return { ok: false }. */
let mockFetchLatestResponses = [];

function createFetchLatestMock() {
  return async () => {
    const resp = mockFetchLatestResponses.shift() ?? { ok: false };
    return resp;
  };
}

const fetchMock = mock.fn(async (url) => {
  const u = String(url);
  if (u.includes('poke.com') && u.includes('inbound')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, message: 'Message sent successfully' }),
    };
  }
  throw new Error(`Unexpected fetch: ${u}`);
});

describe('Poke agent signal-wake and block-signal', () => {
  let app;

  before(async () => {
    mock.method(globalThis, 'fetch', fetchMock);
    const mod = await import('./index.js');
    app = mod.app;
  });

  beforeEach(() => {
    mockFetchLatestResponses = [];
    app.locals.fetchLatestMessageFromContact = createFetchLatestMock();
  });

  it('signal wakes on first poll: returns 200 with hardcoded incoming message within seconds', async () => {
    const t0 = Date.now();
    const appleNanos = msToAppleNanos(t0 + 1000);
    mockFetchLatestResponses.push({
      ok: true,
      body: '• Test bullet one\n• Test bullet two',
      is_from_me: false,
      date: appleNanos,
    });

    const res = await request(app)
      .post('/poke/agent')
      .send({
        request_id: 'test-signal-wake-1',
        include_messages: false,
      });

    const elapsed = Date.now() - t0;
    assert(elapsed < 5000, `Expected response within 5s, took ${elapsed}ms`);
    assert.strictEqual(res.status, 200);

    const data = res.body;
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.message, '• Test bullet one\n• Test bullet two');
  });

  it('no signal causes 504 after timeout', async () => {
    mockFetchLatestResponses = [];
    const t0 = Date.now();
    const res = await request(app)
      .post('/poke/agent')
      .send({
        request_id: 'test-timeout-1',
        include_messages: false,
      });
    const elapsed = Date.now() - t0;

    assert(elapsed >= 2000, `Expected to wait at least 2s for timeout, took ${elapsed}ms`);
    assert.strictEqual(res.status, 504);
    const data = res.body;
    assert.strictEqual(data.ok, false);
    assert.match(data.error, /timeout|not seen/);
    assert.strictEqual(data.request_id, 'test-timeout-1');
  });

  it('callback clears request_id from pending set', async () => {
    const { pendingPokeAgentRequestIds } = await import('./index.js');
    const rid = 'test-callback-clear-' + Date.now();
    pendingPokeAgentRequestIds.add(rid);

    const cbRes = await request(app)
      .post('/poke/callback')
      .send({ request_id: rid, message: 'Pasted summary' });

    assert.strictEqual(cbRes.status, 200);
    assert.ok(!pendingPokeAgentRequestIds.has(rid), 'request_id should be removed after callback');

    const cbRes2 = await request(app)
      .post('/poke/callback')
      .send({ request_id: rid, message: 'Duplicate' });
    assert.strictEqual(cbRes2.status, 404, 'second callback with same request_id should return 404');
  });
});
