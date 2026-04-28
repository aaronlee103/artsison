// GET /api/orders  (admin only)
import { sql, json, serverError } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return json(res, { error: 'method_not_allowed' }, 405);
    }
    if (!requireAuth(req, res)) return;
    const orders = (await sql`
      SELECT o.*, (
        SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id
      ) AS items
      FROM orders o
      ORDER BY o.created_at DESC
      LIMIT 200
    `).rows;
    return json(res, { orders });
  } catch (err) {
    return serverError(res, err);
  }
}
