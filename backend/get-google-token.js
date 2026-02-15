#!/usr/bin/env node
/**
 * Get a Google OAuth2 access token (and refresh token) for Calendar scope.
 *
 * Usage:
 *   node get-google-token.js
 *   node get-google-token.js YOUR_CLIENT_ID YOUR_CLIENT_SECRET
 *
 * If not passed as args, uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from .env.
 * Starts a temporary server on http://localhost:3000/callback to receive the code.
 *
 * 1. Run the script
 * 2. Authorize in the browser
 * 3. Copy the printed access_token (and optionally save refresh_token for later)
 */

import 'dotenv/config';
import http from 'http';
import { URL } from 'url';

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function buildAuthUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function exchangeCodeForTokens(clientId, clientSecret, code) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  }).toString();

  return fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).then((res) => res.json());
}

function main() {
  const clientId = process.argv[2] || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.argv[3] || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    console.error('Usage: node get-google-token.js [CLIENT_ID] [CLIENT_SECRET]');
    console.error('Or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
    process.exit(1);
  }
  if (!clientSecret) {
    console.error('Client secret is required to exchange the code for tokens.');
    console.error('Usage: node get-google-token.js CLIENT_ID CLIENT_SECRET');
    process.exit(1);
  }

  const authUrl = buildAuthUrl(clientId);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:3000`);
    if (url.pathname !== '/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const code = url.searchParams.get('error') ? null : url.searchParams.get('code');
    if (!code) {
      const error = url.searchParams.get('error') || 'No code in callback';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Authorization failed</h1><p>${error}</p><p>You can close this tab.</p>`);
      console.error('Auth error:', error);
      server.close();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Success</h1><p>You can close this tab and check the terminal for the access token.</p>');

    try {
      const tokens = await exchangeCodeForTokens(clientId, clientSecret, code);
      if (tokens.error) {
        console.error('Token exchange failed:', tokens);
        process.exit(1);
      }
      console.log('\n--- Access token (use as Bearer in API calls) ---');
      console.log(tokens.access_token);
      if (tokens.refresh_token) {
        console.log('\n--- Refresh token (save for getting new access tokens) ---');
        console.log(tokens.refresh_token);
      }
      console.log('\n--- Full response ---');
      console.log(JSON.stringify(tokens, null, 2));
    } catch (err) {
      console.error('Token exchange error:', err);
      process.exit(1);
    } finally {
      server.close();
    }
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    console.log(`Callback server listening on http://localhost:${PORT}/callback`);
    console.log('\nOpen this URL in your browser to authorize:\n');
    console.log(authUrl);
    console.log('\nWaiting for callback...');
  });
}

main();
