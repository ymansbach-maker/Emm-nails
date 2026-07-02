import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAvailability, bookAppointment, joinWaitingList, getPaymentConfig, createPaymentSession, ApiError, Slot } from '../api';
import {
  todayInIsrael, addDays, dayOfWeek,
  formatHebrewDate, HEBREW_DAY_LETTERS, HEBREW_MONTHS,
} from '../dates';
import { config, WORKERS } from '../config';

const MAX_DAYS_AHEAD = config.max_days_ahead;

// Service names come from config.pricing — the canonical list shared with the server.
const SERVICE_NAMES = config.pricing.map((p) => p.name);

type Step = 'worker' | 'date' | 'time' | 'details' | 'done';

const ERROR_MESSAGES: Record<string, string> = {
  slot_taken: 'התור הזה בדיוק נתפס. בחרו שעה אחרת.',
  slot_in_past: 'השעה שנבחרה כבר עברה. בחרו שעה אחרת.',
  invalid_name: 'יש להזין שם מלא (2 תווים לפחות).',
  invalid_phone: 'מספר הטלפון לא תקין. לדוגמה: 050-1234567',
  invalid_email: 'כתובת האימייל אינה תקינה.',
  invalid_service: 'יש לבחור סוג שירות.',
  outside_working_hours: 'השעה שנבחרה מחוץ לשעות הפעילות.',
  already_on_list: 'כבר נרשמת לרשימת ההמתנה לתאריך זה.',
  network: 'בעיית תקשורת. בדקו את החיבור ונסו שוב.',
};

function errorText(err: unknown): string {
  if (err instanceof ApiError) return ERROR_MESSAGES[err.code] ?? 'משהו השתבש. נסו שוב.';
  return ERROR_MESSAGES.network;
}

// --- Calendar ---

interface CalendarProps {
  selected: string | null;
  onSelect: (date: string) => void;
}

function Calendar({ selected, onSelect }: CalendarProps) {
  const today = todayInIsrael();
  const maxDate = addDays(today, MAX_DAYS_AHEAD);
  const [viewYM, setViewYM] = useState(() => today.slice(0, 7)); // YYYY-MM

  const [year, month] = viewYM.split('-').map(Number);
  const firstDay = `${viewYM}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = dayOfWeek(firstDay); // week starts Sunday

  const canGoPrev = viewYM > today.slice(0, 7);
  const canGoNext = viewYM < maxDate.slice(0, 7);

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setViewYM(d.toISOString().slice(0, 7));
  };

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      `${viewYM}-${String(i + 1).padStart(2, '0')}`
    ),
  ];

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          type="button" className="calendar-nav" onClick={() => shiftMonth(-1)}
          disabled={!canGoPrev} aria-label="חודש קודם"
        >›</button>
        <span className="calendar-month">{HEBREW_MONTHS[month - 1]} {year}</span>
        <button
          type="button" className="calendar-nav" onClick={() => shiftMonth(1)}
          disabled={!canGoNext} aria-label="חודש הבא"
        >‹</button>
      </div>
      <div className="calendar-grid" role="grid">
        {HEBREW_DAY_LETTERS.map((d) => (
          <span className="calendar-dayname" key={d}>{d}</span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const dow = dayOfWeek(date);
          const disabled =
            date < today || date > maxDate || dow === 6 || dow === 1; // Sat + Mon closed
          return (
            <button
              type="button"
              key={date}
              className={`calendar-day${selected === date ? ' selected' : ''}`}
              disabled={disabled}
              onClick={() => onSelect(date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Wizard ---

export default function BookingSection() {
  const [step, setStep] = useState<Step>('worker');
  const [worker, setWorker] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [service, setService] = useState('');
  const [duration, setDuration] = useState(30);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWaitingForm, setShowWaitingForm] = useState(false);
  const [waitingJoined, setWaitingJoined] = useState(false);
  const [waitName, setWaitName] = useState('');
  const [waitPhone, setWaitPhone] = useState('');
  const [waitEmail, setWaitEmail] = useState('');
  const [waitBusy, setWaitBusy] = useState(false);
  const [waitError, setWaitError] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [payRedirectBusy, setPayRedirectBusy] = useState(false);

  useEffect(() => {
    void getPaymentConfig().then((cfg) => setPaymentEnabled(cfg.paymentEnabled)).catch(() => {});
  }, []);

  const loadSlots = useCallback(async (d: string, w: string) => {
    setSlots(null);
    setError(null);
    try {
      const res = await getAvailability(d, w);
      setSlots(res.slots);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    if (date && worker && step === 'time') void loadSlots(date, worker);
  }, [date, worker, step, loadSlots]);

  const pickWorker = (w: string) => {
    setWorker(w);
    setStep('date');
  };

  const pickDate = (d: string) => {
    setDate(d);
    setTime(null);
    setStep('time');
    setShowWaitingForm(false);
    setWaitingJoined(false);
    setWaitError(null);
  };

  const handleServiceChange = (val: string) => {
    setService(val);
    setDuration(30);
  };

  const joinWaiting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || waitBusy) return;
    setWaitBusy(true);
    setWaitError(null);
    try {
      await joinWaitingList({ date, name: waitName.trim(), phone: waitPhone.trim(), email: waitEmail.trim() });
      setWaitingJoined(true);
      setShowWaitingForm(false);
    } catch (err) {
      setWaitError(errorText(err));
    } finally {
      setWaitBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || !service || !worker || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await bookAppointment({
        date,
        time,
        name: name.trim(), phone: phone.trim(), email: email.trim(),
        service, duration, worker,
      });
      setAppointmentId(id);
      setStep('done');
    } catch (err) {
      const msg = errorText(err);
      setError(msg);
      if (err instanceof ApiError && err.code === 'slot_taken' && worker) {
        setTime(null);
        setStep('time');
        void loadSlots(date, worker);
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('worker');
    setWorker(null);
    setDate(null);
    setTime(null);
    setService('');
    setDuration(30);
    setName('');
    setPhone('');
    setEmail('');
    setError(null);
    setAppointmentId(null);
    setPayRedirectBusy(false);
  };

  const handleOnlinePayment = async () => {
    if (!appointmentId || payRedirectBusy) return;
    setPayRedirectBusy(true);
    try {
      const res = await createPaymentSession(appointmentId);
      if (res.success && res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        setPayRedirectBusy(false);
      }
    } catch {
      setPayRedirectBusy(false);
    }
  };

  const availableSlots = useMemo(() => slots?.filter((s) => s.available) ?? [], [slots]);

  const stepIndex = { worker: 0, date: 1, time: 2, details: 3, done: 4 }[step];

  return (
    <section className="section booking reveal" id="booking">
      <div className="section-head">
        <h2 className="section-title">קביעת תור</h2>
      </div>

      <div className="booking-card">
        {step !== 'done' && (
          <ol className="booking-steps" aria-label="שלבי הזמנה">
            {['צוות', 'תאריך', 'שעה', 'פרטים'].map((label, i) => (
              <li
                key={label}
                className={i === stepIndex ? 'active' : i < stepIndex ? 'completed' : ''}
              >
                <span className="step-num">{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}

        {error && <p className="booking-error" role="alert">{error}</p>}

        {step === 'worker' && (
          <div className="worker-picker">
            {WORKERS.map((w) => (
              <button
                type="button"
                key={w}
                className={`worker-card${worker === w ? ' worker-card--selected' : ''}`}
                onClick={() => pickWorker(w)}
              >
                <span className="worker-card-sparkle" aria-hidden="true">✨</span>
                <span className="worker-card-name">{w}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'date' && (
          <>
            <Calendar selected={date} onSelect={pickDate} />
            <button type="button" className="btn-ghost" onClick={() => setStep('worker')}>
              ← החלפת צוות
            </button>
          </>
        )}

        {step === 'time' && date && (
          <div className="slot-picker">
            <p className="slot-date">{formatHebrewDate(date)}</p>
            {slots === null && !error && <p className="slot-loading">טוען שעות פנויות…</p>}
            {slots !== null && availableSlots.length === 0 && (
              <div>
                <p className="slot-empty">אין שעות פנויות בתאריך הזה. נסו תאריך אחר.</p>
                {!waitingJoined ? (
                  !showWaitingForm ? (
                    <button
                      type="button"
                      className="btn-ghost waiting-join-btn"
                      onClick={() => setShowWaitingForm(true)}
                    >
                      הצטרף לרשימת המתנה
                    </button>
                  ) : (
                    <form className="waiting-form" onSubmit={joinWaiting}>
                      <label className="field" htmlFor="wait-name">
                        <span>שם מלא</span>
                        <input
                          id="wait-name" type="text" value={waitName} onChange={(e) => setWaitName(e.target.value)}
                          placeholder="ישראל ישראלי" required minLength={2} maxLength={60}
                          aria-required="true"
                        />
                      </label>
                      <label className="field" htmlFor="wait-phone">
                        <span>טלפון</span>
                        <input
                          id="wait-phone" type="tel" value={waitPhone} onChange={(e) => setWaitPhone(e.target.value)}
                          placeholder="050-1234567" inputMode="tel" required
                          pattern="0\d{1,2}-?\d{7}" title="מספר טלפון ישראלי"
                          aria-required="true"
                        />
                      </label>
                      <label className="field" htmlFor="wait-email">
                        <span>אימייל</span>
                        <input
                          id="wait-email" type="email" value={waitEmail} onChange={(e) => setWaitEmail(e.target.value)}
                          placeholder="example@email.com" required
                          aria-required="true"
                        />
                      </label>
                      {waitError && <p className="booking-error" role="alert">{waitError}</p>}
                      <button type="submit" className="btn-primary" disabled={waitBusy}>
                        {waitBusy ? 'שולח…' : 'הצטרף לרשימת המתנה'}
                      </button>
                      <button
                        type="button" className="btn-ghost"
                        onClick={() => { setShowWaitingForm(false); setWaitError(null); }}
                      >
                        ביטול
                      </button>
                    </form>
                  )
                ) : (
                  <div className="waiting-success">
                    <p>נוספת לרשימת המתנה ליום {formatHebrewDate(date)}.</p>
                    <p className="done-note">נשלח לך אימייל אם יתפנה מקום.</p>
                  </div>
                )}
              </div>
            )}
            {slots !== null && availableSlots.length > 0 && (
              <div className="slot-grid">
                {availableSlots.map((s) => (
                  <button
                    type="button"
                    key={s.time}
                    className={`slot${time === s.time ? ' selected' : ''}`}
                    onClick={() => { setTime(s.time); setStep('details'); }}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="btn-ghost" onClick={() => setStep('date')}>
              ← החלפת תאריך
            </button>
          </div>
        )}

        {step === 'details' && date && time && (
          <form className="details-form" onSubmit={submit}>
            <p className="details-summary">
              {formatHebrewDate(date)}
              {' · '}<strong>{time}</strong>
            </p>
            <p className="details-summary">המניקוריסטית שלך: <strong>{worker}</strong></p>

            <>
              <label className="field" htmlFor="booking-service">
                <span>סוג שירות</span>
                <select
                  id="booking-service"
                  value={service}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  required
                  aria-required="true"
                >
                  <option value="" disabled>בחרו שירות…</option>
                  {SERVICE_NAMES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              {service && (
                <p className="duration-hint">משך הטיפול: <strong>{duration}</strong> דקות</p>
              )}
            </>

            <label className="field" htmlFor="booking-name">
              <span>שם מלא</span>
              <input
                id="booking-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ישראל ישראלי"
                autoComplete="name"
                required
                minLength={2}
                maxLength={60}
                aria-required="true"
              />
            </label>
            <label className="field" htmlFor="booking-phone">
              <span>טלפון</span>
              <input
                id="booking-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                autoComplete="tel"
                inputMode="tel"
                required
                pattern="0\d{1,2}-?\d{7}"
                title="מספר טלפון ישראלי, לדוגמה 050-1234567"
                aria-required="true"
              />
            </label>
            <label className="field" htmlFor="booking-email">
              <span>אימייל</span>
              <input
                id="booking-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                required
                aria-required="true"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={busy || !service}>
              {busy ? 'רגע…' : 'אישור הבקשה'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep('time')}>
              ← החלפת שעה
            </button>
          </form>
        )}

        {step === 'done' && date && (
          <div className="booking-done">
            <div className="done-check" aria-hidden="true">✓</div>
            <h3>התור נקבע!</h3>
            <p>
              {name.trim()}, נתראה ב{formatHebrewDate(date)} בשעה <strong>{time}</strong>.
            </p>
            {service && (
              <p className="done-note">שירות: {service} · {duration} דקות</p>
            )}
            <p className="done-note">אישור נשלח לאימייל {email.trim()}.</p>

            <div className="booking-payment-options">
              <p className="booking-payment-label">תשלום</p>
              <button
                type="button"
                className="btn-pay-online"
                disabled={!paymentEnabled || payRedirectBusy}
                onClick={handleOnlinePayment}
              >
                {payRedirectBusy ? 'מחבר לתשלום…' : 'שלם עכשיו אונליין 💳'}
                {!paymentEnabled && <span className="coming-soon-badge">בקרוב</span>}
              </button>
              <button type="button" className="btn-ghost btn-pay-inshop" onClick={reset}>
                שלם בסטודיו
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
