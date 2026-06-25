import { TIMEZONE, SLOT_MINUTES, WORKING_HOURS, BREAKS } from './config.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateString(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isValidTimeString(s) {
  return typeof s === 'string' && TIME_RE.test(s);
}

// Current wall-clock date and time in Israel, regardless of server timezone.
export function nowInIsrael() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  // Some ICU builds return hour='24' at midnight; fix both time and date.
  if (get('hour') === '24') {
    const d = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return { date: d.toISOString().slice(0, 10), time: '00:00' };
  }
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

// Day of week for a calendar date (timezone independent). 0 = Sunday.
export function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// All slot start times for a given date according to working hours, excluding breaks.
export function slotsForDate(dateStr) {
  const dow = dayOfWeek(dateStr);
  const hours = WORKING_HOURS[dow];
  if (!hours) return [];
  const breakSet = new Set(
    (BREAKS[dow] ?? []).flatMap(({ start, end }) => {
      const out = [];
      for (let t = toMinutes(start); t < toMinutes(end); t += SLOT_MINUTES) out.push(toHHMM(t));
      return out;
    })
  );
  const slots = [];
  for (let t = toMinutes(hours.open); t + SLOT_MINUTES <= toMinutes(hours.close); t += SLOT_MINUTES) {
    const hhmm = toHHMM(t);
    if (!breakSet.has(hhmm)) slots.push(hhmm);
  }
  return slots;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
