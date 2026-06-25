import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface A11yPrefs {
  fontSize: number;        // +% offset: 0 | 10 | 20 | 30 | 40 | 50
  highContrast: boolean;
  grayscale: boolean;
  highlightLinks: boolean;
  pauseAnimations: boolean;
  largeCursor: boolean;
}

const DEFAULT: A11yPrefs = {
  fontSize: 0,
  highContrast: false,
  grayscale: false,
  highlightLinks: false,
  pauseAnimations: false,
  largeCursor: false,
};

const STORAGE_KEY = 'a11y_prefs';

function loadPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<A11yPrefs>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function applyPrefs(prefs: A11yPrefs) {
  const html = document.documentElement;
  html.style.fontSize = prefs.fontSize > 0 ? `${100 + prefs.fontSize}%` : '';
  html.classList.toggle('a11y-high-contrast', prefs.highContrast);
  html.classList.toggle('a11y-grayscale', prefs.grayscale);
  html.classList.toggle('a11y-highlight-links', prefs.highlightLinks);
  html.classList.toggle('a11y-pause-animations', prefs.pauseAnimations);
  html.classList.toggle('a11y-large-cursor', prefs.largeCursor);
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(loadPrefs);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // Apply + persist whenever prefs change.
  useEffect(() => {
    applyPrefs(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Apply on first mount (page reload with saved prefs).
  useEffect(() => { applyPrefs(loadPrefs()); }, []);

  // Keyboard: Escape closes, Tab traps inside panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); fabRef.current?.focus(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const els = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
      );
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button')?.focus(), 50);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const set = <K extends keyof A11yPrefs>(key: K, val: A11yPrefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: val }));

  return (
    <>
      {/* FAB */}
      <button
        ref={fabRef}
        type="button"
        className="a11y-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="פתח תפריט נגישות"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="22" height="22">
          <circle cx="12" cy="4" r="2" />
          <path d="M10 7a2 2 0 0 0-1.73 1L6 12h2.5l1 3-2 6h2l1.5-4.5L12 18l1 2.5 1.5 1.5h2l-2-6 1-3H18l-2.27-4A2 2 0 0 0 14 7h-4z" />
        </svg>
        <span className="a11y-fab-label" aria-hidden="true">נגישות</span>
      </button>

      {/* Backdrop */}
      {open && <div className="a11y-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט נגישות"
        className={`a11y-panel${open ? ' a11y-panel--open' : ''}`}
        dir="rtl"
        aria-hidden={!open}
      >
        <div className="a11y-panel-header">
          <h2 className="a11y-panel-title">נגישות</h2>
          <button
            type="button"
            className="a11y-close"
            onClick={() => { setOpen(false); fabRef.current?.focus(); }}
            aria-label="סגור תפריט נגישות"
            tabIndex={open ? 0 : -1}
          >✕</button>
        </div>

        <div className="a11y-body">
          {/* Font size */}
          <div className="a11y-row">
            <span className="a11y-row-label">
              גודל גופן{prefs.fontSize > 0 ? ` (+${prefs.fontSize}%)` : ''}
            </span>
            <div className="a11y-btn-pair">
              <button
                type="button"
                className="a11y-ctrl"
                onClick={() => set('fontSize', Math.max(0, prefs.fontSize - 10))}
                aria-label="הקטן גופן"
                disabled={prefs.fontSize === 0}
                tabIndex={open ? 0 : -1}
              >א-</button>
              <button
                type="button"
                className="a11y-ctrl"
                onClick={() => set('fontSize', Math.min(50, prefs.fontSize + 10))}
                aria-label="הגדל גופן"
                disabled={prefs.fontSize === 50}
                tabIndex={open ? 0 : -1}
              >א+</button>
            </div>
          </div>

          {/* Toggles */}
          {(
            [
              ['highContrast',    'ניגודיות גבוהה'],
              ['grayscale',       'גווני אפור'],
              ['highlightLinks',  'הדגש קישורים'],
              ['pauseAnimations', 'עצור אנימציות'],
              ['largeCursor',     'סמן גדול'],
            ] as [keyof A11yPrefs, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`a11y-toggle${prefs[key] ? ' a11y-toggle--on' : ''}`}
              onClick={() => set(key, !prefs[key])}
              aria-pressed={prefs[key] as boolean}
              tabIndex={open ? 0 : -1}
            >
              <span className="a11y-toggle-dot" aria-hidden="true" />
              {label}
            </button>
          ))}

          <div className="a11y-divider" />

          <Link
            to="/accessibility-statement"
            className="a11y-statement-link"
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
          >
            הצהרת נגישות ←
          </Link>

          <button
            type="button"
            className="a11y-reset"
            onClick={() => setPrefs(DEFAULT)}
            tabIndex={open ? 0 : -1}
          >
            איפוס הגדרות
          </button>
        </div>
      </div>
    </>
  );
}
