import express from 'express';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

// CORS: allow Expo app from device/simulator
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.post('/notifications/send', (req, res) => {
  const { title, body } = req.body ?? {};
  // Optional: log for debugging
  if (title != null || body != null) {
    console.log('Notification request:', { title, body });
  }
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
