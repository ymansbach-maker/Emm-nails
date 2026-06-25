// ============================================================
// Server configuration — edit this file to deploy for a new client.
// ============================================================

export const TIMEZONE = 'Asia/Jerusalem';
export const SLOT_MINUTES = 30;
export const MAX_DAYS_AHEAD = 30;

// Canonical service names — must mirror client/src/config.ts pricing[].name.
// Duration rule: customise per service type as needed.
export const SERVICES = [
  'שירות 1',
  'שירות 2',
  'שירות 3',
  'שירות אחרי שעות הפעילות',
];

export const DEFAULT_BUSINESS = {
  slug: 'my-business',
  name: 'Business Name',
};

// Service pricing — mirrors client/src/config.ts pricing[].
// After-hours service is excluded from online payment.
export const PRICING = [
  { name: 'שירות 1', price: 100 },
  { name: 'שירות 2', price: 150 },
  { name: 'שירות 3', price: 200 },
];

// Business contact details used in email templates.
export const business_name = 'Business Name';
export const phone        = '050-0000000';
export const instagram    = 'instagram_handle';
export const address      = 'כתובת העסק, עיר';
export const frontend_url = process.env.FRONTEND_URL || 'https://your-site.vercel.app';

// Working hours keyed by day-of-week (0 = Sunday … 6 = Saturday).
// null = closed. break = [startTime, endTime] or null for no break.
export const hours = {
  0: { open: '10:00', close: '19:00', break: ['14:00', '15:00'] }, // Sunday
  1: null,                                                           // Monday — closed
  2: { open: '10:00', close: '19:00', break: ['14:00', '15:00'] }, // Tuesday
  3: { open: '10:00', close: '19:00', break: ['14:00', '15:00'] }, // Wednesday
  4: { open: '10:00', close: '19:00', break: ['14:00', '15:00'] }, // Thursday
  5: { open: '09:00', close: '14:00', break: null },                // Friday
  6: null,                                                           // Saturday — closed
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
