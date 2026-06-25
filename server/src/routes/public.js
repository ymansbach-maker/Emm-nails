import { Router } from 'express';
import db, { isUniqueViolation } from '../db.js';
import { MAX_DAYS_AHEAD, SLOT_MINUTES, WORKING_HOURS, BREAKS, SERVICES } from '../config.js';
import { isValidDateString, isValidTimeString, nowInIsrael, slotsForDate, addDays, dayOfWeek } from '../time.js';
import { sendConfirmationEmail } from '../email.js';

const router = Router({ mergeParams: true });

function toMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const getBusiness = db.prepare('SELECT id, slug, name FROM businesses WHERE slug = ?');
const getTakenAppts = db.prepare('SELECT time, duration FROM appointments WHERE business_id = ? AND date = ?');
const getBlocks = db.prepare('SELECT time FROM blocks WHERE business_id = ? AND date = ?');
const AFTER_HOURS_SERVICE = 'שירות אחרי שעות הפעילות';

const insertAppointment = db.prepare(
  'INSERT INTO appointments (business_id, date, time, name, phone, email, service, duration, is_after_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

function loadBusiness(req, res, next) {
  const business = getBusiness.get(req.params.slug);
  if (!business) return res.status(404).json({ error: 'business_not_found' });
  req.business = business;
  next();
}

router.use(loadBusiness);

router.get('/info', (req, res) => {
  res.json({ slug: req.business.slug, name: req.business.name, maxDaysAhead: MAX_DAYS_AHEAD });
});

// Availability for a single date. A slot is unavailable if any existing appointment
// (with its own duration) overlaps the slot's window [T, T+SLOT_MINUTES).
router.get('/availability', (req, res) => {
  const { date } = req.query;
  if (!isValidDateString(date)) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  const now = nowInIsrael();
  if (date < now.date || date > addDays(now.date, MAX_DAYS_AHEAD)) {
    return res.json({ date, slots: [] });
  }

  const blocks = getBlocks.all(req.business.id, date).map((r) => r.time);
  const wholeDayBlocked = blocks.includes('');
  const blocked = new Set(blocks);
  // After-hours appointments have no specific time — exclude them from slot blocking.
  const takenAppts = getTakenAppts.all(req.business.id, date).filter((a) => a.time !== null);

  const slots = slotsForDate(date).map((slotTime) => {
    const slotStart = toMins(slotTime);
    const slotEnd = slotStart + SLOT_MINUTES;
    const overlapped = takenAppts.some((a) => {
      const aStart = toMins(a.time);
      const aEnd = aStart + (a.duration ?? SLOT_MINUTES);
      return aStart < slotEnd && aEnd > slotStart;
    });
    return {
      time: slotTime,
      available:
        !wholeDayBlocked &&
        !overlapped &&
        !blocked.has(slotTime) &&
        !(date === now.date && slotTime <= now.time),
    };
  });

  res.json({ date, slots });
});

const NAME_RE = /^[֐-׿a-zA-Z'"\-. ]{2,60}$/;
const PHONE_RE = /^0\d{1,2}-?\d{7}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/book', (req, res) => {
  const { date, time, name, phone, email, service, duration } = req.body ?? {};

  if (!isValidDateString(date)) return res.status(400).json({ error: 'invalid_date' });

  const cleanName = String(name ?? '').trim();
  const cleanPhone = String(phone ?? '').replace(/[\s-]/g, '');
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!NAME_RE.test(cleanName)) return res.status(400).json({ error: 'invalid_name' });
  if (!PHONE_RE.test(cleanPhone)) return res.status(400).json({ error: 'invalid_phone' });
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'invalid_email' });

  const cleanService = String(service ?? '').trim();
  if (!SERVICES.includes(cleanService)) return res.status(400).json({ error: 'invalid_service' });

  const isAfterHours = cleanService === AFTER_HOURS_SERVICE;
  const now = nowInIsrael();

  if (isAfterHours) {
    // After-hours: only validate date (no time required).
    if (date < now.date) return res.status(400).json({ error: 'slot_in_past' });
    if (date > addDays(now.date, MAX_DAYS_AHEAD)) return res.status(400).json({ error: 'too_far_ahead' });

    try {
      const result = insertAppointment.run(
        req.business.id, date, null, cleanName, cleanPhone, cleanEmail, cleanService, 30, 1
      );
      res.status(201).json({ id: result.lastInsertRowid, date, time: null, name: cleanName });
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ error: 'slot_taken' });
      throw err;
    }
    return;
  }

  if (!isValidTimeString(time)) return res.status(400).json({ error: 'invalid_time' });

  const dur = Number(duration);
  if (!Number.isInteger(dur) || dur < 15 || dur > 120) {
    return res.status(400).json({ error: 'invalid_duration' });
  }

  if (date < now.date || (date === now.date && time <= now.time)) {
    return res.status(400).json({ error: 'slot_in_past' });
  }
  if (date > addDays(now.date, MAX_DAYS_AHEAD)) {
    return res.status(400).json({ error: 'too_far_ahead' });
  }
  if (!slotsForDate(date).includes(time)) {
    return res.status(400).json({ error: 'outside_working_hours' });
  }

  // Appointment must not exceed closing time or overlap breaks.
  const dow = dayOfWeek(date);
  const dayHours = WORKING_HOURS[dow];
  const apptStart = toMins(time);
  const apptEnd = apptStart + dur;
  if (!dayHours || apptEnd > toMins(dayHours.close)) {
    return res.status(400).json({ error: 'outside_working_hours' });
  }
  for (const { start, end } of (BREAKS[dow] ?? [])) {
    if (apptStart < toMins(end) && apptEnd > toMins(start)) {
      return res.status(400).json({ error: 'outside_working_hours' });
    }
  }

  const blocks = getBlocks.all(req.business.id, date).map((r) => r.time);
  if (blocks.includes('') || blocks.includes(time)) {
    return res.status(409).json({ error: 'slot_taken' });
  }

  // Check no existing appointment overlaps [time, time+duration).
  const existingAppts = getTakenAppts.all(req.business.id, date).filter((a) => a.time !== null);
  const hasOverlap = existingAppts.some((a) => {
    const aStart = toMins(a.time);
    const aEnd = aStart + (a.duration ?? SLOT_MINUTES);
    return aStart < apptEnd && aEnd > apptStart;
  });
  if (hasOverlap) return res.status(409).json({ error: 'slot_taken' });

  try {
    const result = insertAppointment.run(
      req.business.id, date, time, cleanName, cleanPhone, cleanEmail, cleanService, dur, 0
    );
    res.status(201).json({ id: result.lastInsertRowid, date, time, name: cleanName });
    sendConfirmationEmail({ email: cleanEmail, name: cleanName, date, time })
      .catch((err) => console.error('Confirmation email failed:', err));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'slot_taken' });
    }
    throw err;
  }
});

const insertWaiting = db.prepare(
  'INSERT INTO waiting_list (business_id, date, name, phone, email) VALUES (?, ?, ?, ?, ?)'
);

router.post('/waiting-list', (req, res) => {
  const { date, name, phone, email } = req.body ?? {};

  if (!isValidDateString(date)) return res.status(400).json({ error: 'invalid_date' });
  const cleanName = String(name ?? '').trim();
  const cleanPhone = String(phone ?? '').replace(/[\s-]/g, '');
  const cleanEmail = String(email ?? '').trim().toLowerCase();

  if (!NAME_RE.test(cleanName)) return res.status(400).json({ error: 'invalid_name' });
  if (!PHONE_RE.test(cleanPhone)) return res.status(400).json({ error: 'invalid_phone' });
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'invalid_email' });

  const now = nowInIsrael();
  if (date < now.date) return res.status(400).json({ error: 'invalid_date' });

  const alreadyOnList = db.prepare(
    'SELECT id FROM waiting_list WHERE business_id = ? AND date = ? AND email = ?'
  ).get(req.business.id, date, cleanEmail);
  if (alreadyOnList) return res.status(409).json({ error: 'already_on_list' });

  insertWaiting.run(req.business.id, date, cleanName, cleanPhone, cleanEmail);
  res.status(201).json({ ok: true });
});

export default router;
