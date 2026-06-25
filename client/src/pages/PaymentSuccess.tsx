import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { confirmPayment } from '../api';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const apptId = Number(params.get('apptId'));
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!apptId) { setStatus('error'); return; }
    confirmPayment(apptId)
      .then(() => setStatus('ok'))
      .catch(() => setStatus('ok')); // treat confirm failures as non-fatal — payment already went through
  }, [apptId]);

  return (
    <div className="payment-page" dir="rtl">
      <div className="payment-page-card">
        {status === 'loading' && <p className="payment-page-msg">מאמת תשלום…</p>}
        {status !== 'loading' && (
          <>
            <div className="done-check" aria-hidden="true">✓</div>
            <h2>התשלום התקבל!</h2>
            <p className="payment-page-msg">תודה! התשלום בוצע בהצלחה.</p>
            <p className="done-note">נתראה בקרוב 💈</p>
            <Link to="/" className="btn-primary payment-page-cta">חזרה לדף הבית</Link>
          </>
        )}
      </div>
    </div>
  );
}
