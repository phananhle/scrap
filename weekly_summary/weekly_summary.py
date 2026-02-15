#!/usr/bin/env python3
"""
One script: fetch your last 7 days from Google Calendar + Gmail, send to Gemini, print a short summary.

First-time setup:
  1. Google Cloud Console: create a project, enable "Google Calendar API" and "Gmail API".
  2. Create OAuth 2.0 credentials (Desktop app), download JSON, save as credentials.json here.
  3. Get a Gemini API key from https://aistudio.google.com/apikey and set GEMINI_API_KEY in .env (or here).

Run:
  pip install -r requirements.txt
  python weekly_summary.py
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Load .env from repo root or this directory
for d in [Path(__file__).resolve().parent.parent, Path(__file__).resolve().parent]:
    env_file = d / ".env"
    if env_file.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(env_file)
            break
        except ImportError:
            pass

import google.generativeai as genai
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

DIR = Path(__file__).resolve().parent
SCOPES = [
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
]
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Set GEMINI_API_KEY in .env (get one at https://aistudio.google.com/apikey)", file=sys.stderr)
    sys.exit(1)


def get_google_credentials():
    creds = None
    token_path = DIR / "token.json"
    creds_path = DIR / "credentials.json"
    if not creds_path.exists():
        print("Download OAuth credentials from Google Cloud Console (Desktop app) and save as credentials.json here.", file=sys.stderr)
        sys.exit(1)
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w") as f:
            f.write(creds.to_json())
    return creds


def fetch_calendar(creds):
    service = build("calendar", "v3", credentials=creds)
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    events_result = service.events().list(
        calendarId="primary",
        timeMin=week_ago.isoformat() + "Z",
        timeMax=now.isoformat() + "Z",
        singleEvents=True,
        orderBy="startTime",
    ).execute()
    events = events_result.get("items", [])
    lines = []
    for e in events:
        start = e.get("start", {}).get("dateTime") or e.get("start", {}).get("date", "?")
        title = e.get("summary", "(no title)")
        lines.append(f"  {start} – {title}")
    return "\n".join(lines) if lines else "  (no events)"


def fetch_gmail(creds):
    service = build("gmail", "v1", credentials=creds)
    week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y/%m/%d")
    results = service.users().messages().list(
        userId="me",
        q=f"after:{week_ago}",
        maxResults=100,
    ).execute()
    messages = results.get("messages", [])
    lines = []
    for m in messages[:80]:  # cap to avoid huge payload
        msg = service.users().messages().get(userId="me", id=m["id"], format="metadata", metadataHeaders=["From", "Subject"]).execute()
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
        from_ = headers.get("from", "?")
        subj = headers.get("subject", "(no subject)")
        snippet = msg.get("snippet", "")[:200]
        lines.append(f"  From: {from_} | Subject: {subj} | {snippet}...")
    return "\n".join(lines) if lines else "  (no messages)"


def summarize(calendar_text: str, gmail_text: str) -> str:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = f"""You are a concise assistant. Below are this person's last 7 days: calendar events and email snippets.

Summarize the week in a short, readable way: main meetings, important emails, decisions, and anything that stands out. Use bullet points. Keep it under 20 lines. No preamble.

## Calendar (last 7 days)
{calendar_text}

## Gmail (last 7 days)
{gmail_text}
"""
    response = model.generate_content(prompt)
    return response.text.strip()


def main():
    print("Getting Google credentials (browser may open once)...")
    creds = get_google_credentials()
    print("Fetching last 7 days from Calendar...")
    calendar_text = fetch_calendar(creds)
    print("Fetching last 7 days from Gmail...")
    gmail_text = fetch_gmail(creds)
    print("Asking Gemini for a summary...")
    summary = summarize(calendar_text, gmail_text)
    print("\n--- Your week ---\n")
    print(summary)


if __name__ == "__main__":
    main()
