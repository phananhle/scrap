# Weekly summary (Calendar + Gmail → Gemini)

One Python script that pulls your last 7 days from **Google Calendar** and **Gmail**, sends them to **Gemini**, and prints a short summary.

## 1. Install

```bash
cd weekly_summary
pip install -r requirements.txt
```

## 2. One-time setup

### Gemini API key

- Go to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.
- In the repo root (or in `weekly_summary/`), create a `.env` file with:
  ```bash
  GEMINI_API_KEY=your_key_here
  ```

### Google Calendar + Gmail (OAuth)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (or pick one).
2. **Enable APIs**: “APIs & Services” → “Library” → enable **Google Calendar API** and **Gmail API**.
3. **Create OAuth credentials**: “APIs & Services” → “Credentials” → “Create credentials” → “OAuth client ID”.
   - If asked, configure the OAuth consent screen (External, add your email as test user).
   - Application type: **Desktop app**.
   - Download the JSON and save it as `credentials.json` in the `weekly_summary/` folder.
4. First time you run the script, a browser window will open to sign in and approve access; a `token.json` will be saved so you don’t have to do this again.

## 3. Run

```bash
python weekly_summary.py
```

You’ll get a short bullet-point summary of your week based on calendar events and email snippets. No other code in the repo is required.
