import { useState } from 'react';
import { Link } from 'react-router-dom';
import { lookupAppointment, cancelOwnAppointment, ApiError } from '../api';
import { formatHebrewDate } from '../dates';

type Step = 'form' | 'loading' | 'found' | 'not_found' | 'cancelling' | 'done';

interface ApptInfo { id: number; date: string; time: string | null; name: string; }

export default function MyAppointment() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [appointment, setAppointment] = useState<ApptInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('loading');
    setErrorMsg(null);
    try {
      const res = await lookupAppointment({ email: email.trim(), phone: phone.trim() });
      setAppointment(res.appointment);
      setStep('found');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStep('not_found');
      } else {
        setErrorMsg('בעיית תקשורת. נסו שוב.');
        setStep('form');
      }
    }
  };

  const cancel = async () => {
    if (!window.confirm('האם לבטל את התור?')) return;
    setStep('cancelling');
    try {
      await cancelOwnAppointment({ email: email.trim(), phone: phone.trim() });
      setStep('done');
    } catch {
      setErrorMsg('הביטול נכשל. נסו שוב.');
      setStep('found');
    }
  };

  const reset = () => { setStep('form'); setAppointment(null); setErrorMsg(null); };

  return (
    <div className="my-appt-page">
      <div className="my-appt-inner">
        <Link to="/" className="my-appt-back">← חזרה לדף הבית</Link>

        <div className="my-appt-card">
          <h1 className="my-appt-title">ניהול התור שלי</h1>

          {errorMsg && <p className="booking-error" role="alert">{errorMsg}</p>}

          {step === 'form' && (
            <form onSubmit={lookup}>
              <p className="my-appt-sub">הזינו את פרטיכם כדי למצוא את התור הקרוב שלכם</p>
              <label className="field" htmlFor="my-appt-email">
                <span>אימייל</span>
                <input
                  id="my-appt-email"
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com" autoComplete="email" required
                  aria-required="true"
                />
              </label>
              <label className="field" htmlFor="my-appt-phone">
                <span>טלפון</span>
                <input
                  id="my-appt-phone"
                  type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-1234567" autoComplete="tel" inputMode="tel" required
                  pattern="0\d{1,2}-?\d{7}" title="מספר טלפון ישראלי, לדוגמה 050-1234567"
                  aria-required="true"
                />
              </label>
              <button type="submit" className="btn-primary my-appt-submit">חיפוש תור</button>
            </form>
          )}

          {step === 'loading' && <p className="my-appt-loading">מחפש תור…</p>}

          {step === 'not_found' && (
            <div className="my-appt-result">
              <p className="my-appt-not-found">לא נמצא תור קיים עבור הפרטים שהזנת</p>
              <button type="button" className="btn-ghost" onClick={reset} style={{ marginTop: '0.5rem' }}>
                נסו שוב
              </button>
            </div>
          )}

          {(step === 'found' || step === 'cancelling') && appointment && (
            <div className="my-appt-result">
              <p className="my-appt-result-label">התור הקרוב שלך</p>
              <div className="my-appt-box">
                <span className="my-appt-date">{formatHebrewDate(appointment.date)}</span>
                <span className="my-appt-time">{appointment.time ?? 'שעה תיואם'}</span>
              </div>
              <button
                type="button"
                className="btn-danger my-appt-cancel"
                onClick={cancel}
                disabled={step === 'cancelling'}
              >
                {step === 'cancelling' ? 'מבטל…' : 'בטל תור'}
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>← חזרה</button>
            </div>
          )}

          {step === 'done' && (
            <div className="my-appt-done">
              <div className="done-check" aria-hidden="true">✓</div>
              <h3>התור בוטל בהצלחה</h3>
              <p className="done-note">אישור ביטול נשלח לאימייל שלך.</p>
              <Link to="/" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.4rem', textDecoration: 'none' }}>
                לדף הבית
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
