import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { config } from '../config';
import Hero from '../components/Hero';
import Gallery from '../components/Gallery';
import Pricing from '../components/Pricing';
import BookingSection from '../components/BookingSection';
import ReviewsSection from '../components/ReviewsSection';
import Contact from '../components/Contact';

export default function Home() {
  // Reveal-on-scroll animation for sections.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <nav className="site-nav">
        <Link to="/my-appointment" className="site-nav-link">ניהול התור שלי</Link>
      </nav>
      <main className="home">
      <Hero />
      <Gallery />
      <Pricing />
      <BookingSection />
      <ReviewsSection />
      <Contact />
      <footer className="footer">
        <span className="footer-logo">{config.business_name}</span>
        <span className="footer-note">{config.address}</span>
        <span className="footer-note">© {new Date().getFullYear()} כל הזכויות שמורות</span>
        <Link to="/accessibility" className="footer-a11y-link">הצהרת נגישות</Link>
      </footer>
    </main>
    </>
  );
}
