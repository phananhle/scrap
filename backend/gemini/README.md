# Gemini summarizer

Uses the Gemini API to turn calendar entries and Gmail content into a **very short** recap of the most important things.

## Setup

1. **API key**  
   Add to repo root `.env`:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```
   Get a key at [Google AI Studio](https://aistudio.google.com/apikey).

2. **Python deps** (from this directory):
   ```bash
   pip install -r requirements.txt
   ```
   Or with uv: `uv pip install -r requirements.txt`

## Usage

### From Python

```python
from summarize import summarize

calendar = """
Feb 14 10:00 – Team standup
Feb 14 14:00 – Project review with Jane
"""
gmail = """
From: boss@co.com | Subject: Q1 goals | Snippet: Please review the draft...
From: team@co.com | Subject: Deploy done | Snippet: Staging is live...
"""

print(summarize(calendar, gmail))
```

### Fetch Google Calendar and summarize (standalone script)

Run a script that calls the **Google Calendar API** for events, then summarizes with Gemini (no Node server needed):

```bash
# Install deps first (adds google-api-python-client, google-auth)
pip install -r requirements.txt

# Use an OAuth2 access token (e.g. from backend get-google-token.js or your app)
export GOOGLE_ACCESS_TOKEN=your_access_token
python summarize_with_gcal.py --hours 48

# Or pass token on the command line
python summarize_with_gcal.py --token "$GOOGLE_ACCESS_TOKEN" --hours 24
```

Requires `GEMINI_API_KEY` and `GOOGLE_ACCESS_TOKEN` (env or `--token`). The script fetches primary calendar events for the last N hours and prints the Gemini summary to stdout.

### CLI (summarize.py)

- **Two files** (calendar, then Gmail):
  ```bash
  python summarize.py calendar.txt gmail.txt
  ```
- **Single blob from stdin** (optional sections `## Calendar` and `## Gmail`):
  ```bash
  cat combined.txt | python summarize.py
  ```

### With backend data

Backend exposes `GET /gmail/emails?after=...`. You can fetch that (e.g. with `curl` or from the app), dump emails into a text file, and run:

```bash
curl -s "http://localhost:3000/gmail/emails?after=2025/02/01&maxResults=100" | jq -r '.emails[] | "From: \(.from) | Subject: \(.subject) | \(.snippet)"' > gmail.txt
python summarize.py "" gmail.txt
```

- **Gmail only** (one file): `python summarize.py gmail.txt`
- **Calendar + Gmail** (two files; use `""` for no calendar): `python summarize.py "" gmail.txt`

If the file isn’t in the current directory, the script also looks next to itself (e.g. `backend/gemini/`).

## Output

Short bullet list of the most important items (meetings, key emails, decisions, deadlines). No intros/outros, under ~15 lines.
