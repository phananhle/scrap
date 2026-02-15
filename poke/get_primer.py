"""
Thin client for the recap. Calls the backend POST /poke/send; the backend
forwards to Poke. Start the backend first (e.g. npm run dev in scrap/backend).

Takes a timestamp (--since): from that time (last entry) to now, Poke returns
the 5 most important things in bullet points, chronologically, short form.

Reminder: set POKE_REMIND_DAYS (default 3) in .env. Run with --check-reminder
from cron to get a desktop reminder if you haven't run the primer in that long.
Use --set-remind-days N to set the interval and record a "last run" now.
"""
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

# Load .env from script directory so POKE_REMIND_DAYS is available
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)

BACKEND_URL = os.environ.get("POKE_BACKEND_URL", "http://localhost:3000")
STATE_FILE = Path(__file__).resolve().parent / "reminder_state.json"
DEFAULT_REMIND_DAYS = 3


def parse_since(s: str) -> datetime:
    """Parse --since: ISO timestamp (e.g. 2026-02-10T00:00:00Z) or Nd for N days ago."""
    s = s.strip()
    if s.endswith("d") and s[:-1].isdigit():
        days = int(s[:-1])
        return datetime.now(timezone.utc) - timedelta(days=days)
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise ValueError("Invalid --since: use ISO timestamp (e.g. 2026-02-10T00:00:00Z) or Nd (e.g. 7d)")


def build_message(since_ts: datetime) -> str:
    """Prompt: from timestamp (last entry) to now, 5 most important things, bullet points, chronological, short."""
    since_str = since_ts.strftime("%Y-%m-%d %H:%M UTC")
    return f"""
Using your default integrations (calendar, photos, reminders, email) plus the Mac Messages I've provided above:

From the timestamp {since_str} (last entry) to now, give me the 5 most important things that happened.

Format your response as a JSON object with one key, "highlights", an array of exactly 5 short bullet-point strings, in chronological order (oldest first), e.g.:
{{ "highlights": ["First thing.", "Second thing.", "Third thing.", "Fourth thing.", "Fifth thing."] }}
"""


def get_remind_days():
    return int(os.environ.get("POKE_REMIND_DAYS", str(DEFAULT_REMIND_DAYS)))


def load_state():
    if not STATE_FILE.exists():
        return {"interval_days": get_remind_days(), "last_run_utc": None}
    try:
        data = json.loads(STATE_FILE.read_text())
        data.setdefault("interval_days", get_remind_days())
        data.setdefault("last_run_utc", None)
        return data
    except (json.JSONDecodeError, OSError):
        return {"interval_days": get_remind_days(), "last_run_utc": None}


def save_state(interval_days=None, last_run_utc=None):
    state = load_state()
    if interval_days is not None:
        state["interval_days"] = interval_days
    if last_run_utc is not None:
        state["last_run_utc"] = last_run_utc
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n")


def run_primer(since_ts: datetime):
    now = datetime.now(timezone.utc)
    message = build_message(since_ts).strip()
    message_hours = max(1, int((now - since_ts).total_seconds() / 3600))
    response = requests.post(
        f"{BACKEND_URL}/poke/send",
        headers={"Content-Type": "application/json"},
        json={
            "message": message,
            "include_messages": True,
            "message_hours": message_hours,
        },
    )
    if response.ok:
        save_state(interval_days=get_remind_days(), last_run_utc=now.isoformat())
    return response


def check_reminder():
    state = load_state()
    interval_days = state["interval_days"]
    last = state.get("last_run_utc")
    if not last:
        notify(
            "Poke recap reminder",
            f"You haven't run the 7-day recap yet. Set to remind every {interval_days} day(s). Run: python get_primer.py",
        )
        return
    last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    days_since = (now - last_dt).total_seconds() / 86400
    if days_since >= interval_days:
        notify(
            "Poke recap reminder",
            f"It's been {int(days_since)} days since your last 7-day recap (remind every {interval_days}). Run: python get_primer.py",
        )


def notify(title: str, body: str):
    """Show a desktop notification (macOS via osascript)."""
    try:
        subprocess.run(
            [
                "osascript",
                "-e",
                f'display notification "{body.replace(chr(34), chr(39))}" with title "{title.replace(chr(34), chr(39))}"',
            ],
            check=True,
            capture_output=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"[{title}] {body}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Request recap from Poke (from a timestamp to now) and/or manage reminder interval.")
    parser.add_argument(
        "--since",
        metavar="TIMESTAMP",
        default="7d",
        help="Start of period: ISO timestamp (e.g. 2026-02-10T00:00:00Z) or Nd for N days ago (default: 7d).",
    )
    parser.add_argument(
        "--check-reminder",
        action="store_true",
        help="Check if recap is overdue and show a desktop reminder (for cron).",
    )
    parser.add_argument(
        "--set-remind-days",
        type=int,
        metavar="N",
        help=f"Set reminder interval to N days (default {DEFAULT_REMIND_DAYS}) and record current time as last run.",
    )
    args = parser.parse_args()

    if args.set_remind_days is not None:
        if args.set_remind_days < 1:
            print("Reminder interval must be at least 1 day.", file=sys.stderr)
            sys.exit(1)
        save_state(interval_days=args.set_remind_days, last_run_utc=datetime.now(timezone.utc).isoformat())
        print(f"Reminder set to every {args.set_remind_days} day(s). Last run recorded as now.")
        return

    if args.check_reminder:
        check_reminder()
        return

    try:
        since_ts = parse_since(args.since)
    except ValueError as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    response = run_primer(since_ts)
    try:
        print(response.json())
    except Exception:
        print(response.text)
    if not response.ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
