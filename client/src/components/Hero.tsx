import React from 'react';
import { config } from '../config';

export default function Hero() {
  const scrollToBooking = () => {
    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="hero">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-content">
        <h1 className="sr-only">{config.business_name}</h1>
        <img src="/images/logo.png" alt={`לוגו ${config.business_name}`} className="hero-logo" aria-hidden="true" />
        <p className="hero-badge">{config.hero_badge}</p>
        <p className="hero-sub">{config.tagline}</p>
        <button className="btn-primary hero-cta" onClick={scrollToBooking}>
          קבע תור
        </button>
        <div className="hero-hours">
          {config.hours_display.map((line, i) => (
            <React.Fragment key={line}>
              {i > 0 && <span className="hero-hours-sep" aria-hidden="true">·</span>}
              <span>{line}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="hero-scroll-hint" aria-hidden="true">
        <span />
      </div>
    </header>
  );
}
