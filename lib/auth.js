// Simple password-based admin auth using a signed session cookie.
// Nothing fancy — good enough for a single-admin MVP on Vercel.
import crypto from 'crypto';

const COOKIE_NAME = 'artsison_admin';
const SESSION_TTL_HOURS = 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is required');
  return s;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

export function issueSessionCookie() {
  const exp = Date.now() + SESSION_TTL_HOURS * 3600 * 1000;
  const payload = `ok.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_HOURS * 3600}`,
  ].join('; ');
  return cookie;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [flag, expStr, sig] = parts;
  const payload = `${flag}.${expStr}`;
  if (sign(payload) !== sig) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return flag === 'ok';
}

export function requireAuth(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ error: 'unauthorized' }));
    return false;
  }
  return true;
}

export function verifyPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (typeof input !== 'string') return false;
  // constant-time compare
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
