import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;
const POKE_WEBHOOK_URL = 'https://poke.com/api/v1/inbound-sms/webhook';

const DEFAULT_POKE_PROMPT = `give me a summary of my last 7 days based on my calendar, reminders, photos, and similar with the top 5 interesting things that happened. give it to me day by day to make it easier to remind myself what i did and prompt me to provide a short video/voice message. both of this should then be used to create a summary of my last 7 days. in the next step i wanna send this to my closest friends.`;

app.get('/', (req, res) => {
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/poke/health', (req, res) => {
  const apiKey = process.env.POKE_API_KEY;
  if (apiKey) {
    res.status(200).json({ ok: true, poke: 'configured' });
  } else {
    res.status(503).json({ ok: false, poke: 'missing POKE_API_KEY' });
  }
});

app.post('/poke/send', async (req, res) => {
  const apiKey = process.env.POKE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'POKE_API_KEY is not configured',
    });
  }

  const message =
    typeof req.body?.message === 'string' && req.body.message.trim() !== ''
      ? req.body.message.trim()
      : DEFAULT_POKE_PROMPT;

  try {
    const pokeRes = await fetch(POKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const contentType = pokeRes.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    const body = isJson ? await pokeRes.json() : await pokeRes.text();

    res.status(pokeRes.status).send(body);
  } catch (err) {
    console.error('Poke request failed:', err);
    res.status(502).json({
      ok: false,
      error: 'Failed to reach Poke API',
      details: err.message,
    });
  }
});

app.post('/poke/webhook', (req, res) => {
  if (req.body && Object.keys(req.body).length > 0) {
    console.debug('Poke webhook payload:', req.body);
  }
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
