import db from './db.js';
import { sendWaitingListEmail } from './email.js';

export function notifyAndClearWaitingList(businessId, date) {
  const entries = db.prepare(
    'SELECT name, email FROM waiting_list WHERE business_id = ? AND date = ?'
  ).all(businessId, date);

  if (entries.length === 0) return;

  db.prepare('DELETE FROM waiting_list WHERE business_id = ? AND date = ?').run(businessId, date);

  for (const entry of entries) {
    if (entry.email) {
      sendWaitingListEmail({ email: entry.email, name: entry.name, date })
        .catch((err) => console.error('Waiting list email failed:', err));
    }
  }
}
