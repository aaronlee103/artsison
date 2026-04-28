import { json } from '../../lib/db.js';
import { isAuthenticated } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, { error: 'method_not_allowed' }, 405);
  }
  return json(res, { authenticated: isAuthenticated(req) });
}
