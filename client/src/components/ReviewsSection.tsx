import { useEffect, useState } from 'react';
import { getReviews, submitReview, Review, ApiError } from '../api';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="rv-stars" aria-label={`${rating} כוכבים מתוך 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'rv-star active' : 'rv-star'}>★</span>
      ))}
    </div>
  );
}

function ReviewForm({ onSubmitted }: { onSubmitted: (rv: Review) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('יש לבחור דירוג'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await submitReview({ name: name.trim(), email: email.trim(), phone: phone.trim(), rating, text: text.trim() });
      onSubmitted(res.review);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'missing_fields') setError('יש למלא את כל השדות הנדרשים.');
      else setError('שגיאה בשליחה. נסו שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="rv-form" onSubmit={handleSubmit}>
      {error && <p className="booking-error" role="alert">{error}</p>}

      <div className="star-rating-wrap">
        <p className="star-rating-label">דירוג</p>
        <div className="star-rating" role="group" aria-label="בחר דירוג">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`star-btn${(hover || rating) >= n ? ' active' : ''}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              aria-label={`${n} כוכבים`}
            >★</button>
          ))}
        </div>
      </div>

      <label className="field" htmlFor="rv-text">
        <span>תגובה (אופציונלי)</span>
        <textarea
          id="rv-text"
          className="review-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ספר על החוויה שלך..."
          rows={3}
        />
      </label>

      <div className="rv-form-row">
        <label className="field" htmlFor="rv-name">
          <span>שם</span>
          <input id="rv-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="השם שלך" aria-required="true" />
        </label>
        <label className="field" htmlFor="rv-email">
          <span>אימייל</span>
          <input id="rv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" dir="ltr" aria-required="true" />
        </label>
        <label className="field" htmlFor="rv-phone">
          <span>טלפון</span>
          <input id="rv-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="050-0000000" dir="ltr" aria-required="true" />
        </label>
      </div>

      <button type="submit" className="btn-primary rv-submit-btn" disabled={busy}>
        {busy ? 'שולח…' : 'שלח ביקורת'}
      </button>
    </form>
  );
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    getReviews()
      .then((r) => { setReviews(r.reviews); })
      .catch(() => {});
  }, []);

  const handleSubmitted = (rv: Review) => {
    setReviews((prev) => [rv, ...prev]);
    setShowForm(false);
    setJustSubmitted(true);
    setShowAll(false);
  };

  const visible = showAll ? reviews : reviews.slice(0, 3);

  return (
    <section className="section reveal" id="reviews">
      <div className="section-head">
        <p className="section-kicker">מה אומרים הלקוחות</p>
        <h2 className="section-title">ביקורות</h2>
      </div>

      {justSubmitted && (
        <p className="rv-thanks">תודה! הביקורת שלך פורסמה.</p>
      )}

      {reviews.length > 0 && (
        <>
          <div className="rv-grid">
            {visible.map((rv) => (
              <div key={rv.id} className="rv-card">
                <Stars rating={rv.rating} />
                {rv.text && <p className="rv-text">{rv.text}</p>}
                <span className="rv-name">{rv.name}</span>
              </div>
            ))}
          </div>

          {reviews.length > 3 && !showAll && (
            <div className="rv-show-all">
              <button type="button" className="btn-ghost rv-show-all-btn" onClick={() => setShowAll(true)}>
                לכל הביקורות ({reviews.length})
              </button>
            </div>
          )}
        </>
      )}

      {!showForm ? (
        <div className="rv-cta">
          <button type="button" className="btn-primary" onClick={() => { setShowForm(true); setJustSubmitted(false); }}>
            כתוב ביקורת
          </button>
        </div>
      ) : (
        <div className="rv-form-wrap">
          <div className="rv-form-header">
            <h3 className="rv-form-title">הביקורת שלך</h3>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>ביטול</button>
          </div>
          <ReviewForm onSubmitted={handleSubmitted} />
        </div>
      )}
    </section>
  );
}
