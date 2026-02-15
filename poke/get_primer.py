import requests
import os

API_KEY = os.getenv('POKE_API_KEY')
# MESSAGE = 'give me a summary of my last 7 days based on my calendar, reminders, photos, and similar with the top 5 interesting things that happened. give it to me day by day to make it easier to remind myself what i did and prompt me to provide a short video/voice message. both of this should then be used to create a summary of my last 7 days. in the next step i wanna send this to my closest friends.'
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
    'https://poke.com/api/v1/inbound-sms/webhook',
    headers={
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    },
    json={'message': MESSAGE}
)

print(response.json())
