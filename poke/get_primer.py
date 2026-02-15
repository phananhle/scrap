"""
Thin client for the 7-day recap. Calls the backend POST /poke/send; the backend
forwards to Poke. Start the backend first (e.g. npm run dev in scrap/backend).
Sends the MESSAGE below so Poke returns the 7-day recap in that shape.
"""
import requests

BACKEND_URL = "http://localhost:3000"

# Prompt for Poke: use default integrations (calendar, photos, reminders, email) + Mac Messages (injected by backend).
# Response must be valid JSON in this exact format.
MESSAGE = """
Using your default integrations (calendar, photos, reminders, email) plus the Mac Messages I've provided above, create a 7-day recap of my last week.

Return your response as valid JSON in this exact format:
{
  "weekly_vibe": "string - one-line mood/summary of the week",
  "daily_breakdown": [
    {"day": "Monday", "title": "Short Title", "activity_summary": "Description"},
    {"day": "Tuesday", "title": "Short Title", "activity_summary": "Description"},
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
    json={
        "message": MESSAGE.strip(),
        "include_messages": True,
        "message_hours": 168,  # 7 days
    },
)

try:
    print(response.json())
except Exception:
    print(response.text)
