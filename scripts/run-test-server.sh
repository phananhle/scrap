#!/usr/bin/env bash
# Run the mac_messages_mcp test server. Must run from mac_messages_mcp so uv
# uses the correct project and dependencies (thefuzz, etc.).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$(cd "$SCRIPT_DIR/../mac_messages_mcp" && pwd)"
cd "$MCP_DIR"
uv run python test_server.py
