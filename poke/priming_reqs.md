# Priming requirements

**Input:** time frame  
**Output:** text and photo  
**Processing:** calendar, photos, (messages), email → Poke understands → recap with text and photos

---

## Message format for `POST /poke/send`

The backend sends `{ "message": "<prompt>" }` to Poke. Use one of these prompt shapes.

---

## Few-shot examples

### Example 1 – 7-day recap

```json
{
  "time_frame": "last 7 days",
  "prompt": "Using my calendar, photos, messages, and email from the last 7 days, create a recap. Give me: (1) a written summary, day by day, and (2) the top 3 photos that best capture the period. Format your response as: weekly_summary (text), daily_breakdown (array of {day, title, activity_summary}), top_photos (array of photo references/descriptions)."
}
```

**Expected output shape:**
```json
{
  "weekly_summary": "string",
  "daily_breakdown": [{"day": "string", "title": "string", "activity_summary": "string"}],
  "top_photos": ["photo_ref_1", "photo_ref_2", "photo_ref_3"]
}
```

### Example 2 – 1-day recap

```json
{
  "time_frame": "today",
  "prompt": "Summarize my day using calendar, photos, messages, and email. Return: (1) a short text recap and (2) 1–3 photos that best represent the day."
}
```

**Expected output shape:**
```json
{
  "text_recap": "string",
  "photos": ["photo_ref_1", "photo_ref_2"]
}
```

### Example 3 – Weekend recap

```json
{
  "time_frame": "this weekend",
  "prompt": "From my calendar, photos, messages, and email for this past weekend: give me a text recap and the top 5 photos to share with close friends."
}
```

---

## Backend usage

Send the `prompt` field as the message body:

```bash
curl -X POST http://localhost:3000/poke/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Using my calendar, photos, messages, and email from the last 7 days..."}'
```

---

## Reminder and cron

- **Set reminder interval:** In `poke/.env` add `POKE_REMIND_DAYS=3` (default is 3). Or run `python get_primer.py --set-remind-days 5` to set 5 days and record “last run” as now.
- **Cron:** Run the check daily so you get a desktop reminder if you haven’t run the primer in that many days:
  - From `poke/`: `./install_cron.sh` prints the crontab line; `./install_cron.sh install` adds it (9:00 AM daily).
  - Or add to crontab: `0 9 * * * cd /path/to/scrap/poke && python3 get_primer.py --check-reminder`