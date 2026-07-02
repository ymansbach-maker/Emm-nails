import { GALLERY } from '../gallery';

const ASPECT_RATIOS = [1, 1.3, 0.8, 1.1, 0.9, 1.4];

export default function Gallery() {
  return (
    <section className="section gallery reveal" id="gallery">
      <div className="section-head section-head--start">
        <h2 className="section-title">העבודות שלנו</h2>
        <span className="section-title-underline" aria-hidden="true" />
      </div>
      <div className="gallery-grid">
        {GALLERY.map((item, i) => (
          <figure
            className="gallery-item"
            key={item.src}
            style={{ aspectRatio: ASPECT_RATIOS[i % ASPECT_RATIOS.length] }}
          >
            <img src={item.src} alt={item.alt} loading="lazy" />
          </figure>
        ))}
      </div>
    </section>
  );
}
