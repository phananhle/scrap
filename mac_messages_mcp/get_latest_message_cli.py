#!/usr/bin/env python3
"""
CLI to retrieve the single most recent message from a contact (for Poke reply polling).
Outputs JSON for consumption by the backend (Node.js).

Usage:
  uv run python get_latest_message_cli.py [contact] [hours]

Examples:
  uv run python get_latest_message_cli.py
  uv run python get_latest_message_cli.py Poke 1
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def main():
    contact = os.environ.get("POKE_MESSAGES_CONTACT", "Poke").strip() or "Poke"
    hours = 1

    if len(sys.argv) > 1:
        contact = sys.argv[1].strip() or contact
    if len(sys.argv) > 2:
        try:
            hours = int(sys.argv[2])
        except ValueError:
            hours = 1

    try:
        from mac_messages_mcp import get_latest_message_from_contact

        result = get_latest_message_from_contact(contact=contact, hours=hours)
        if result is None:
            print(json.dumps({"ok": False, "error": "No message found"}))
            sys.exit(0)
        print(
            json.dumps(
                {
                    "ok": True,
                    "body": result["body"],
                    "is_from_me": result["is_from_me"],
                    "date": result["date"],
                }
            )
        )
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
