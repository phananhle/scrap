#!/usr/bin/env bash
# Wrapper for mcp-proxy: cd to project root and exec the MCP server.
# Must be invoked as a single executable (no sh -c) so mcp-proxy's stdio
# connects directly to the Python process via exec.
cd "$(dirname "$0")"
exec uv run python -m mac_messages_mcp.server
