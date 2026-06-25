import { Router } from 'express';
import xml2js from 'xml2js';
import db from '../db.js';
import { requireAdmin } from '../auth.js';
import { DEFAULT_BUSINESS } from '../config.js';

const router = Router();
router.use(requireAdmin);

const getBusinessId = db.prepare('SELECT id FROM businesses WHERE slug = ?');

router.post('/charge', async (req, res) => {
  const { appointmentId, amount } = req.body ?? {};

  const total = Math.round(Number(amount) * 100);
  if (!Number.isFinite(total) || total < 1) {
    return res.status(400).json({ success: false, error: 'invalid_amount', message: 'סכום לא תקין' });
  }

  const bid = getBusinessId.get(DEFAULT_BUSINESS.slug)?.id;
  const appt = db.prepare('SELECT id, name, service FROM appointments WHERE id = ? AND business_id = ?')
    .get(appointmentId, bid);
  if (!appt) {
    return res.status(404).json({ success: false, error: 'not_found', message: 'תור לא נמצא' });
  }

  const HYP_TERMINAL_NUMBER = process.env.HYP_TERMINAL_NUMBER?.trim();
  const HYP_MID = process.env.HYP_MID?.trim();
  const HYP_SLAVE_TERMINAL = process.env.HYP_SLAVE_TERMINAL?.trim() || '001';
  const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://bensi-phi.vercel.app').replace(/\/$/, '');

  if (!HYP_TERMINAL_NUMBER || !HYP_MID) {
    return res.json({
      success: false,
      error: 'not_configured',
      message: 'מסוף התשלום עדיין לא הוגדר',
    });
  }

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
    '      <transactionCode>Regular</transactionCode>',
    '      <currency>ILS</currency>',
    `      <total>${total}</total>`,
    `      <mid>${HYP_MID}</mid>`,
    '      <validation>TxnSetup</validation>',
    '      <mpiValidation>AutoComm</mpiValidation>',
    `      <successUrl>${FRONTEND_URL}/payment/success</successUrl>`,
    `      <errorUrl>${FRONTEND_URL}/payment/error</errorUrl>`,
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
      return res.json({ success: false, error: 'parse_error', message: 'שגיאה בפענוח תגובת המסוף' });
    }

    const result = String(parsed?.ashrait?.response?.result ?? '');
    if (result === '0') {
      const tranId = parsed?.ashrait?.response?.doDeal?.tranId ?? null;
      return res.json({ success: true, transactionId: tranId });
    }
    return res.json({ success: false, error: result || 'terminal_error', message: 'שגיאה בשליחה לטרמינל' });
  } catch {
    return res.json({ success: false, error: 'network_error', message: 'לא ניתן להתחבר למסוף' });
  }
});

export default router;
