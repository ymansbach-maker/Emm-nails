import { Router } from 'express';
import xml2js from 'xml2js';
import db from '../db.js';
import { DEFAULT_BUSINESS, PRICING } from '../config.js';

const router = Router();
const getBusinessId = db.prepare('SELECT id FROM businesses WHERE slug = ?');

const isHypConfigured = () =>
  !!(process.env.HYP_TERMINAL_NUMBER?.trim() && process.env.HYP_MID?.trim());

// GET /api/payments/config — lets the frontend know if online payment is enabled.
// Adding credentials to Render env vars automatically flips paymentEnabled to true.
router.get('/config', (req, res) => {
  res.json({ paymentEnabled: isHypConfigured() });
});

// POST /api/payments/create-session — creates a Hyp hosted-page payment session.
router.post('/create-session', async (req, res) => {
  const { appointmentId } = req.body ?? {};
  if (!appointmentId) {
    return res.status(400).json({ success: false, error: 'missing_id' });
  }

  const HYP_TERMINAL_NUMBER = process.env.HYP_TERMINAL_NUMBER?.trim();
  const HYP_MID             = process.env.HYP_MID?.trim();
  const HYP_SLAVE_TERMINAL  = process.env.HYP_SLAVE_TERMINAL?.trim() || '001';
  const FRONTEND_URL        = (process.env.FRONTEND_URL || 'https://bensi-phi.vercel.app').replace(/\/$/, '');

  if (!HYP_TERMINAL_NUMBER || !HYP_MID) {
    return res.json({ success: false, error: 'not_configured' });
  }

  const bid  = getBusinessId.get(DEFAULT_BUSINESS.slug)?.id;
  const appt = db.prepare('SELECT id, service FROM appointments WHERE id = ? AND business_id = ?')
    .get(appointmentId, bid);
  if (!appt) {
    return res.status(404).json({ success: false, error: 'not_found' });
  }

  const pricingEntry = PRICING.find((p) => p.name === appt.service);
  if (!pricingEntry) {
    return res.status(400).json({ success: false, error: 'no_price' });
  }

  const total = pricingEntry.price * 100; // in agorot

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<ashrait>',
    '  <request>',
    '    <version>2000</version>',
    '    <language>HEB</language>',
    '    <command>doDeal</command>',
    '    <doDeal>',
    `      <terminalNumber>${HYP_TERMINAL_NUMBER}</terminalNumber>`,
    '      <cardNo>CGMPI</cardNo>',
    '      <transactionType>Debit</transactionType>',
    '      <creditType>RegularCredit</creditType>',
    '      <transactionCode>Internet</transactionCode>',
    '      <currency>ILS</currency>',
    `      <total>${total}</total>`,
    `      <mid>${HYP_MID}</mid>`,
    '      <validation>TxnSetup</validation>',
    '      <mpiValidation>AutoComm</mpiValidation>',
    `      <successUrl>${FRONTEND_URL}/payment/success?apptId=${appointmentId}</successUrl>`,
    `      <errorUrl>${FRONTEND_URL}/payment/error?apptId=${appointmentId}</errorUrl>`,
    `      <slaveTerminalNumber>${HYP_SLAVE_TERMINAL}</slaveTerminalNumber>`,
    '    </doDeal>',
    '  </request>',
    '</ashrait>',
  ].join('\n');

  try {
    const httpRes = await fetch('https://payments.hyp.co.il/payment/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xml,
    });
    const responseText = await httpRes.text();

    let parsed;
    try {
      parsed = await xml2js.parseStringPromise(responseText, { explicitArray: false, trim: true });
    } catch {
      return res.json({ success: false, error: 'parse_error' });
    }

    const result = String(parsed?.ashrait?.response?.result ?? '');
    if (result === '0') {
      const paymentUrl = parsed?.ashrait?.response?.doDeal?.redirectUrl ?? null;
      if (!paymentUrl) {
        return res.json({ success: false, error: 'no_redirect_url' });
      }
      return res.json({ success: true, paymentUrl });
    }
    return res.json({ success: false, error: result || 'terminal_error' });
  } catch {
    return res.json({ success: false, error: 'network_error' });
  }
});

// POST /api/payments/confirm — marks an appointment as paid after successful Hyp redirect.
router.post('/confirm', (req, res) => {
  const { appointmentId } = req.body ?? {};
  if (!appointmentId) {
    return res.status(400).json({ success: false, error: 'missing_id' });
  }

  const bid    = getBusinessId.get(DEFAULT_BUSINESS.slug)?.id;
  const result = db.prepare('UPDATE appointments SET paid = 1 WHERE id = ? AND business_id = ?')
    .run(appointmentId, bid);

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'not_found' });
  }
  return res.json({ success: true });
});

export default router;
