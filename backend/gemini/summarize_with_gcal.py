"""
Fetch Google Calendar events and summarize them with Gemini.

Usage:
  GOOGLE_ACCESS_TOKEN=xxx python summarize_with_gcal.py [--hours 24]
  python summarize_with_gcal.py --token xxx [--hours 48]

Requires: GEMINI_API_KEY and GOOGLE_ACCESS_TOKEN (env or --token).
Loads .env from repo root or backend/ (same as summarize.py).
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
# We import Calendar API inside fetch_gcal_events and summarize inside main() after fetching.


def _log(msg: str) -> None:
    print(f"[summarize_with_gcal] {msg}", file=sys.stderr, flush=True)


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
    Imports Calendar API deps here to avoid conflict with google.genai (summarize.py).
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
                maxResults=250,
            )
            .execute()
        )
        items = events_result.get("items") or []
        # Normalize to same shape as Node: summary, start (dateTime/date), end, location
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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch Google Calendar events and summarize with Gemini."
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
        help="Hours of calendar events to fetch (default 24)",
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
    if not calendar_text.strip():
        _log("No calendar events in this period.")
        print("(No calendar events in this period to summarize.)")
        return

    _log(f"Got {len(events)} events, summarizing with Gemini...")
    from summarize import summarize as run_summarize
    summary = run_summarize(calendar_text, "")
    print(summary)


if __name__ == "__main__":
    main()
