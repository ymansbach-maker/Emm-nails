import { Router } from 'express';
import db, { isUniqueViolation } from '../db.js';
import { DEFAULT_BUSINESS, SERVICES } from '../config.js';
import { verifyPassword, issueToken, requireAdmin } from '../auth.js';
import { isValidDateString, isValidTimeString, nowInIsrael, slotsForDate } from '../time.js';
import { sendCancellationEmail } from '../email.js';
import { notifyAndClearWaitingList } from '../waitingList.js';

const AFTER_HOURS_SERVICE = 'שירות אחרי שעות הפעילות';

function toMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const router = Router();

// Simple throttle on login attempts (per process).
let failedAttempts = 0;
let lockUntil = 0;

router.post('/login', (req, res) => {
  if (Date.now() < lockUntil) {
    return res.status(429).json({ error: 'too_many_attempts' });
  }
  if (!verifyPassword(req.body?.password)) {
    failedAttempts += 1;
    if (failedAttempts >= 5) {
      lockUntil = Date.now() + 60_000;
      failedAttempts = 0;
    }
    return res.status(401).json({ error: 'wrong_password' });
  }
  failedAttempts = 0;
  res.json({ token: issueToken() });
});

router.use(requireAdmin);

// All admin operations act on the default business for now; the schema is
// already multi-business so this is the only place to widen later.
const getBusinessId = db.prepare('SELECT id FROM businesses WHERE slug = ?');
function businessId() {
  return getBusinessId.get(DEFAULT_BUSINESS.slug).id;
}

const listByDate = db.prepare(
  'SELECT id, date, time, name, phone, email, service, duration, notes, is_personal, is_after_hours, paid, created_at FROM appointments WHERE business_id = ? AND date = ? ORDER BY time'
);
const listUpcoming = db.prepare(
  'SELECT id, date, time, name, phone, email, service, duration, notes, is_personal, is_after_hours, paid, created_at FROM appointments WHERE business_id = ? AND date >= ? ORDER BY date, time'
);

router.get('/appointments', (req, res) => {
  const { date } = req.query;
  if (date !== undefined) {
    if (!isValidDateString(date)) return res.status(400).json({ error: 'invalid_date' });
    return res.json({ appointments: listByDate.all(businessId(), date) });
  }
  res.json({ appointments: listUpcoming.all(businessId(), nowInIsrael().date) });
});

router.delete('/appointments/:id', (req, res) => {
  const bid = businessId();
  const appt = db
    .prepare('SELECT name, email, date, time FROM appointments WHERE id = ? AND business_id = ?')
    .get(req.params.id, bid);
  if (!appt) return res.status(404).json({ error: 'not_found' });

  db.prepare('DELETE FROM appointments WHERE id = ? AND business_id = ?').run(req.params.id, bid);
  res.json({ ok: true });

  if (appt.email) {
    sendCancellationEmail({ email: appt.email, name: appt.name, date: appt.date, time: appt.time })
      .catch((err) => console.error('Cancellation email failed:', err));
  }
  notifyAndClearWaitingList(bid, appt.date);
});

router.patch('/appointments/:id', (req, res) => {
  const bid = businessId();
  const body = req.body ?? {};

  // Set time on an after-hours appointment (converts it to a regular timed appointment).
  if (body.time !== undefined) {
    const t = String(body.time).trim();
    if (!isValidTimeString(t)) return res.status(400).json({ error: 'invalid_time' });
    const result = db
      .prepare('UPDATE appointments SET time = ?, is_after_hours = 0 WHERE id = ? AND business_id = ?')
      .run(t, req.params.id, bid);
    if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true });
  }

  const dur = Number(body.duration);
  if (!Number.isInteger(dur) || dur < 10 || dur > 60) {
    return res.status(400).json({ error: 'invalid_duration' });
  }
  const result = db
    .prepare('UPDATE appointments SET duration = ? WHERE id = ? AND business_id = ?')
    .run(dur, req.params.id, bid);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Admin manually creates an appointment (no confirmation email).
router.post('/appointments', (req, res) => {
  const bid = businessId();
  const { name, phone, date, time, service, duration, is_personal } = req.body ?? {};

  if (!isValidDateString(date)) return res.status(400).json({ error: 'invalid_date' });

  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 1) return res.status(400).json({ error: 'invalid_name' });

  const cleanPhone = phone ? String(phone).replace(/[\s-]/g, '') : '';
  const isPersonal = is_personal ? 1 : 0;
  const cleanService = service ? String(service).trim() : null;

  // Validate service when not personal
  if (!isPersonal && cleanService && !SERVICES.includes(cleanService)) {
    return res.status(400).json({ error: 'invalid_service' });
  }

  if (!isValidTimeString(time)) return res.status(400).json({ error: 'invalid_time' });
  if (!slotsForDate(date).includes(time)) return res.status(400).json({ error: 'invalid_time' });

  // Duration: manual for personal, auto by service otherwise
  let dur = 30;
  if (isPersonal) {
    dur = Math.max(10, Math.min(60, Number(duration) || 30));
  } else if (cleanService) {
    dur = cleanService.includes('זקן') ? 40 : 30;
  }

  // Check for time conflicts with existing timed appointments
  const existingAppts = db.prepare(
    'SELECT time, duration FROM appointments WHERE business_id = ? AND date = ? AND time IS NOT NULL'
  ).all(bid, date);

  const apptStart = toMins(time);
  const apptEnd = apptStart + dur;
  const hasConflict = existingAppts.some((a) => {
    const aStart = toMins(a.time);
    const aEnd = aStart + (a.duration ?? 30);
    return aStart < apptEnd && aEnd > apptStart;
  });
  if (hasConflict) return res.status(409).json({ error: 'slot_taken' });

  try {
    const result = db.prepare(
      'INSERT INTO appointments (business_id, date, time, name, phone, service, duration, is_personal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(bid, date, time, cleanName, cleanPhone, cleanService, dur, isPersonal);
    res.status(201).json({ id: result.lastInsertRowid, date, time, name: cleanName });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'slot_taken' });
    throw err;
  }
});

router.patch('/appointments/:id/notes', (req, res) => {
  const bid = businessId();
  const notes = req.body?.notes;
  if (notes === undefined) return res.status(400).json({ error: 'missing_notes' });
  const result = db
    .prepare('UPDATE appointments SET notes = ? WHERE id = ? AND business_id = ?')
    .run(String(notes), req.params.id, bid);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.get('/blocks', (req, res) => {
  const rows = db
    .prepare('SELECT id, date, time FROM blocks WHERE business_id = ? AND date >= ? ORDER BY date, time')
    .all(businessId(), nowInIsrael().date);
  res.json({ blocks: rows });
});

// Block a single slot (time given) or a whole date (time omitted/empty).
router.post('/blocks', (req, res) => {
  const { date } = req.body ?? {};
  const time = req.body?.time || '';
  if (!isValidDateString(date)) return res.status(400).json({ error: 'invalid_date' });
  if (time !== '' && (!isValidTimeString(time) || !slotsForDate(date).includes(time))) {
    return res.status(400).json({ error: 'invalid_time' });
  }
  try {
    const result = db
      .prepare('INSERT INTO blocks (business_id, date, time) VALUES (?, ?, ?)')
      .run(businessId(), date, time);
    res.status(201).json({ id: result.lastInsertRowid, date, time });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'already_blocked' });
    }
    throw err;
  }
});

router.delete('/blocks/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM blocks WHERE id = ? AND business_id = ?')
    .run(req.params.id, businessId());
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.get('/waiting-list', (req, res) => {
  const entries = db.prepare(
    'SELECT id, date, name, phone, email, created_at FROM waiting_list WHERE business_id = ? ORDER BY date, created_at'
  ).all(businessId());
  res.json({ entries });
});

router.delete('/waiting-list/:id', (req, res) => {
  const result = db.prepare('DELETE FROM waiting_list WHERE id = ? AND business_id = ?')
    .run(req.params.id, businessId());
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.get('/service-colors', (req, res) => {
  const rows = db.prepare('SELECT service, color FROM service_colors').all();
  res.json({ colors: Object.fromEntries(rows.map((r) => [r.service, r.color])) });
});

router.put('/service-colors', (req, res) => {
  const { colors } = req.body ?? {};
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
    return res.status(400).json({ error: 'invalid_colors' });
  }
  const upsert = db.prepare('INSERT OR REPLACE INTO service_colors (service, color) VALUES (?, ?)');
  for (const [service, color] of Object.entries(colors)) {
    if (typeof service === 'string' && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
      upsert.run(service, color);
    }
  }
  res.json({ ok: true });
});

router.get('/reviews', (req, res) => {
  const reviews = db.prepare(
    'SELECT id, name, rating, text, created_at FROM reviews ORDER BY created_at DESC'
  ).all();
  res.json({ reviews });
});

router.delete('/reviews/:id', (req, res) => {
  const result = db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
