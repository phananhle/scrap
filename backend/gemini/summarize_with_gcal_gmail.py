"""
Fetch Google Calendar events and Gmail messages for the same time window and summarize with Gemini.

Usage:
  GOOGLE_ACCESS_TOKEN=xxx python summarize_with_gcal_gmail.py [--hours 24]
  python summarize_with_gcal_gmail.py --token xxx [--hours 48]

Requires: GEMINI_API_KEY and GOOGLE_ACCESS_TOKEN (env or --token).
The access token must include Calendar scope; for Gmail it must also include
  https://www.googleapis.com/auth/gmail.readonly
If your token has only Calendar scope, Gmail will fail with 403. You can:
  (1) Get a token with both scopes: run `node get-google-token.js` in backend/
      (it requests calendar + gmail.readonly), then set GOOGLE_ACCESS_TOKEN.
  (2) Use server-side Gmail fallback: set GOOGLE_REFRESH_TOKEN and
      GOOGLE_CLIENT_ID/SECRET (or GMAIL_*) in .env; the script will use these
      for Gmail when the access token lacks Gmail scope.
Loads .env from repo root or backend/ (same as summarize.py).
If Gmail API imports fail: pip install google-api-python-client google-auth

At most MAX_COUNT calendar events and MAX_COUNT Gmail messages are fetched (see MAX_COUNT in this file).
"""

import argparse
import os
import sys
import time as _time
from datetime import datetime
from pathlib import Path

# Load .env before importing summarize (needs GEMINI_API_KEY)
root = Path(__file__).resolve().parent.parent.parent
env_path = root / ".env"
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except ImportError:
        pass

# Do not import summarize here: it loads google.genai and can shadow google.oauth2.
# We import API deps inside fetch_* and summarize inside main() after fetching.

# Maximum number of items to fetch per source (calendar events and Gmail messages).
# Set by the programmer; both GCal and Gmail APIs are capped at this value.
MAX_COUNT = 3


def _log(msg: str) -> None:
    print(f"[summarize_with_gcal_gmail] {msg}", file=sys.stderr, flush=True)


def format_gcal_events_as_text(events: list) -> str:
    """Format events like the Node backend: 'Feb 14 10am – Team standup (30min) @ Room 101'."""
    if not events:
        return ""
    lines = []
    for e in events:
        start_raw = e.get("start") or {}
        end_raw = e.get("end") or {}
        start_dt = start_raw.get("dateTime") or start_raw.get("date")
        end_dt = end_raw.get("dateTime") or end_raw.get("date")
        summary = e.get("summary") or "(No title)"
        location = (e.get("location") or "").strip()

        date_str = ""
        if start_dt:
            try:
                if "T" in start_dt:
                    dt = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
                    date_str = dt.strftime("%b %d %I:%M %p").replace(" 0", " ")
                else:
                    dt = datetime.fromisoformat(start_dt)
                    date_str = dt.strftime("%b %d (all day)").replace(" 0", " ")
            except Exception:
                date_str = start_dt

        dur_str = ""
        if start_dt and end_dt:
            try:
                s = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
                end = datetime.fromisoformat(end_dt.replace("Z", "+00:00"))
                mins = max(0, int((end - s).total_seconds() / 60))
                dur_str = f" ({mins}min)"
            except Exception:
                pass

        loc_str = f" @ {location}" if location else ""
        lines.append(f"{date_str} – {summary}{dur_str}{loc_str}")
    return "\n".join(lines)


def fetch_gcal_events(access_token: str, hours: int = 24) -> tuple[bool, list | None, str | None]:
    """
    Fetch primary calendar events for the last `hours` using the given OAuth2 access token.
    Returns (ok, events_or_none, error_message).
    """
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError as e:
        return (
            False,
            None,
            f"Google Calendar API imports failed: {e}. "
            "From the (gemini) venv run: pip install google-api-python-client google-auth",
        )

    try:
        creds = Credentials(token=access_token)
        service = build("calendar", "v3", credentials=creds)
        now_ts = _time.time()
        time_min = datetime.utcfromtimestamp(now_ts - hours * 3600)
        time_max = datetime.utcfromtimestamp(now_ts)

        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=time_min.isoformat() + "Z",
                timeMax=time_max.isoformat() + "Z",
                singleEvents=True,
                orderBy="startTime",
                maxResults=MAX_COUNT,
            )
            .execute()
        )
        items = events_result.get("items") or []
        events = []
        for e in items:
            events.append({
                "summary": e.get("summary"),
                "start": e.get("start"),
                "end": e.get("end"),
                "location": e.get("location"),
            })
        return True, events, None
    except HttpError as err:
        msg = err.content.decode("utf-8") if getattr(err, "content", None) else str(err)
        return False, None, f"Calendar API: {msg}"
    except Exception as e:
        return False, None, str(e)


def _get_header(payload: dict, name: str) -> str:
    """Extract header value from Gmail message payload."""
    headers = payload.get("headers") or []
    if not isinstance(headers, list):
        return ""
    for h in headers:
        if (h.get("name") or "").lower() == name.lower():
            return (h.get("value") or "").strip()
    return ""


def _fetch_gmail_with_creds(creds, hours: int) -> tuple[bool, list | None, str | None]:
    """
    Internal: fetch Gmail messages using the given credentials (token or refresh-based).
    Returns (ok, messages_or_none, error_message).
    """
    try:
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError as e:
        return (
            False,
            None,
            f"Gmail API imports failed: {e}. "
            "From the (gemini) venv run: pip install google-api-python-client google-auth",
        )
    try:
        service = build("gmail", "v1", credentials=creds)
        now_ts = _time.time()
        after_ts = now_ts - hours * 3600
        after_dt = datetime.utcfromtimestamp(after_ts)
        after_str = f"after:{after_dt.year}/{after_dt.month:02d}/{after_dt.day:02d}"

        list_res = (
            service.users()
            .messages()
            .list(userId="me", q=after_str, maxResults=MAX_COUNT)
            .execute()
        )
        message_list = list_res.get("messages") or []
        messages = []
        for ref in message_list:
            msg_id = ref.get("id")
            if not msg_id:
                continue
            msg_res = (
                service.users()
                .messages()
                .get(
                    userId="me",
                    id=msg_id,
                    format="metadata",
                    metadataHeaders=["Subject", "From", "Date"],
                )
                .execute()
            )
            payload = msg_res.get("payload") or {}
            messages.append({
                "from": _get_header(payload, "From"),
                "subject": _get_header(payload, "Subject"),
                "date": _get_header(payload, "Date"),
                "snippet": (msg_res.get("snippet") or "").replace("\n", " ").strip(),
                "internalDate": msg_res.get("internalDate"),
            })
        return True, messages, None
    except HttpError as err:
        msg = err.content.decode("utf-8") if getattr(err, "content", None) else str(err)
        return False, None, f"Gmail API: {msg}"
    except Exception as e:
        return False, None, str(e)


def _gmail_creds_from_env():
    """
    Build Gmail credentials from env (GOOGLE_REFRESH_TOKEN + client id/secret).
    Uses GOOGLE_CLIENT_ID/SECRET if set, else GOOGLE_CLIENT_ID/SECRET.
    Returns Credentials or None if not configured.
    """
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
    except ImportError:
        return None
    refresh_token = os.environ.get("GOOGLE_REFRESH_TOKEN") or os.environ.get("GMAIL_REFRESH_TOKEN")
    client_id = os.environ.get("GMAIL_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GMAIL_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET")
    if not refresh_token or not client_id or not client_secret:
        return None
    creds = Credentials(
        token=None,
        refresh_token=refresh_token.strip(),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id.strip(),
        client_secret=client_secret.strip(),
    )
    try:
        creds.refresh(Request())
    except Exception:
        return None
    return creds


def fetch_gmail_messages(access_token: str, hours: int = 24) -> tuple[bool, list | None, str | None]:
    """
    Fetch Gmail messages from the last `hours` using the given OAuth2 access token.
    Returns (ok, messages_or_none, error_message). Each message dict has from, subject, date, snippet, internalDate.
    If the token lacks gmail.readonly scope (403), the error message will suggest using a token with that scope
    or setting GOOGLE_REFRESH_TOKEN + client id/secret in env for fallback.
    """
    try:
        from google.oauth2.credentials import Credentials
    except ImportError as e:
        return (
            False,
            None,
            f"Gmail API imports failed: {e}. "
            "From the (gemini) venv run: pip install google-api-python-client google-auth",
        )
    creds = Credentials(token=access_token)
    ok, messages, err = _fetch_gmail_with_creds(creds, hours)
    if not ok and err and ("insufficient" in err.lower() or "403" in err or "PERMISSION_DENIED" in err):
        err = (
            "Gmail failed: your access token does not include Gmail read scope. "
            "Either (1) get a new token with gmail.readonly: run `node get-google-token.js` in the backend dir "
            "(it requests calendar + gmail.readonly), then set GOOGLE_ACCESS_TOKEN to the printed access_token; "
            "or (2) set GOOGLE_REFRESH_TOKEN and GOOGLE_CLIENT_ID/SECRET (or GMAIL_*) in .env so this script can use "
            "server-side Gmail credentials as fallback."
        )
    return ok, messages, err


def _internal_date_sort_key(m: dict) -> float:
    """Sort key for messages: use internalDate (epoch ms) or 0."""
    internal = m.get("internalDate")
    if internal is None:
        return 0.0
    try:
        return float(internal)
    except (TypeError, ValueError):
        return 0.0


def format_gmail_as_text(messages: list) -> str:
    """Format emails like the Node backend, in chronological order (oldest first)."""
    if not messages:
        return ""
    sorted_messages = sorted(messages, key=_internal_date_sort_key)
    lines = []
    for m in sorted_messages:
        from_val = m.get("from") or ""
        subject = m.get("subject") or ""
        snippet = m.get("snippet") or ""
        lines.append(f"From: {from_val} | Subject: {subject} | {snippet}")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch Google Calendar and Gmail for the same time window and summarize with Gemini."
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GOOGLE_ACCESS_TOKEN"),
        help="OAuth2 access token (or set GOOGLE_ACCESS_TOKEN)",
    )
    parser.add_argument(
        "--hours",
        type=int,
        default=24,
        help="Hours of calendar/email to fetch (default 24)",
    )
    args = parser.parse_args()

    if not args.token or not args.token.strip():
        _log("Missing access token. Set GOOGLE_ACCESS_TOKEN or pass --token")
        sys.exit(1)

    hours = max(1, min(24 * 365, args.hours))
    _log(f"Fetching GCal events for the last {hours} hours...")
    ok, events, err = fetch_gcal_events(args.token.strip(), hours)
    if not ok:
        _log(f"GCal fetch failed: {err}")
        sys.exit(2)

    calendar_text = format_gcal_events_as_text(events or [])

    _log(f"Fetching Gmail messages for the last {hours} hours...")
    gmail_ok, gmail_messages, gmail_err = fetch_gmail_messages(args.token.strip(), hours)
    if not gmail_ok:
        # Fallback: token may have only Calendar scope; try server-side refresh token from env
        creds = _gmail_creds_from_env()
        if creds:
            _log("Gmail failed with access token; trying server credentials from env (GOOGLE_REFRESH_TOKEN)...")
            gmail_ok, gmail_messages, gmail_err = _fetch_gmail_with_creds(creds, hours)
        if not gmail_ok:
            _log(f"Gmail fetch failed (continuing with calendar only): {gmail_err}")
            gmail_text = ""
        else:
            gmail_text = format_gmail_as_text(gmail_messages or [])
            if gmail_messages:
                _log(f"Got {len(gmail_messages)} emails (via server credentials).")
    else:
        gmail_text = format_gmail_as_text(gmail_messages or [])
        if gmail_messages:
            _log(f"Got {len(gmail_messages)} emails.")

    if not calendar_text.strip() and not gmail_text.strip():
        _log("No calendar or email content in this period.")
        print("(No calendar or email content in this period.)")
        return

    _log("Summarizing with Gemini...")
    from summarize import summarize as run_summarize
    summary = run_summarize(calendar_text, gmail_text)
    print(summary)


if __name__ == "__main__":
    main()
