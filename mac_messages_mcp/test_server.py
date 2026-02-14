#!/usr/bin/env python3
"""
Minimal HTTP server to test Messages (get recent / send).
Run from this directory: uv run python test_server.py
Then open http://localhost:8765 in your browser.
"""
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from mac_messages_mcp.messages import get_recent_messages, send_message

PORT = 8765


class MessagesHandler(BaseHTTPRequestHandler):
    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _reply_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _reply_html(self, body, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/" or path == "/index.html":
            self._reply_html(HTML_PAGE)
            return
        if path == "/api/recent":
            qs = parse_qs(urlparse(self.path).query)
            hours = int(qs.get("hours", [24])[0])
            contact = qs.get("contact", [None])[0]
            try:
                out = get_recent_messages(hours=hours, contact=contact)
                self._reply_json({"ok": True, "messages": out})
            except Exception as e:
                self._reply_json({"ok": False, "error": str(e)}, 500)
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/send":
            try:
                n = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(n)
                body = json.loads(raw.decode())
                recipient = body.get("recipient", "").strip()
                message = body.get("message", "").strip()
                if not recipient or not message:
                    self._reply_json({"ok": False, "error": "recipient and message required"}, 400)
                    return
                out = send_message(recipient=recipient, message=message)
                self._reply_json({"ok": True, "result": out})
            except json.JSONDecodeError as e:
                self._reply_json({"ok": False, "error": f"Invalid JSON: {e}"}, 400)
            except Exception as e:
                self._reply_json({"ok": False, "error": str(e)}, 500)
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        print(format % args)


HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Messages test</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 520px; margin: 24px auto; padding: 0 12px; }
    h1 { font-size: 1.25rem; margin-bottom: 16px; }
    section { margin-bottom: 20px; }
    label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 0.9rem; }
    input, textarea, button { width: 100%; padding: 8px 10px; font-size: 1rem; margin-bottom: 8px; }
    textarea { min-height: 72px; resize: vertical; }
    button { cursor: pointer; background: #007AFF; color: #fff; border: none; border-radius: 8px; font-weight: 600; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .recent button { margin-bottom: 0; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 8px; overflow: auto; max-height: 280px; font-size: 0.85rem; white-space: pre-wrap; word-break: break-word; }
    .status { font-size: 0.9rem; margin-top: 8px; color: #666; }
    .status.err { color: #c00; }
    .status.ok { color: #0a0; }
  </style>
</head>
<body>
  <h1>Messages test</h1>

  <section class="recent">
    <label>Recent messages (hours)</label>
    <input type="number" id="hours" value="24" min="1" max="168">
    <button type="button" id="btnRecent">Load recent</button>
    <div class="status" id="recentStatus"></div>
    <pre id="recentOut"></pre>
  </section>

  <section>
    <label>Send message</label>
    <input type="text" id="recipient" placeholder="Phone, email, or contact name">
    <textarea id="message" placeholder="Message text"></textarea>
    <button type="button" id="btnSend">Send</button>
    <div class="status" id="sendStatus"></div>
  </section>

  <script>
    const setStatus = (el, text, isErr) => {
      el.textContent = text;
      el.className = 'status' + (isErr ? ' err' : ' ok');
    };

    document.getElementById('btnRecent').onclick = async () => {
      const hours = document.getElementById('hours').value || 24;
      const status = document.getElementById('recentStatus');
      const out = document.getElementById('recentOut');
      status.textContent = 'Loading…';
      out.textContent = '';
      try {
        const r = await fetch('/api/recent?hours=' + encodeURIComponent(hours));
        const data = await r.json();
        if (data.ok) {
          out.textContent = data.messages || '(none)';
          setStatus(status, 'Loaded.', false);
        } else {
          out.textContent = data.error || 'Error';
          setStatus(status, 'Error', true);
        }
      } catch (e) {
        out.textContent = String(e);
        setStatus(status, 'Request failed', true);
      }
    };

    document.getElementById('btnSend').onclick = async () => {
      const recipient = document.getElementById('recipient').value.trim();
      const message = document.getElementById('message').value.trim();
      const status = document.getElementById('sendStatus');
      if (!recipient || !message) {
        setStatus(status, 'Enter recipient and message.', true);
        return;
      }
      status.textContent = 'Sending…';
      try {
        const r = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient, message })
        });
        const data = await r.json();
        if (data.ok) {
          setStatus(status, data.result || 'Sent.', false);
        } else {
          setStatus(status, data.error || 'Error', true);
        }
      } catch (e) {
        setStatus(status, 'Request failed: ' + e, true);
      }
    };
  </script>
</body>
</html>
"""


def main():
    server = HTTPServer(("", PORT), MessagesHandler)
    print("Messages test server: http://localhost:%s" % PORT)
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
