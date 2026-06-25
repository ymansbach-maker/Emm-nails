import crypto from 'node:crypto';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function adminPassword() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    throw new Error('ADMIN_PASSWORD environment variable is not set');
  }
  return pw;
}

// Signing key derived from the password so tokens invalidate when it changes.
function signingKey() {
  return crypto.createHash('sha256').update(`gemmys-token:${adminPassword()}`).digest();
}

function sign(payload) {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('hex');
}

export function verifyPassword(candidate) {
  const expected = Buffer.from(adminPassword());
  const given = Buffer.from(String(candidate ?? ''));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function issueToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const given = parts[2];
  return expected.length === given.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
