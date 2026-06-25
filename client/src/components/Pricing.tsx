import { config } from '../config';

export default function Pricing() {
  return (
    <section className="section pricing reveal" id="pricing">
      <div className="section-head">
        <h2 className="section-title">מחירון</h2>
      </div>
      <div className="pricing-list">
        {config.pricing.map((s, i) => (
          <div className="pricing-row" key={i}>
            <span className="pricing-name">{s.name}</span>
            <span className="pricing-dots" aria-hidden="true" />
            <span className="pricing-price">₪{s.price}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
