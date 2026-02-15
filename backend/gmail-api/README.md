# Gmail API

Fetches your Gmail messages from a given timestamp to now via `GET /gmail/emails`.

## Setup

1. **Google Cloud Console**
   - Create a project (or use existing) and enable the [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com).
   - Create OAuth 2.0 credentials: **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Desktop app** (or **Web application** if you use a redirect).
   - Note the **Client ID** and **Client Secret**.

2. **OAuth consent**
   - Configure the OAuth consent screen if needed (e.g. add your email as test user for “Testing” mode).

3. **Get a refresh token**
   - Use the [Google OAuth2 Playground](https://developers.google.com/oauthplayground/) or a small script:
     - Scope: `https://www.googleapis.com/auth/gmail.readonly`
     - Authorize and exchange the code for tokens.
   - Or run a one-time local OAuth flow (e.g. with `googleapis` or a script that opens the browser, then prints the refresh token).
   - Copy the **refresh token** (long string); it does not expire unless revoked.

4. **Environment**
   - In `.env` (or your env source), set:
     - `GMAIL_CLIENT_ID` – from step 1
     - `GMAIL_CLIENT_SECRET` – from step 1
     - `GMAIL_REFRESH_TOKEN` – from step 3

## API

**GET /gmail/emails**

- **after** (required): Start of range. Either:
  - Unix timestamp in **seconds** (e.g. `1708012800`) or **milliseconds** (e.g. `1708012800000`), or
  - ISO date string (e.g. `2024-02-15` or `2024-02-15T00:00:00Z`).
- **maxResults** (optional): Number of messages to return (default 50, max 500).

Response: `{ "ok": true, "emails": [ { "id", "threadId", "subject", "from", "date", "snippet" }, ... ] }`.

Example:

```bash
# Emails since Unix timestamp (seconds)
curl "http://localhost:3000/gmail/emails?after=1708012800"

# Emails since 7 days ago (Unix ms)
curl "http://localhost:3000/gmail/emails?after=$(node -e "console.log(Date.now()-7*24*60*60*1000)")&maxResults=20"
```
