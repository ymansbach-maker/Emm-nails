import { Link } from 'react-router-dom';
import { config } from '../config';

export default function AccessibilityStatement() {
  return (
    <div className="a11y-statement-page" dir="rtl">
      <nav className="site-nav">
        <Link to="/" className="site-nav-link">← חזרה לאתר</Link>
      </nav>
      <main className="a11y-statement-main">
        <h1>הצהרת נגישות</h1>

        <p>
          <strong>{config.business_name}</strong> פועלת לאפשר שימוש שווה ונוח באתר לאנשים עם מוגבלויות,
          בהתאם לתקן ישראלי 5568 (המבוסס על {' '}
          <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> 2.0 AA)
          ובהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998.
        </p>

        <h2>רמת הנגישות</h2>
        <p>
          האתר עומד ברמת נגישות <strong>AA</strong> של תקן WCAG 2.0 ובתקן ישראלי 5568.
        </p>

        <h2>התאמות הנגישות באתר</h2>
        <ul>
          <li>האתר בנוי בשפה העברית עם כיוון קריאה מימין לשמאל (<abbr title="Right To Left">RTL</abbr>).</li>
          <li>ניתן לנווט באתר באמצעות מקלדת בלבד.</li>
          <li>כל התמונות מכילות תיאור טקסטואלי חלופי (<code>alt</code>).</li>
          <li>הניגודיות בין הטקסט לרקע עומדת בדרישות AA.</li>
          <li>טפסים מכילים תוויות (<code>label</code>) ברורות לכל שדה.</li>
          <li>הכפתורים מוגדרים עם תיאור נגיש (<code>aria-label</code>).</li>
          <li>האתר תומך בהגדלת גופן עד 150% ללא אובדן תוכן.</li>
        </ul>

        <h2>כלי הנגישות</h2>
        <p>
          האתר כולל כפתור נגישות קבוע בפינה השמאלית-תחתונה של המסך המאפשר:
        </p>
        <ul>
          <li>הגדלה והקטנה של גודל הגופן.</li>
          <li>הפעלת ניגודיות גבוהה.</li>
          <li>מעבר לתצוגה בגווני אפור.</li>
          <li>הדגשת קישורים.</li>
          <li>עצירת אנימציות.</li>
          <li>הגדלת הסמן.</li>
        </ul>
        <p>ההעדפות נשמרות לביקור הבא.</p>

        <h2>פרטי יצירת קשר בנושא נגישות</h2>
        <p>
          נתקלתם בבעיית נגישות? נשמח לשמוע ולתקן:
        </p>
        <ul>
          <li>טלפון: <a href={`tel:${config.phone.replace(/-/g, '')}`}>{config.phone}</a></li>
          <li>כתובת: {config.address}</li>
        </ul>
        <p>אנו מתחייבים לטפל בפניות נגישות בתוך 5 ימי עסקים.</p>

        <h2>תאריך עדכון אחרון</h2>
        <p>הצהרה זו עודכנה לאחרונה ביוני 2026.</p>
      </main>
    </div>
  );
}
