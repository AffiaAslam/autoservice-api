const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors()); // Allow requests from any domain (your WordPress site)
app.use(express.json());

/* ═══════════════════════════════════════════════════════
   API KEY PROTECTION
   All requests must include header: x-api-key: YOUR_KEY
   ═══════════════════════════════════════════════════════ */
const VALID_API_KEY = process.env.API_KEY || 'AS-59d2356735666e912c9da0a7efd84d32472bbb7a0659649f';

app.use((req, res, next) => {
  /* Allow health check without key */
  if (req.path === '/') return next();

  const key = req.headers['x-api-key'];
  if (!key || key !== VALID_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API key' });
  }
  next();
});

/* ═══════════════════════════════════════════════════════
   MOCK BOOKING DATA
   This simulates what digitalworkshop.nu API will return.
   Replace this section with real API call later.
   ═══════════════════════════════════════════════════════ */
const bookedSlots = {
  "2026-04-27": ["09:00", "11:00", "14:00"],
  "2026-04-28": ["08:00", "13:00"],
  "2026-04-29": ["10:00", "12:00", "15:00"],
  "2026-04-30": ["09:00", "14:00", "16:00"],
  "2026-05-04": ["08:00", "11:00"],
  "2026-05-05": ["09:00", "13:00"],
  "2026-05-06": ["10:00", "14:00"],
  "2026-05-07": ["08:00", "15:00", "16:00"],
  "2026-05-08": ["09:00", "11:00"],
  "2026-05-11": ["10:00", "13:00", "14:00"],
  "2026-05-12": ["08:00"],
  "2026-05-13": ["09:00", "11:00", "15:00"],
  "2026-05-14": ["10:00", "16:00"],
  "2026-05-15": ["09:00"]
};

/* ═══════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════ */

/* Health check — proves API is running */
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Autoservice Booking API is running' });
});

/* GET /bookings?from=2026-04-27&to=2026-05-03
   Returns booked slots for a date range (one week) */
app.get('/bookings', (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from or to date. Use ?from=YYYY-MM-DD&to=YYYY-MM-DD' });
  }

  const result = {};
  const start  = new Date(from);
  const end    = new Date(to);

  /* Loop through each day in range and collect booked slots */
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    result[key] = bookedSlots[key] || [];
  }

  res.json({ booked: result });
});

/* POST /bookings — Create a new booking
   Body: { date, time, name, phone, email, reg, message } */
app.post('/bookings', (req, res) => {
  const { date, time, name, phone, email, reg, message } = req.body;

  if (!date || !time || !name || !phone || !email) {
    return res.status(400).json({ error: 'Missing required fields: date, time, name, phone, email' });
  }

  /* Add to mock data */
  if (!bookedSlots[date]) bookedSlots[date] = [];

  if (bookedSlots[date].includes(time)) {
    return res.status(409).json({ error: 'This time slot is already booked' });
  }

  bookedSlots[date].push(time);
  bookedSlots[date].sort();

  console.log(`New booking: ${date} at ${time} — ${name} (${phone}) — ${reg || 'no reg'}`);

  res.json({
    success: true,
    booking: { date, time, name, phone, email, reg: reg || '', message: message || '' }
  });
});

/* Start server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Autoservice API running on port ${PORT}`);
});