// GET   /api/orders/:id                  (admin)
// POST  /api/orders/:id/gelato-submit    → manually push to Gelato (admin)
import { sql, json, readBody, serverError, notFound } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';
import { submitOrder } from '../../lib/gelato.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return json(res, { error: 'missing_id' }, 400);
  if (!requireAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      const order = (await sql`SELECT * FROM orders WHERE id = ${id}`).rows[0];
      if (!order) return notFound(res);
      const items = (await sql`SELECT * FROM order_items WHERE order_id = ${id}`).rows;
      return json(res, { order, items });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const action = body.action || 'gelato-submit';
      const order = (await sql`SELECT * FROM orders WHERE id = ${id}`).rows[0];
      if (!order) return notFound(res);
      const items = (await sql`SELECT * FROM order_items WHERE order_id = ${id}`).rows;

      if (action === 'gelato-submit') {
        const result = await submitOrder({ order, items });
        await sql`
          UPDATE orders SET gelato_order_id = ${result.id || result.orderId || null},
                            status = 'submitted', updated_at = NOW()
          WHERE id = ${id}
        `;
        return json(res, { ok: true, gelato: result });
      }

      if (action === 'set-status') {
        const status = String(body.status || '').slice(0, 30);
        await sql`UPDATE orders SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
        return json(res, { ok: true });
      }

      return json(res, { error: 'unknown_action' }, 400);
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return serverError(res, err);
  }
}
