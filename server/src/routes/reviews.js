import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.post('/', (req, res) => {
  const { name, email, phone, rating, text } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'invalid_rating' });
  const result = db.prepare(
    'INSERT INTO reviews (name, email, phone, rating, text, anonymous, approved) VALUES (?, ?, ?, ?, ?, 0, 1)'
  ).run(name.trim(), email.trim().toLowerCase(), phone.trim(), r, text?.trim() || null);
  const review = db.prepare('SELECT id, name, rating, text, created_at FROM reviews WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ok: true, review });
});

router.get('/', (req, res) => {
  const reviews = db.prepare(
    'SELECT id, name, rating, text, created_at FROM reviews ORDER BY created_at DESC'
  ).all();
  res.json({ reviews });
});

export default router;
