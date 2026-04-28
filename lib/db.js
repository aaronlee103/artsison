// Thin wrapper around @vercel/postgres so the rest of the code reads cleanly.
import { sql } from '@vercel/postgres';

export { sql };

export function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data));
}

export function badRequest(res, message) {
  return json(res, { error: message }, 400);
}

export function serverError(res, err) {
  console.error(err);
  return json(res, { error: err.message || 'internal_error' }, 500);
}

export function notFound(res) {
  return json(res, { error: 'not_found' }, 404);
}

// Reads a JSON body off a raw Node request. Vercel already parses JSON for us
// when content-type is application/json, but we fall back gracefully.
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

// Short random id generator for order ids etc.
export function shortId(prefix = '') {
  const raw = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return prefix ? `${prefix}_${raw}` : raw;
}
