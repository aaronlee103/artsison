// POST /api/webhook/gelato
// Gelato posts production / fulfillment updates here. We store the raw status
// so the admin dashboard can surface progress.
import { sql, json, readBody, serverError } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, { error: 'method_not_allowed' }, 405);
  }
  try {
    const body = await readBody(req);
    const gelatoOrderId = body.orderId || body.id || body.order && body.order.id;
    const status = body.status || (body.order && body.order.fulfillmentStatus) || 'updated';
    const ref = body.orderReferenceId || body.order && body.order.orderReferenceId;

    if (ref) {
      await sql`
        UPDATE orders SET status = ${String(status).slice(0, 30)},
                          gelato_order_id = ${gelatoOrderId || null},
                          updated_at = NOW()
        WHERE id = ${ref}
      `;
    } else if (gelatoOrderId) {
      await sql`
        UPDATE orders SET status = ${String(status).slice(0, 30)},
                          updated_at = NOW()
        WHERE gelato_order_id = ${gelatoOrderId}
      `;
    }
    return json(res, { received: true });
  } catch (err) {
    return serverError(res, err);
  }
}
