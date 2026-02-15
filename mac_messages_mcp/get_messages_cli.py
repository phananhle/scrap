#!/usr/bin/env python3
"""
CLI to retrieve recent messages via mac_messages_mcp.
Outputs JSON for consumption by the backend (Node.js).

Usage:
  uv run python get_messages_cli.py [hours] [contact]

Examples:
  uv run python get_messages_cli.py 168
  uv run python get_messages_cli.py 24 "John"
"""
import json
import sys
from pathlib import Path

# Ensure we can import mac_messages_mcp (run from mac_messages_mcp dir)
sys.path.insert(0, str(Path(__file__).resolve().parent))

def main():
    hours = 24
    contact = None

    if len(sys.argv) > 1:
        try:
            hours = int(sys.argv[1])
        except ValueError:
            hours = 24
    if len(sys.argv) > 2:
        contact = sys.argv[2].strip() or None

    try:
        from mac_messages_mcp import get_recent_messages
        result = get_recent_messages(hours=hours, contact=contact)
        print(json.dumps({"ok": True, "messages": result}))
    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "messages": ""
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
