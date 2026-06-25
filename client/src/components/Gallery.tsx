import { GALLERY } from '../gallery';

export default function Gallery() {
  return (
    <section className="section gallery reveal" id="gallery">
      <div className="section-head">
        <h2 className="section-title">העבודות שלנו</h2>
      </div>
      <div className="gallery-grid">
        {GALLERY.map((item) => (
          <figure className="gallery-item" key={item.src}>
            <img src={item.src} alt={item.alt} loading="lazy" />
          </figure>
        ))}
      </div>
    </section>
  );
}
