import { Router } from 'express';
import db from '../db.js';
import { DEFAULT_BUSINESS } from '../config.js';
import { nowInIsrael } from '../time.js';
import { sendCancellationEmail } from '../email.js';
import { notifyAndClearWaitingList } from '../waitingList.js';

const router = Router();

const PHONE_RE = /^0\d{1,2}-?\d{7}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getBusinessStmt = db.prepare('SELECT id FROM businesses WHERE slug = ?');
function businessId() {
  return getBusinessStmt.get(DEFAULT_BUSINESS.slug).id;
}

router.post('/lookup', (req, res) => {
  const { email, phone } = req.body ?? {};
  if (!email || !phone) return res.status(400).json({ error: 'missing_fields' });

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPhone = String(phone).replace(/[\s-]/g, '');

  if (!EMAIL_RE.test(cleanEmail) || !PHONE_RE.test(cleanPhone)) {
    return res.status(400).json({ error: 'invalid_fields' });
  }

  const bid = businessId();
  const today = nowInIsrael().date;

  const appt = db.prepare(
    'SELECT id, date, time, name FROM appointments WHERE business_id = ? AND email = ? AND phone = ? AND date >= ? ORDER BY date, time LIMIT 1'
  ).get(bid, cleanEmail, cleanPhone, today);

  if (!appt) return res.status(404).json({ error: 'not_found' });
  res.json({ appointment: appt });
});

router.delete('/cancel-own', (req, res) => {
  const { email, phone } = req.body ?? {};
  if (!email || !phone) return res.status(400).json({ error: 'missing_fields' });

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPhone = String(phone).replace(/[\s-]/g, '');

  if (!EMAIL_RE.test(cleanEmail) || !PHONE_RE.test(cleanPhone)) {
    return res.status(400).json({ error: 'invalid_fields' });
  }

  const bid = businessId();
  const today = nowInIsrael().date;

  const appt = db.transaction(() => {
    const found = db.prepare(
      'SELECT id, date, time, name FROM appointments WHERE business_id = ? AND email = ? AND phone = ? AND date >= ? ORDER BY date, time LIMIT 1'
    ).get(bid, cleanEmail, cleanPhone, today);
    if (!found) return null;
    const result = db.prepare('DELETE FROM appointments WHERE id = ? AND business_id = ?').run(found.id, bid);
    return result.changes > 0 ? found : null;
  })();

  if (!appt) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });

  sendCancellationEmail({ email: cleanEmail, name: appt.name, date: appt.date, time: appt.time })
    .catch((err) => console.error('Cancellation email failed:', err));
  notifyAndClearWaitingList(bid, appt.date);
});

export default router;
