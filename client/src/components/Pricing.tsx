import { config } from '../config';

export default function Pricing() {
  return (
    <section className="section pricing reveal" id="pricing">
      <div className="section-head">
        <h2 className="section-title">מחירון <span aria-hidden="true">✨</span></h2>
      </div>
      <div className="pricing-grid">
        {config.pricing.map((s, i) => (
          <div className="pricing-card" key={i}>
            <span className="pricing-name">{s.name}</span>
            <span className="pricing-price-pill">₪{s.price}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
