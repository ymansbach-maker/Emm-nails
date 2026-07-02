import { useSearchParams, Link } from 'react-router-dom';

export default function PaymentError() {
  const [params] = useSearchParams();
  const apptId = params.get('apptId');

  return (
    <div className="payment-page" dir="rtl">
      <div className="payment-page-card">
        <div className="payment-error-icon" aria-hidden="true">✕</div>
        <h2>התשלום נכשל</h2>
        <p className="payment-page-msg">משהו השתבש בתהליך התשלום.</p>
        <div className="payment-page-actions">
          {apptId && (
            <Link
              to={`/?retryPayment=${apptId}`}
              className="btn-primary"
            >
              נסה שוב
            </Link>
          )}
          <Link to="/" className="btn-ghost">
            שלם בסטודיו
          </Link>
        </div>
      </div>
    </div>
  );
}
