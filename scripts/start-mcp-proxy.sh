#!/usr/bin/env bash
# Start mcp-proxy to expose mac_messages_mcp over HTTP for Poke.AI.
# mac_messages_mcp uses stdio; Poke requires HTTP at /mcp.
#
# Uses local source (mac_messages_mcp) to avoid PyPI/FastMCP version mismatches.
# Run from scrap/ or project root.
#
# Usage: ./scripts/start-mcp-proxy.sh [port] [--ngrok]
#   port: default 8000
#   --ngrok: also run ngrok to expose the proxy (for Poke integration)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DIR="$(cd "$SCRIPT_DIR/../mac_messages_mcp" && pwd)"

PORT=8000
NGROK=
for arg in "$@"; do
  if [[ "$arg" == "--ngrok" ]]; then
    NGROK=1
  elif [[ "$arg" =~ ^[0-9]+$ ]]; then
    PORT="$arg"
  fi
done

run_proxy() {
  if [[ ! -f "$MCP_DIR/run-for-proxy.sh" ]]; then
    echo "Local mac_messages_mcp not found at $MCP_DIR; falling back to uvx"
    npx mcp-proxy uvx mac-messages-mcp --port "$PORT" --host 0.0.0.0
  else
    echo "Starting MCP proxy for mac-messages-mcp (local) on port $PORT"
    npx mcp-proxy "$MCP_DIR/run-for-proxy.sh" --port "$PORT" --host 0.0.0.0
  fi
}

if [[ -n "$NGROK" ]]; then
  if ! command -v ngrok &>/dev/null; then
    echo "ngrok not found. Install: brew install ngrok"
    exit 1
  fi
  run_proxy &
  MCP_PID=$!
  trap "kill $MCP_PID 2>/dev/null || true" EXIT
  sleep 2
  echo "Exposing with ngrok..."
  ngrok http "$PORT"
else
  run_proxy
fi
