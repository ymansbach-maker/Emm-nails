import express from 'express';
import cors from 'cors';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import paymentsRoutes from './routes/payments.js';
import publicPaymentsRoutes from './routes/publicPayments.js';
import appointmentRoutes from './routes/appointments.js';
import reviewRoutes from './routes/reviews.js';

if (!process.env.ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD environment variable must be set.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  })
);
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/b/:slug', publicRoutes);
app.use('/api/payments', publicPaymentsRoutes);
app.use('/api/admin/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reviews', reviewRoutes);

app.use((req, res) => res.status(404).json({ error: 'not_found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`GEMMYS API listening on port ${port}`);
});
