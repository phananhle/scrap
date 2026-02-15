/**
 * Unit tests for API client — getAuthToken(), setAuthToken(), and Authorization header.
 * Mock expo/virtual/env so client.ts loads under Jest (babel-preset-expo injects it).
 */
jest.mock('expo/virtual/env', () => ({ env: process.env }));

import { getAuthToken, setAuthToken, api } from '../client';

describe('client (getAuthToken / setAuthToken)', () => {
  beforeEach(() => {
    setAuthToken(null);
  });

  describe('getAuthToken', () => {
    it('returns null when no token has been set', () => {
      setAuthToken(null);
      expect(getAuthToken()).toBe(null);
    });

    it('returns null on initial state (no setAuthToken called yet)', () => {
      setAuthToken(null);
      expect(getAuthToken()).toBeNull();
    });

    it('returns the token after setAuthToken(string)', () => {
      setAuthToken('my-access-token');
      expect(getAuthToken()).toBe('my-access-token');
    });

    it('returns the latest token after multiple setAuthToken calls', () => {
      setAuthToken('first');
      expect(getAuthToken()).toBe('first');
      setAuthToken('second');
      expect(getAuthToken()).toBe('second');
    });

    it('returns null after setAuthToken(null)', () => {
      setAuthToken('token');
      setAuthToken(null);
      expect(getAuthToken()).toBe(null);
    });

    it('returns empty string when setAuthToken("") (falsy but valid)', () => {
      setAuthToken('');
      expect(getAuthToken()).toBe('');
    });
  });

  describe('setAuthToken', () => {
    it('persists token so getAuthToken returns it', () => {
      setAuthToken('bearer-xyz');
      expect(getAuthToken()).toBe('bearer-xyz');
    });

    it('clears token when given null', () => {
      setAuthToken('x');
      setAuthToken(null);
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('request Authorization header', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      setAuthToken(null);
      global.fetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('includes Authorization Bearer header when getAuthToken returns a token', async () => {
      setAuthToken('secret-token');
      await api.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
          }),
        })
      );
    });

    it('does not include Authorization header when token is null', async () => {
      setAuthToken(null);
      await api.get('/test');

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers).not.toHaveProperty('Authorization');
    });

    it('does not include Authorization header when token is empty string', async () => {
      setAuthToken('');
      await api.get('/test');

      const call = (global.fetch as jest.Mock).mock.calls[0];
      const headers = call[1]?.headers as Record<string, string>;
      // Client uses `if (authToken)` so '' is falsy and header is omitted
      expect(headers).not.toHaveProperty('Authorization');
    });
  });
});
