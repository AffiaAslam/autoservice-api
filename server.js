const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const app      = express();

app.use(cors());
app.use(express.json());

/* ═══════════════════════════════════════════════════════
   DATABASE CONNECTION
   ═══════════════════════════════════════════════════════ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://postgres:RYEtNBWzxQnnzcmtInQbAikedkYHBPKv@postgres.railway.internal:5432/railway',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/* Auto-create bookings table if it doesn't exist */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id         SERIAL PRIMARY KEY,
      date       DATE         NOT NULL,
      time       VARCHAR(5)   NOT NULL,
      name       VARCHAR(100) NOT NULL,
      phone      VARCHAR(30)  NOT NULL,
      email      VARCHAR(100) NOT NULL,
      reg        VARCHAR(10),
      message    TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(date, time)
    );
  `);
  console.log('Database ready — bookings table exists');
}

/* ═══════════════════════════════════════════════════════
   API KEY PROTECTION
   ═══════════════════════════════════════════════════════ */
const VALID_API_KEY = process.env.API_KEY ||
  'AS-59d2356735666e912c9da0a7efd84d32472bbb7a0659649f';

app.use((req, res, next) => {
  if (req.path === '/') return next();
  const key = req.headers['x-api-key'];
  if (!key || key !== VALID_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API key' });
  }
  next();
});

/* ═══════════════════════════════════════════════════════
   ROUTES
   ═══════════════════════════════════════════════════════ */

/* Health check */
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Autoservice Booking API with PostgreSQL is running' });
});

/* GET /bookings?from=2026-04-27&to=2026-05-03 */
app.get('/bookings', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from or to date.' });
  }
  try {
    const result = await pool.query(
      `SELECT date::text, time FROM bookings
       WHERE date >= $1 AND date <= $2 ORDER BY date, time`,
      [from, to]
    );
    const booked = {};
    const start = new Date(from);
    const end   = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      booked[d.toISOString().split('T')[0]] = [];
    }
    result.rows.forEach(row => {
      const key = row.date.split('T')[0];
      if (!booked[key]) booked[key] = [];
      booked[key].push(row.time);
    });
    res.json({ booked });
  } catch (err) {
    console.error('GET /bookings error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* POST /bookings — Create a new booking */
app.post('/bookings', async (req, res) => {
  const { date, time, name, phone, email, reg, message } = req.body;
  if (!date || !time || !name || !phone || !email) {
    return res.status(400).json({ error: 'Missing required fields: date, time, name, phone, email' });
  }
  try {
    await pool.query(
      `INSERT INTO bookings (date, time, name, phone, email, reg, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [date, time, name, phone, email, reg || '', message || '']
    );
    console.log(`Booking saved: ${date} at ${time} — ${name} (${phone}) reg: ${reg || 'none'}`);
    res.json({ success: true, booking: { date, time, name, phone, email, reg: reg || '', message: message || '' } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }
    console.error('POST /bookings error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* GET /admin/bookings — See all bookings */
app.get('/admin/bookings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, date::text, time, name, phone, email, reg, message, created_at
       FROM bookings ORDER BY date, time`
    );
    res.json({ total: result.rows.length, bookings: result.rows });
  } catch (err) {
    console.error('GET /admin/bookings error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* DELETE /admin/bookings/:id — Cancel a booking */
app.delete('/admin/bookings/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    console.error('DELETE error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* ═══════════════════════════════════════════════════════
   START SERVER
   ═══════════════════════════════════════════════════════ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Autoservice API running on port ${PORT}`);
  await initDB();
});
