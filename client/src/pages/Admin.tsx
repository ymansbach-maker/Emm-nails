import { Fragment, useCallback, useEffect, useState } from 'react';
import { config } from '../config';
import {
  adminLogin, adminGetAppointments, adminDeleteAppointment,
  adminPatchAppointmentDuration, adminPatchAppointmentNotes, adminPatchAppointmentTime,
  adminCreateAppointment,
  adminGetBlocks, adminCreateBlock, adminDeleteBlock,
  adminGetWaitingList, adminDeleteWaitingListEntry,
  adminGetReviews, adminDeleteReview,
  adminGetServiceColors, adminSetServiceColors,
  adminChargePayment,
  getToken, clearToken, ApiError, Appointment, Block, WaitingListEntry, Review,
} from '../api';
import {
  todayInIsrael, formatHebrewDate, formatShortDate,
  dayOfWeek, addDays, HEBREW_MONTHS, HEBREW_DAY_LETTERS,
} from '../dates';

// ---- Schedule (mirrored from server/src/config.js) ----

const WORK_OFFSETS = [0, 2, 3, 4, 5]; // Sun Tue Wed Thu Fri
const WORK_DAY_NAMES = ['ראשון', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

const SLOT_MINUTES = 30;
const SLOT_HEIGHT_PX = 50;  // must match .cal-cell { min-height }
const SLOT_BORDER_PX = 1;   // must match .cal-cell { border-bottom } width

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function apptBlockHeight(duration: number | null): number {
  const slots = Math.max(1, Math.ceil((duration ?? SLOT_MINUTES) / SLOT_MINUTES));
  return slots * (SLOT_HEIGHT_PX + SLOT_BORDER_PX) - SLOT_BORDER_PX - 6;
}

function slotsFor(date: string): string[] {
  const dow = dayOfWeek(date);
  if (dow === 1 || dow === 6) return [];
  const [open, close] = dow === 5 ? [9 * 60, 12 * 60] : [10 * 60, 20 * 60];
  const BREAK_START = 14 * 60, BREAK_END = 15 * 60;
  const out: string[] = [];
  for (let t = open; t + 30 <= close; t += 30) {
    if (t >= BREAK_START && t < BREAK_END) continue;
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}

// Union time axis: 09:00–19:30 minus 14:00–14:30
const ALL_TIMES: string[] = [];
for (let t = 9 * 60; t < 20 * 60; t += 30) {
  if (t >= 14 * 60 && t < 15 * 60) continue;
  ALL_TIMES.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
}

function weekStartOf(dateStr: string): string {
  return addDays(dateStr, -dayOfWeek(dateStr));
}

function workDaysOfWeek(ws: string): string[] {
  return WORK_OFFSETS.map((o) => addDays(ws, o));
}

// ---- Default service colors ----

const SERVICE_NAMES = config.pricing.map((p) => p.name);

const DEFAULT_COLORS: Record<string, string> = {
  'תספורת גבר / נוער':            '#3b82f6',
  'תספורת + זקן':                  '#ef4444',
  'גלח + זקן':                      '#8b5cf6',
  'תספורת מספריים':                '#6b7280',
  'תספורת ילדים עד גיל 12':        '#10b981',
  'תספורת לחייל בסדיר':            '#f59e0b',
  'תספורת לחייל בסדיר כולל זקן':  '#f97316',
  'מסגרת + זקן':                    '#e11d48',
  'סידור זקן':                      '#a855f7',
  'מייקאובר משיער ארוך לקצר':      '#06b6d4',
  'שירות אחרי שעות הפעילות':      '#64748b',
};

function resolvedColor(service: string | null | undefined, colors: Record<string, string>): string {
  if (!service) return '#94a3b8';
  return colors[service] ?? DEFAULT_COLORS[service] ?? '#94a3b8';
}

// ---- Login ----

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(password);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'too_many_attempts')
        setError('יותר מדי ניסיונות. נסו שוב בעוד דקה.');
      else if (err instanceof ApiError) setError('סיסמה שגויה.');
      else setError('בעיית תקשורת. נסו שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <span className="admin-logo">{config.business_name}</span>
        <h1>כניסת מנהל</h1>
        {error && <p className="booking-error" role="alert">{error}</p>}
        <label className="field">
          <span>סיסמה</span>
          <input
            type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus required
          />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'רגע…' : 'כניסה'}
        </button>
      </form>
    </div>
  );
}

// ---- After-hours section (below weekly grid) ----

interface AfterHoursSectionProps {
  days: string[];
  appointments: Appointment[];
  onSelect: (a: Appointment) => void;
}

function AfterHoursSection({ days, appointments, onSelect }: AfterHoursSectionProps) {
  const afterHoursAppts = appointments.filter(
    (a) => a.is_after_hours && days.includes(a.date)
  );
  if (afterHoursAppts.length === 0) return null;

  const byDate = new Map<string, Appointment[]>();
  for (const a of afterHoursAppts) {
    const list = byDate.get(a.date) ?? [];
    list.push(a);
    byDate.set(a.date, list);
  }

  return (
    <div className="after-hours-section" dir="rtl">
      <h4 className="after-hours-section-title">מחוץ לשעות הפעילות</h4>
      <div className="after-hours-list">
        {days.flatMap((d) =>
          (byDate.get(d) ?? []).map((a) => (
            <button
              key={a.id}
              type="button"
              className="after-hours-entry"
              onClick={() => onSelect(a)}
            >
              <span className="after-hours-date">{formatShortDate(a.date)}</span>
              <span className="after-hours-name">{a.name}</span>
              {a.phone && <span className="after-hours-phone" dir="ltr">{a.phone}</span>}
              <span className="after-hours-tag">ממתין לתיאום</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Weekly view ----

interface WeeklyViewProps {
  days: string[];
  appointments: Appointment[];
  blocks: Block[];
  mobileDay: number;
  colors: Record<string, string>;
  onMobileDayChange: (i: number) => void;
  onSelect: (a: Appointment) => void;
  onUnblock: (b: Block) => void;
}

function WeeklyView({
  days, appointments, blocks, mobileDay, colors,
  onMobileDayChange, onSelect, onUnblock,
}: WeeklyViewProps) {
  const today = todayInIsrael();

  // Separate after-hours (no time) from regular appointments
  const regularAppts = appointments.filter((a) => !a.is_after_hours && a.time !== null);

  const apptMap = new Map<string, Appointment>();
  for (const a of regularAppts) apptMap.set(`${a.date}|${a.time}`, a);

  // Detect overlapping appointments (can happen if admin extends duration)
  const conflictIds = new Set<number>();
  const apptsByDate = new Map<string, Appointment[]>();
  for (const a of regularAppts) {
    const list = apptsByDate.get(a.date) ?? [];
    list.push(a);
    apptsByDate.set(a.date, list);
  }
  for (const dayAppts of apptsByDate.values()) {
    for (let i = 0; i < dayAppts.length; i++) {
      for (let j = i + 1; j < dayAppts.length; j++) {
        const a = dayAppts[i], b = dayAppts[j];
        const aStart = timeToMins(a.time!), aEnd = aStart + (a.duration ?? SLOT_MINUTES);
        const bStart = timeToMins(b.time!), bEnd = bStart + (b.duration ?? SLOT_MINUTES);
        if (aStart < bEnd && bStart < aEnd) { conflictIds.add(a.id); conflictIds.add(b.id); }
      }
    }
  }

  const blockMap = new Map<string, Block>();
  const wholeDayBlocked = new Set<string>();
  for (const b of blocks) {
    if (b.time === '') wholeDayBlocked.add(b.date);
    else blockMap.set(`${b.date}|${b.time}`, b);
  }

  return (
    <div className="cal-week-wrap">
      {/* Mobile day tabs */}
      <div className="cal-mobile-tabs">
        {days.map((d, i) => (
          <button
            key={d}
            type="button"
            className={`cal-mobile-tab${mobileDay === i ? ' active' : ''}${d === today ? ' today' : ''}`}
            onClick={() => onMobileDayChange(i)}
          >
            <span className="cal-tab-name">{WORK_DAY_NAMES[i]}</span>
            <span className={`cal-tab-date${d === today ? ' today' : ''}`}>{formatShortDate(d)}</span>
          </button>
        ))}
      </div>

      {/* Weekly grid */}
      <div className="cal-week-grid">
        {/* Header */}
        <div className="cal-corner" />
        {days.map((d, i) => (
          <div
            key={d}
            className={`cal-day-header${d === today ? ' today' : ''}${i === mobileDay ? ' mob-active' : ''}`}
          >
            <span className="cal-day-name">{WORK_DAY_NAMES[i]}</span>
            <span className="cal-day-date">{formatShortDate(d)}</span>
          </div>
        ))}

        {/* Time rows */}
        {ALL_TIMES.map((time) => (
          <Fragment key={time}>
            <div className="cal-time-label">{time}</div>
            {days.map((d, i) => {
              const valid = slotsFor(d).includes(time);
              const appt = valid ? apptMap.get(`${d}|${time}`) : undefined;
              const block = valid ? (blockMap.get(`${d}|${time}`) ?? null) : null;
              const dayBlock = valid && !appt && !block && wholeDayBlocked.has(d);

              return (
                <div
                  key={d}
                  className={`cal-cell${!valid ? ' cal-inactive' : ''}${i === mobileDay ? ' mob-active' : ''}`}
                >
                  {appt && (
                    <button
                      type="button"
                      className={`cal-appt${conflictIds.has(appt.id) ? ' cal-appt--conflict' : ''}${appt.is_personal ? ' cal-appt--personal' : ''}`}
                      style={{
                        background: appt.is_personal ? 'var(--bg-raised)' : resolvedColor(appt.service, colors),
                        color: appt.is_personal ? 'var(--text-dim)' : '#ffffff',
                        borderColor: appt.is_personal ? 'var(--copper)' : undefined,
                        height: `${apptBlockHeight(appt.duration)}px`,
                      }}
                      onClick={() => onSelect(appt)}
                      title={`פרטי תור של ${appt.name}`}
                    >
                      {appt.is_personal ? <span className="cal-appt-personal-badge">אישי</span> : null}
                      {appt.paid ? <span className="cal-appt-paid-badge">שולם ✓</span> : null}
                      <span className="cal-appt-name">{appt.name}</span>
                      {appt.phone && <span className="cal-appt-phone" dir="ltr">{appt.phone}</span>}
                      {appt.service && !appt.is_personal && <span className="cal-appt-service">{appt.service}</span>}
                    </button>
                  )}
                  {block && (
                    <button type="button" className="cal-block" onClick={() => onUnblock(block)}>
                      🔒 חסום
                    </button>
                  )}
                  {dayBlock && (
                    <div className="cal-block cal-block-passive">יום חסום</div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>

      {/* After-hours section */}
      <AfterHoursSection days={days} appointments={appointments} onSelect={onSelect} />
    </div>
  );
}

// ---- Monthly view ----

interface MonthlyViewProps {
  yearMonth: string;
  appointments: Appointment[];
  onDayClick: (date: string) => void;
}

function MonthlyView({ yearMonth, appointments, onDayClick }: MonthlyViewProps) {
  const today = todayInIsrael();
  const [year, month] = yearMonth.split('-').map(Number);
  const firstDay = `${yearMonth}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = dayOfWeek(firstDay);

  const countByDate = new Map<string, number>();
  for (const a of appointments) countByDate.set(a.date, (countByDate.get(a.date) ?? 0) + 1);

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, '0')}`),
  ];

  return (
    <div className="cal-month-wrap">
      <div className="cal-month-daynames">
        {HEBREW_DAY_LETTERS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-month-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={`b-${i}`} className="cal-month-blank" />;
          const dow = dayOfWeek(date);
          const closed = dow === 1 || dow === 6;
          const count = countByDate.get(date) ?? 0;
          return (
            <button
              key={date}
              type="button"
              className={`cal-month-day${date === today ? ' today' : ''}${closed ? ' closed' : ''}`}
              onClick={() => !closed && onDayClick(date)}
              disabled={closed}
            >
              <span className="cal-month-num">{Number(date.slice(8))}</span>
              {count > 0 && (
                <span className="cal-month-dots">
                  {Array.from({ length: Math.min(count, 3) }, (_, j) => (
                    <span key={j} className="cal-dot" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Appointment Detail Panel ----

function fmtDateDDMM(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  return `https://wa.me/972${local}`;
}

interface ApptDetailProps {
  appt: Appointment;
  onClose: () => void;
  onDelete: (a: Appointment) => void;
  onDurationUpdated: (newDuration: number) => void;
  onNotesUpdated: () => void;
  onTimeSet: () => void;
}

function ApptDetail({ appt, onClose, onDelete, onDurationUpdated, onNotesUpdated, onTimeSet }: ApptDetailProps) {
  const [notes, setNotes] = useState(appt.notes ?? '');
  const [savedNotes, setSavedNotes] = useState(appt.notes ?? '');
  const [noteSaveError, setNoteSaveError] = useState(false);
  const [savedDuration, setSavedDuration] = useState(appt.duration ?? 30);
  const [duration, setDuration] = useState(appt.duration ?? 30);
  const [durationError, setDurationError] = useState('');
  const [pendingTime, setPendingTime] = useState('');
  const [timeSetError, setTimeSetError] = useState('');

  const defaultPayAmount = config.pricing.find((p) => p.name === appt.service)?.price?.toString() ?? '';
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(defaultPayAmount);
  const [payBusy, setPayBusy] = useState(false);
  const [payResult, setPayResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handlePay = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    setPayBusy(true);
    setPayResult(null);
    try {
      const res = await adminChargePayment(appt.id, amount);
      if (res.success) {
        setPayResult({ ok: true, msg: '✓ הבקשה נשלחה לטרמינל' });
      } else if (res.error === 'not_configured') {
        setPayResult({ ok: false, msg: 'המסוף עדיין לא מחובר — נדרש להזין פרטי טרמינל' });
      } else {
        setPayResult({ ok: false, msg: res.message ?? 'שגיאה בתשלום' });
      }
    } catch {
      setPayResult({ ok: false, msg: 'שגיאה בשליחת הבקשה' });
    } finally {
      setPayBusy(false);
    }
  };

  const saveNotes = async () => {
    if (notes === savedNotes) return;
    setNoteSaveError(false);
    try {
      await adminPatchAppointmentNotes(appt.id, notes);
      setSavedNotes(notes);
      onNotesUpdated();
    } catch {
      setNoteSaveError(true);
    }
  };

  const handleDurationBlur = async () => {
    const val = duration;
    if (val < 10 || val > 60) {
      setDurationError('משך הפגישה חייב להיות בין 10 ל־60 דקות');
      setDuration(savedDuration);
      return;
    }
    setDurationError('');
    if (val === savedDuration) return;
    if (!window.confirm(`בטוח שברצונך לשנות את משך הפגישה ל־${val} דקות?`)) {
      setDuration(savedDuration);
      return;
    }
    try {
      await adminPatchAppointmentDuration(appt.id, val);
      setSavedDuration(val);
      onDurationUpdated(val);
    } catch {
      setDuration(savedDuration);
    }
  };

  const handleSetTime = async () => {
    if (!pendingTime) return;
    setTimeSetError('');
    try {
      await adminPatchAppointmentTime(appt.id, pendingTime);
      onTimeSet();
      onClose();
    } catch {
      setTimeSetError('שגיאה בשמירת השעה. נסו שוב.');
    }
  };

  // Save notes before closing so typing and immediately clicking X still persists
  const handleClose = async () => {
    await saveNotes();
    onClose();
  };

  return (
    <div className="appt-detail-backdrop" onClick={handleClose}>
      <div className="appt-detail-panel" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="appt-detail-header">
          <h3 className="appt-detail-title">
            {appt.name}
            {appt.is_personal ? <span className="appt-personal-badge">אישי</span> : null}
            {appt.is_after_hours ? <span className="appt-after-hours-badge">מחוץ לשעות</span> : null}
            {appt.paid ? <span className="appt-paid-badge">שולם ✓</span> : null}
          </h3>
          <button type="button" className="a11y-close" onClick={handleClose} aria-label="סגור">✕</button>
        </div>

        <div className="appt-detail-body">
          {/* Phone with WhatsApp link */}
          {appt.phone && (
            <p className="appt-detail-row">
              <span className="appt-detail-label">נייד</span>
              <a
                href={waLink(appt.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="appt-wa-link"
                dir="ltr"
              >
                <svg className="appt-wa-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.858L.057 23.25a.75.75 0 00.918.918l5.392-1.475A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.68-.5-5.22-1.374l-.374-.216-3.876 1.059 1.059-3.876-.216-.374A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                {appt.phone}
              </a>
            </p>
          )}

          {/* Date / Time / Duration 3-column row */}
          <div className="appt-detail-trio">
            <div className="appt-detail-trio-cell">
              <span className="appt-detail-label">תאריך</span>
              <span>{fmtDateDDMM(appt.date)}</span>
            </div>
            <div className="appt-detail-trio-cell">
              <span className="appt-detail-label">שעה</span>
              {appt.is_after_hours ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>לא נקבעה</span>
              ) : (
                <span dir="ltr">{appt.time}</span>
              )}
            </div>
            <div className="appt-detail-trio-cell">
              <span className="appt-detail-label">משך</span>
              <div className="appt-duration-inline" dir="ltr">
                <input
                  type="number"
                  className="appt-duration-inline-input"
                  min={10}
                  max={60}
                  step={5}
                  value={duration}
                  onChange={(e) => { setDuration(Number(e.target.value)); setDurationError(''); }}
                  onBlur={handleDurationBlur}
                  aria-label="משך הפגישה בדקות"
                />
                <span className="appt-duration-inline-unit">דק׳</span>
              </div>
            </div>
          </div>
          {durationError && <p className="appt-duration-error">{durationError}</p>}

          {/* Set time for after-hours appointments */}
          {appt.is_after_hours && (
            <div className="appt-set-time-wrap">
              <p className="appt-detail-label" style={{ marginBottom: '0.5rem' }}>קביעת שעה</p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  value={pendingTime}
                  onChange={(e) => setPendingTime(e.target.value)}
                  className="appt-set-time-select"
                  dir="ltr"
                >
                  <option value="">-- בחר שעה --</option>
                  {slotsFor(appt.date).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.9rem' }}
                  onClick={handleSetTime}
                  disabled={!pendingTime}
                >
                  קבע שעה
                </button>
              </div>
              {timeSetError && <p className="appt-duration-error">{timeSetError}</p>}
            </div>
          )}

          {/* Service */}
          {appt.service && (
            <p className="appt-detail-row">
              <span className="appt-detail-label">שירות</span>
              <span>{appt.service}</span>
            </p>
          )}

          {/* Admin notes — auto-save on blur */}
          <div className="appt-notes-wrap">
            <label className="appt-detail-label" htmlFor="appt-notes">הערות</label>
            <textarea
              id="appt-notes"
              className="appt-notes-textarea"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNoteSaveError(false); }}
              onBlur={saveNotes}
              rows={3}
              placeholder="הערות פנימיות..."
              dir="rtl"
            />
            {noteSaveError && (
              <p className="appt-duration-error">שמירת ההערות נכשלה. נסו שוב.</p>
            )}
          </div>
        </div>

        <div className="appt-detail-actions">
          {payOpen ? (
            <div className="pay-inline-form">
              <label className="appt-detail-label" htmlFor="pay-amount">סכום לחיוב (₪)</label>
              <input
                id="pay-amount"
                type="number"
                min={1}
                step={1}
                value={payAmount}
                onChange={(e) => { setPayAmount(e.target.value); setPayResult(null); }}
                dir="ltr"
                className="pay-amount-input"
                autoFocus
              />
              {payResult && (
                <p className={`pay-result-msg${payResult.ok ? ' pay-result-ok' : ' pay-result-err'}`}>
                  {payResult.msg}
                </p>
              )}
              <div className="pay-form-btns">
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  onClick={handlePay}
                  disabled={payBusy || !payAmount || Number(payAmount) <= 0}
                >
                  {payBusy ? 'שולח לטרמינל…' : 'שלח לטרמינל'}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  onClick={() => { setPayOpen(false); setPayResult(null); setPayAmount(defaultPayAmount); }}
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            // TODO: re-enable once Hyp/Caspit terminal credentials are confirmed and added to Render env vars
            <button type="button" className="appt-action-pay" disabled>
              תשלום מהיר 🛒
              <span className="appt-coming-soon">בקרוב</span>
            </button>
          )}
          <button
            type="button"
            className="appt-action-cancel"
            onClick={() => onDelete(appt)}
          >
            ביטול תור ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Add Appointment Modal ----

interface AddAppointmentModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddAppointmentModal({ onClose, onCreated }: AddAppointmentModalProps) {
  const today = todayInIsrael();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [service, setService] = useState('');
  const [isPersonal, setIsPersonal] = useState(false);
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSlots = slotsFor(date);

  const handleServiceChange = (val: string) => {
    setService(val);
    if (!isPersonal) {
      setDuration(val.includes('זקן') ? 40 : 30);
    }
  };

  const handlePersonalToggle = (checked: boolean) => {
    setIsPersonal(checked);
    if (checked) {
      setDuration(30);
    } else if (service) {
      setDuration(service.includes('זקן') ? 40 : 30);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date || !time) return;
    if (!isPersonal && !service) { setError('יש לבחור סוג שירות'); return; }
    setBusy(true);
    setError(null);
    try {
      await adminCreateAppointment({
        name: name.trim(),
        phone: phone.trim(),
        date,
        time,
        service: isPersonal ? (service || null) : service,
        duration,
        is_personal: isPersonal,
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slot_taken') setError('השעה הזו כבר תפוסה. בחרו שעה אחרת.');
      else if (err instanceof ApiError && err.code === 'invalid_time') setError('שעה לא תקינה לתאריך זה.');
      else setError('שגיאה ביצירת התור. נסו שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="add-appt-backdrop" onClick={onClose} dir="rtl">
      <div className="add-appt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-appt-header">
          <h3>הוסף תור</h3>
          <button type="button" className="a11y-close" onClick={onClose} aria-label="סגור">✕</button>
        </div>
        <form className="add-appt-form" onSubmit={submit}>
          {error && <p className="booking-error" role="alert">{error}</p>}

          <label className="field">
            <span>שם לקוח *</span>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ישראל ישראלי" required minLength={1}
            />
          </label>

          <label className="field">
            <span>מספר נייד</span>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="050-1234567" dir="ltr"
            />
          </label>

          <label className="field">
            <span>תאריך *</span>
            <input
              type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }}
              min={today} required style={{ colorScheme: 'dark' }}
            />
          </label>

          <label className="field">
            <span>שעת התחלה *</span>
            <select value={time} onChange={(e) => setTime(e.target.value)} required>
              <option value="">בחר שעה…</option>
              {availableSlots.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          {/* Personal toggle */}
          <label className="add-appt-personal-toggle">
            <input
              type="checkbox"
              checked={isPersonal}
              onChange={(e) => handlePersonalToggle(e.target.checked)}
            />
            <span>אישי (הפסקה / זמן אישי)</span>
          </label>

          {!isPersonal ? (
            <label className="field">
              <span>סוג שירות *</span>
              <select value={service} onChange={(e) => handleServiceChange(e.target.value)} required={!isPersonal}>
                <option value="">בחר שירות…</option>
                {SERVICE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          ) : (
            <>
              <label className="field">
                <span>סוג שירות (אופציונלי)</span>
                <select value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="">ללא שירות</option>
                  {SERVICE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">
                <span>משך (דקות, עד 60)</span>
                <input
                  type="number" value={duration}
                  onChange={(e) => setDuration(Math.min(60, Math.max(10, Number(e.target.value))))}
                  min={10} max={60} step={5} required
                />
              </label>
            </>
          )}

          <div className="add-appt-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>ביטול</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'שומר…' : 'הוסף תור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Service Colors Section ----

interface ServiceColorsSectionProps {
  savedColors: Record<string, string>;
  onSave: (colors: Record<string, string>) => Promise<void>;
}

function ServiceColorsSection({ savedColors, onSave }: ServiceColorsSectionProps) {
  const [localColors, setLocalColors] = useState<Record<string, string>>(() => ({
    ...DEFAULT_COLORS,
    ...savedColors,
  }));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    setLocalColors({ ...DEFAULT_COLORS, ...savedColors });
  }, [savedColors]);

  const handleChange = (service: string, color: string) => {
    setLocalColors((prev) => ({ ...prev, [service]: color }));
    setSaved(false);
    setSaveError(false);
  };

  const handleSave = async () => {
    setBusy(true);
    setSaved(false);
    setSaveError(false);
    try {
      await onSave(localColors);
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-section">
      <h2>צבעי שירותים</h2>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.88rem', marginBottom: '1.2rem' }}>
        בחרו צבע לכל שירות — הצבעים יופיעו בלוח השנה.
      </p>
      <ul className="svc-color-list">
        {SERVICE_NAMES.map((name) => (
          <li key={name} className="svc-color-row">
            <span
              className="svc-color-preview"
              style={{ background: localColors[name] ?? DEFAULT_COLORS[name] ?? '#94a3b8' }}
            />
            <span className="svc-color-name">{name}</span>
            <input
              type="color"
              className="svc-color-input"
              value={localColors[name] ?? DEFAULT_COLORS[name] ?? '#94a3b8'}
              onChange={(e) => handleChange(name, e.target.value)}
              aria-label={`צבע עבור ${name}`}
            />
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '1.4rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? 'שומר…' : 'שמור'}
        </button>
        {saved && <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>נשמר ✓</span>}
        {saveError && <span style={{ color: 'var(--error, #ef4444)', fontSize: '0.9rem' }}>שמירה נכשלה. נסו שוב.</span>}
      </div>
    </section>
  );
}

// ---- Main Admin ----

export default function Admin() {
  const [authed, setAuthed] = useState(() => getToken() !== null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [serviceColors, setServiceColors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<'schedule' | 'colors' | 'reviews'>('schedule');
  const [allReviews, setAllReviews] = useState<Review[]>([]);

  const [calView, setCalView] = useState<'week' | 'month'>('week');
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayInIsrael()));
  const [monthYM, setMonthYM] = useState(() => todayInIsrael().slice(0, 7));
  const [mobileDay, setMobileDay] = useState(() => {
    const idx = WORK_OFFSETS.indexOf(dayOfWeek(todayInIsrael()));
    return idx >= 0 ? idx : 0;
  });

  const [blockDate, setBlockDate] = useState(todayInIsrael());
  const [blockTime, setBlockTime] = useState('');
  const [blockBusy, setBlockBusy] = useState(false);
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const logout = useCallback(() => { clearToken(); setAuthed(false); }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [appts, blks, wl, rvs, clrs] = await Promise.all([
        adminGetAppointments(), adminGetBlocks(), adminGetWaitingList(),
        adminGetReviews(), adminGetServiceColors(),
      ]);
      setAppointments(appts.appointments);
      setBlocks(blks.blocks);
      setWaitingList(wl.entries);
      setAllReviews(rvs.reviews);
      setServiceColors(clrs.colors);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setError('שגיאה בטעינת הנתונים. נסו לרענן.');
    }
  }, [logout]);

  useEffect(() => { if (authed) void refresh(); }, [authed, refresh]);

  const deleteAppointment = async (a: Appointment) => {
    if (!window.confirm(`לבטל את התור של ${a.name} ב־${formatHebrewDate(a.date)}${a.time ? ` בשעה ${a.time}` : ''}?`)) return;
    setSelectedAppt(null);
    try { await adminDeleteAppointment(a.id); void refresh(); }
    catch { setError('הביטול נכשל. נסו שוב.'); }
  };

  const createBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockBusy) return;
    setBlockBusy(true);
    setError(null);
    try { await adminCreateBlock(blockDate, blockTime); void refresh(); }
    catch (err) {
      if (err instanceof ApiError && err.code === 'already_blocked') setError('המועד הזה כבר חסום.');
      else setError('החסימה נכשלה. נסו שוב.');
    } finally {
      setBlockBusy(false);
    }
  };

  const removeBlock = async (b: Block) => {
    try { await adminDeleteBlock(b.id); void refresh(); }
    catch { setError('שחרור החסימה נכשל. נסו שוב.'); }
  };

  const deleteWaitingEntry = async (id: number) => {
    try { await adminDeleteWaitingListEntry(id); void refresh(); }
    catch { setError('מחיקה נכשלה. נסו שוב.'); }
  };

  const deleteReview = async (id: number) => {
    if (!window.confirm('למחוק את הביקורת?')) return;
    try { await adminDeleteReview(id); void refresh(); }
    catch { setError('המחיקה נכשלה. נסו שוב.'); }
  };

  const saveColors = async (colors: Record<string, string>) => {
    await adminSetServiceColors(colors);
    setServiceColors(colors);
  };

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  const days = workDaysOfWeek(weekStart);
  const [mYear, mMonth] = monthYM.split('-').map(Number);
  const navLabel = calView === 'week'
    ? `${formatShortDate(days[0])} – ${formatShortDate(days[days.length - 1])}`
    : `${HEBREW_MONTHS[mMonth - 1]} ${mYear}`;

  const goBack = () => {
    if (calView === 'week') setWeekStart((ws) => addDays(ws, -7));
    else setMonthYM(new Date(Date.UTC(mYear, mMonth - 2, 1)).toISOString().slice(0, 7));
  };
  const goForward = () => {
    if (calView === 'week') setWeekStart((ws) => addDays(ws, 7));
    else setMonthYM(new Date(Date.UTC(mYear, mMonth, 1)).toISOString().slice(0, 7));
  };
  const goToday = () => {
    const tod = todayInIsrael();
    setWeekStart(weekStartOf(tod));
    setMonthYM(tod.slice(0, 7));
    const idx = WORK_OFFSETS.indexOf(dayOfWeek(tod));
    setMobileDay(idx >= 0 ? idx : 0);
  };

  const visibleAppts = calView === 'week'
    ? appointments.filter((a) => days.includes(a.date))
    : appointments.filter((a) => a.date.startsWith(monthYM));

  const starLabel = (r: Review) => '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

  return (
    <div className="admin">
      <header className="admin-header">
        <span className="admin-logo">{config.business_name} · ניהול</span>
        <button type="button" className="btn-ghost" onClick={logout}>יציאה</button>
      </header>

      {error && <p className="booking-error" role="alert">{error}</p>}

      {selectedAppt && (
        <ApptDetail
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onDelete={deleteAppointment}
          onDurationUpdated={(newDuration) => {
            setSelectedAppt((prev) => prev ? { ...prev, duration: newDuration } : prev);
            void refresh();
          }}
          onNotesUpdated={() => void refresh()}
          onTimeSet={() => { setSelectedAppt(null); void refresh(); }}
        />
      )}

      {showAddModal && (
        <AddAppointmentModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => void refresh()}
        />
      )}

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab-btn${adminTab === 'schedule' ? ' active' : ''}`}
          onClick={() => setAdminTab('schedule')}
        >
          יומן
        </button>
        <button
          type="button"
          className={`admin-tab-btn${adminTab === 'colors' ? ' active' : ''}`}
          onClick={() => setAdminTab('colors')}
        >
          צבעי שירותים
        </button>
        <button
          type="button"
          className={`admin-tab-btn${adminTab === 'reviews' ? ' active' : ''}`}
          onClick={() => setAdminTab('reviews')}
        >
          ביקורות
          {allReviews.length > 0 && (
            <span className="wl-badge">{allReviews.length}</span>
          )}
        </button>
      </div>

      {adminTab === 'colors' && (
        <ServiceColorsSection savedColors={serviceColors} onSave={saveColors} />
      )}

      {adminTab === 'reviews' && (
        <section className="admin-section">
          <h2>ביקורות</h2>
          {allReviews.length === 0 ? (
            <p style={{ color: 'var(--text-faint)', fontSize: '0.9rem' }}>אין ביקורות עדיין</p>
          ) : (
            <ul className="rv-admin-list">
              {allReviews.map((rv) => (
                <li key={rv.id} className="rv-admin-entry">
                  <div className="rv-admin-info">
                    <span className="rv-admin-stars">{starLabel(rv)}</span>
                    <span className="wl-name">{rv.name}</span>
                    {rv.text && <span className="rv-admin-text">{rv.text}</span>}
                    <span className="wl-detail">{rv.created_at.slice(0, 10)}</span>
                  </div>
                  <div className="rv-admin-actions">
                    <button type="button" className="btn-danger" onClick={() => deleteReview(rv.id)}>מחק</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {adminTab === 'schedule' && (
      <>
      <section className="admin-section">
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button type="button" className="cal-nav-btn" onClick={goBack} aria-label="הקודם">‹</button>
            <span className="cal-nav-label">{navLabel}</span>
            <button type="button" className="cal-nav-btn" onClick={goForward} aria-label="הבא">›</button>
            <button type="button" className="btn-ghost cal-today-btn" onClick={goToday}>היום</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.88rem' }}
              onClick={() => setShowAddModal(true)}
            >
              + הוסף תור
            </button>
            <div className="cal-view-toggle">
              <button
                type="button"
                className={`cal-view-btn${calView === 'week' ? ' active' : ''}`}
                onClick={() => setCalView('week')}
              >שבועי</button>
              <button
                type="button"
                className={`cal-view-btn${calView === 'month' ? ' active' : ''}`}
                onClick={() => setCalView('month')}
              >חודשי</button>
            </div>
          </div>
        </div>

        {calView === 'week' ? (
          <WeeklyView
            days={days}
            appointments={visibleAppts}
            blocks={blocks}
            mobileDay={mobileDay}
            colors={serviceColors}
            onMobileDayChange={setMobileDay}
            onSelect={setSelectedAppt}
            onUnblock={removeBlock}
          />
        ) : (
          <MonthlyView
            yearMonth={monthYM}
            appointments={visibleAppts}
            onDayClick={(date) => {
              setWeekStart(weekStartOf(date));
              setCalView('week');
              const idx = WORK_OFFSETS.indexOf(dayOfWeek(date));
              setMobileDay(idx >= 0 ? idx : 0);
            }}
          />
        )}
      </section>

      <section className="admin-section">
        <h2>חסימת מועדים</h2>
        <form className="block-form" onSubmit={createBlock}>
          <label className="field">
            <span>תאריך</span>
            <input
              type="date" value={blockDate} min={todayInIsrael()}
              onChange={(e) => { setBlockDate(e.target.value); setBlockTime(''); }}
              required
            />
          </label>
          <label className="field">
            <span>שעה</span>
            <select value={blockTime} onChange={(e) => setBlockTime(e.target.value)}>
              <option value="">כל היום</option>
              {slotsFor(blockDate).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary" disabled={blockBusy}>{blockBusy ? 'חוסם…' : 'חסימה'}</button>
        </form>
        {blocks.length > 0 && (
          <ul className="block-list">
            {blocks.map((b) => (
              <li key={b.id}>
                <span>{formatHebrewDate(b.date)}{b.time ? ` · ${b.time}` : ' · כל היום'}</span>
                <button type="button" className="btn-ghost" onClick={() => removeBlock(b)}>שחרור</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <h2>
          רשימת המתנה
          {waitingList.length > 0 && <span className="wl-badge">{waitingList.length}</span>}
        </h2>
        {waitingList.length === 0 ? (
          <p style={{ color: 'var(--text-faint)', fontSize: '0.9rem' }}>אין רשומות בהמתנה</p>
        ) : (
          <ul className="wl-list">
            {waitingList.map((e) => (
              <li key={e.id} className="wl-entry">
                <div className="wl-info">
                  <span className="wl-name">{e.name}</span>
                  <span className="wl-detail" dir="ltr">{e.phone}</span>
                  <span className="wl-detail">{e.email}</span>
                  <span className="wl-date">{formatHebrewDate(e.date)}</span>
                </div>
                <button type="button" className="btn-ghost" onClick={() => deleteWaitingEntry(e.id)}>מחיקה</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}
    </div>
  );
}
