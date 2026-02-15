"""
Thin client for the 7-day recap. Calls the backend POST /poke/send; the backend
forwards to Poke. Start the backend first (e.g. npm run dev in scrap/backend).
Sends the MESSAGE below so Poke returns the 7-day recap in that shape.
"""
import requests

BACKEND_URL = "http://localhost:3000"

# Output schema / prompt for Poke (7-day recap: weekly_vibe, daily_breakdown, etc.)
MESSAGE = """
{
  "weekly_vibe": "String",
  "daily_breakdown": [
    {"day": "Monday", "title": "Short Title", "activity_summary": "Description"},
    ...
  ],
  "top_3_highlights": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "video_script_prompt": "A cheeky suggestion for a 15-second video update based on the highlights.",
  "suggested_recipients": ["Friend Name/Group"]
}
"""

response = requests.post(
    f"{BACKEND_URL}/poke/send",
    headers={"Content-Type": "application/json"},
    json={"message": MESSAGE.strip()},
)

try:
    print(response.json())
except Exception:
    print(response.text)
