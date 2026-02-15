"""
Summarize calendar entries and Gmail content into a very short "most important things" format using Gemini.
Loads GEMINI_API_KEY from repo root .env or backend/.env.
"""

import os
import sys
from pathlib import Path

# Prefer repo root .env (same as backend Node app)
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

from google import genai
from google.genai import types

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    raise SystemExit("GEMINI_API_KEY not set. Add it to the repo root .env (see backend/.env.example).")

_client: genai.Client | None = None


def _client_get() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=API_KEY)
    return _client

DEFAULT_PROMPT = """You are a concise summarizer. Given raw calendar entries and email snippets, output only the most important things that happened, in very short format.

Rules:
- Bullet points or 1–2 line items only.
- No intros or outros.
- Focus on: key meetings, important emails, decisions, deadlines, notable events.
- Skip routine/low-signal items unless they matter.
- Keep total output under 15 lines."""


def summarize(calendar_text: str, gmail_text: str, *, prompt: str | None = None) -> str:
    """
    Summarize combined calendar and Gmail content into a short recap.

    :param calendar_text: Raw calendar entries (e.g. "Feb 14 10am – Team standup\n...")
    :param gmail_text: Raw email snippets (e.g. "From: X Subject: Y Snippet...")
    :param prompt: Optional custom system prompt (default emphasizes short, important-only)
    :return: Short bullet-style summary string
    """
    instructions = prompt or DEFAULT_PROMPT
    combined = []
    if calendar_text and calendar_text.strip():
        combined.append("## Calendar\n" + calendar_text.strip())
    if gmail_text and gmail_text.strip():
        combined.append("## Gmail\n" + gmail_text.strip())
    if not combined:
        return "(No calendar or email content to summarize.)"

    body = "\n\n".join(combined)
    client = _client_get()
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"{instructions}\n\n---\n\n{body}",
        config=types.GenerateContentConfig(
            max_output_tokens=1024,
            temperature=0.2,
        ),
    )
    if not response or not getattr(response, "text", None):
        return "(Gemini returned no text.)"
    return (response.text or "").strip()


def _read_path(p: str) -> str:
    path = Path(p)
    if path.exists():
        return path.read_text(encoding="utf-8", errors="replace")
    # Try relative to script dir (e.g. when run from backend/gemini but file is in cwd)
    script_dir = Path(__file__).resolve().parent
    alt = script_dir / p
    if alt.exists():
        return alt.read_text(encoding="utf-8", errors="replace")
    return ""


def main():
    # CLI: (calendar_path, gmail_path) or single gmail_path; empty string = skip that part
    calendar_text = ""
    gmail_text = ""
    args = [a for a in sys.argv[1:] if a is not None]
    if len(args) >= 2:
        if args[0].strip():
            calendar_text = _read_path(args[0])
        if args[1].strip():
            gmail_text = _read_path(args[1])
    elif len(args) == 1 and args[0].strip():
        # Single file: treat as Gmail content
        gmail_text = _read_path(args[0])
    if not calendar_text and not gmail_text and not sys.stdin.isatty():
        # Single blob from stdin (e.g. pipe)
        raw = sys.stdin.read()
        if "## Calendar" in raw and "## Gmail" in raw:
            parts = raw.split("## Gmail", 1)
            calendar_text = parts[0].replace("## Calendar", "").strip()
            gmail_text = (parts[1] if len(parts) > 1 else "").strip()
        else:
            gmail_text = raw
    out = summarize(calendar_text, gmail_text)
    print(out)


if __name__ == "__main__":
    main()
