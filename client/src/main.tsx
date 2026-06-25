import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import MyAppointment from './pages/MyAppointment';
import AccessibilityStatement from './pages/AccessibilityStatement';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentError from './pages/PaymentError';
import AccessibilityWidget from './components/AccessibilityWidget';
import { config } from './config';
import './styles.css';

// Apply brand colors from config as CSS custom properties so styles.css
// never needs editing when deploying for a new client.
const { colors } = config;
const root = document.documentElement;
root.style.setProperty('--bg',                     colors.bg);
root.style.setProperty('--color-bg',               colors.bg);
root.style.setProperty('--bg-raised',              colors.surface);
root.style.setProperty('--color-surface',          colors.surface);
root.style.setProperty('--line',                   colors.border);
root.style.setProperty('--line-strong',            colors.border);
root.style.setProperty('--color-border',           colors.border);
root.style.setProperty('--gold',                   colors.primary);
root.style.setProperty('--color-accent-primary',   colors.primary);
root.style.setProperty('--copper',                 colors.secondary);
root.style.setProperty('--color-accent-secondary', colors.secondary);
root.style.setProperty('--text',                   colors.text);
root.style.setProperty('--color-text',             colors.text);
root.style.setProperty('--text-dim',               colors.text_muted);
root.style.setProperty('--color-text-muted',       colors.text_muted);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AccessibilityWidget />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/my-appointment" element={<MyAppointment />} />
        <Route path="/accessibility" element={<AccessibilityStatement />} />
        <Route path="/accessibility-statement" element={<AccessibilityStatement />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/error" element={<PaymentError />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
