// ============================================================
// Server configuration — edit this file to deploy for a new client.
// ============================================================

export const TIMEZONE = 'Asia/Jerusalem';
export const SLOT_MINUTES = 30;
export const MAX_DAYS_AHEAD = 30;

// Staff members — must mirror client/src/config.ts WORKERS.
export const WORKERS = ['Emmy', 'Noa'];

// Canonical service names — must mirror client/src/config.ts pricing[].name.
// Duration rule: customise per service type as needed.
export const SERVICES = [
  "לק ג'ל על ציפורן טבעית",
  "לק ג'ל + מבנה אנטומי",
  "לק ג'ל פרנץ'",
  "הסרת לק ג'ל בלבד",
  "הסרת לק ג'ל + טיפול חדש",
  "בנייה ראשונה בג'ל",
  "מילוי בנייה בג'ל",
  "תיקון ציפורן שבורה",
  "קישוט פשוט (לאצבע)",
  "קישוט מורכב (לאצבע)",
  "פדיקור + לק ג'ל",
  "לק ג'ל ברגליים",
  'שירות אחרי שעות הפעילות',
];

export const DEFAULT_BUSINESS = {
  slug: 'emm-nails',
  name: 'Emm Nails',
};

// Service pricing — mirrors client/src/config.ts pricing[].
// After-hours service is excluded from online payment.
export const PRICING = [
  { name: "לק ג'ל על ציפורן טבעית", price: 120 },
  { name: "לק ג'ל + מבנה אנטומי", price: 140 },
  { name: "לק ג'ל פרנץ'", price: 150 },
  { name: "הסרת לק ג'ל בלבד", price: 50 },
  { name: "הסרת לק ג'ל + טיפול חדש", price: 30 },
  { name: "בנייה ראשונה בג'ל", price: 250 },
  { name: "מילוי בנייה בג'ל", price: 180 },
  { name: "תיקון ציפורן שבורה", price: 15 },
  { name: "קישוט פשוט (לאצבע)", price: 5 },
  { name: "קישוט מורכב (לאצבע)", price: 10 },
  { name: "פדיקור + לק ג'ל", price: 180 },
  { name: "לק ג'ל ברגליים", price: 120 },
];

// Business contact details used in email templates.
export const business_name = 'Emm Nails';
export const phone        = '050-1234567';
export const instagram    = 'Emm.Nails';
export const address      = 'הרצל, ירושלים';
export const frontend_url = process.env.FRONTEND_URL || 'https://your-site.vercel.app';

// Working hours keyed by day-of-week (0 = Sunday … 6 = Saturday).
// null = closed. break = [startTime, endTime] or null for no break.
export const hours = {
  0: { open: '10:00', close: '16:00', break: null }, // Sunday
  1: { open: '10:00', close: '16:00', break: null }, // Monday
  2: { open: '10:00', close: '16:00', break: null }, // Tuesday
  3: { open: '10:00', close: '16:00', break: null }, // Wednesday
  4: { open: '10:00', close: '16:00', break: null }, // Thursday
  5: { open: '10:00', close: '14:00', break: null }, // Friday
  6: null,                                            // Saturday — closed
};

// Derived constants consumed by time.js — do not edit these directly.
export const WORKING_HOURS = Object.fromEntries(
  Object.entries(hours).map(([dow, h]) => [dow, h ? { open: h.open, close: h.close } : null])
);

export const BREAKS = Object.fromEntries(
  Object.entries(hours)
    .filter(([, h]) => h?.break)
    .map(([dow, h]) => [dow, [{ start: h.break[0], end: h.break[1] }]])
);
