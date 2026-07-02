import { Resend } from 'resend';
import { business_name, phone, address, frontend_url } from './config.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = 'onboarding@resend.dev';
const FRONTEND_URL = frontend_url.replace(/\/$/, '');

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `יום ${HEBREW_DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ב${HEBREW_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function baseLayout(content) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Arial,sans-serif;direction:rtl;color:#e8e8e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
        <tr><td style="background:#13131a;border:1px solid #1e1e2e;border-radius:12px;padding:32px 28px;">
          ${content}
        </td></tr>
        <tr><td align="center" style="padding-top:24px;color:#55556a;font-size:12px;line-height:2;">
          פנו אלינו: ${phone}<br/>${address}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function confirmationHtml({ name, date, time, worker }) {
  return baseLayout(`
    <p style="margin:0 0 6px;color:#888888;font-size:14px;">שלום ${name},</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#e8e8e8;">התור שלך אושר בהצלחה! ✅</h1>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0f0f16;border:1px solid #2a9db5;border-radius:8px;padding:16px 20px;">
        <p style="margin:0 0 4px;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">תאריך ושעה</p>
        <p style="margin:0;color:#2a9db5;font-size:20px;font-weight:700;">${date} &nbsp;·&nbsp; ${time}</p>
        <p style="margin:8px 0 0;color:#888888;font-size:13px;">המניקוריסטית שלך: <strong style="color:#e8e8e8;">${worker}</strong></p>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:16px;color:#e8e8e8;">נתראה ב-${business_name} 💈</p>
  `);
}

function cancellationHtml({ name, date, time, bookingUrl }) {
  return baseLayout(`
    <p style="margin:0 0 6px;color:#888888;font-size:14px;">שלום ${name},</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#e8e8e8;">התור שלך בוטל</h1>
    <p style="margin:0 0 24px;color:#888888;font-size:15px;">
      התור ביום <strong style="color:#e8e8e8;">${date}</strong> בשעה <strong style="color:#e8e8e8;">${time}</strong> בוטל.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding-bottom:24px;">
        <a href="${bookingUrl}" style="display:inline-block;background:#2a9db5;color:#0a0a0f;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;">
          קביעת תור חדש
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#888888;">מתנצלים על אי הנוחות — ${business_name}</p>
  `);
}

export async function sendConfirmationEmail({ email, name, date, time, worker }) {
  if (!resend) { console.warn('RESEND_API_KEY not set — skipping confirmation email'); return; }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `אישור תור — ${business_name}`,
    html: confirmationHtml({ name, date: formatDate(date), time, worker }),
  });
}

export async function sendCancellationEmail({ email, name, date, time }) {
  if (!resend) { console.warn('RESEND_API_KEY not set — skipping cancellation email'); return; }
  const bookingUrl = `${FRONTEND_URL}/`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `ביטול תור — ${business_name}`,
    html: cancellationHtml({ name, date: formatDate(date), time, bookingUrl }),
  });
}

function waitingListHtml({ name, date, bookingUrl }) {
  return baseLayout(`
    <p style="margin:0 0 6px;color:#888888;font-size:14px;">שלום ${name},</p>
    <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#e8e8e8;">התפנה מקום ב-${business_name}! 💈</h1>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0f0f16;border:1px solid #2a9db5;border-radius:8px;padding:16px 20px;">
        <p style="margin:0 0 4px;color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">תאריך</p>
        <p style="margin:0;color:#2a9db5;font-size:20px;font-weight:700;">${date}</p>
      </td></tr>
    </table>
    <p style="margin:24px 0;font-size:15px;color:#e8e8e8;">מהרו לקבוע תור לפני שיתפס!</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${bookingUrl}" style="display:inline-block;background:#2a9db5;color:#0a0a0f;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px;">
          קביעת תור
        </a>
      </td></tr>
    </table>
  `);
}

export async function sendWaitingListEmail({ email, name, date }) {
  if (!resend) { console.warn('RESEND_API_KEY not set — skipping waiting list email'); return; }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `התפנה מקום — ${business_name}`,
    html: waitingListHtml({ name, date: formatDate(date), bookingUrl: `${FRONTEND_URL}/` }),
  });
}
