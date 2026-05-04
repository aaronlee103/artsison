// /api/admin/login
//   POST   → log in (body: { password })
//   GET    → check current session ({ authenticated: bool })
//   DELETE → log out
import { json, readBody, serverError } from '../../lib/db.js';
import { verifyPassword, issueSessionCookie, clearSessionCookie, isAuthenticated } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return json(res, { authenticated: isAuthenticated(req) });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!verifyPassword(body.password)) {
        return json(res, { error: 'invalid_password' }, 401);
      }
      res.setHeader('Set-Cookie', issueSessionCookie());
      return json(res, { ok: true });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', clearSessionCookie());
      return json(res, { ok: true });
    }
    res.setHeader('Allow', 'GET, POST, DELETE');
    return json(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return serverError(res, err);
  }
}
