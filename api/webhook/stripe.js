// POST /api/webhook/stripe
// Stripe sends checkout.session.completed when payment clears. We mark the
// order paid and (if Gelato is configured) push it to Gelato for production.
import { sql } from '@vercel/postgres';
import { stripe } from '../../lib/stripe.js';
import { submitOrder } from '../../lib/gelato.js';

// Vercel: turn off automatic JSON parsing so we can verify the Stripe signature.
export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('method_not_allowed');
  }

  let event;
  try {
    const buf = await rawBody(req);
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      // Allow unsigned events in dev if SKIP is set. Never in production.
      if (process.env.STRIPE_WEBHOOK_SKIP === '1') {
        event = JSON.parse(buf.toString());
      } else {
        return res.status(500).send('webhook_secret_missing');
      }
    } else {
      event = stripe().webhooks.constructEvent(buf, sig, secret);
    }
  } catch (err) {
    console.error('stripe webhook verify failed', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata && session.metadata.order_id;
      if (!orderId) {
        console.warn('checkout.session.completed with no order_id metadata');
        return res.status(200).end('no-op');
      }

      const name = session.customer_details && session.customer_details.name;
      const email = (session.customer_details && session.customer_details.email) ||
                    session.customer_email || null;
      const addr = session.shipping_details && session.shipping_details.address;
      const shipping_address = addr
        ? {
            firstName: (name || '').split(' ')[0] || '',
            lastName: (name || '').split(' ').slice(1).join(' ') || '',
            addressLine1: addr.line1 || '',
            addressLine2: addr.line2 || '',
            city: addr.city || '',
            postCode: addr.postal_code || '',
            state: addr.state || '',
            country: addr.country || '',
            email: email || '',
            phone: session.customer_details && session.customer_details.phone || '',
          }
        : null;

      await sql`
        UPDATE orders SET
          status = 'paid',
          customer_name = ${name || null},
          customer_email = ${email || null},
          shipping_address = ${shipping_address ? JSON.stringify(shipping_address) : null}::jsonb,
          stripe_payment_id = ${session.payment_intent || null},
          updated_at = NOW()
        WHERE id = ${orderId}
      `;

      // Fire-and-forget Gelato submission if configured.
      if (process.env.GELATO_API_KEY) {
        try {
          const order = (await sql`SELECT * FROM orders WHERE id = ${orderId}`).rows[0];
          const items = (await sql`SELECT * FROM order_items WHERE order_id = ${orderId}`).rows;
          const hasAllPrintFiles = items.every((it) => it.print_url);
          if (order && hasAllPrintFiles && order.shipping_address) {
            const result = await submitOrder({ order, items });
            await sql`
              UPDATE orders SET gelato_order_id = ${result.id || result.orderId || null},
                                status = 'submitted', updated_at = NOW()
              WHERE id = ${orderId}
            `;
          } else {
            // Hold for manual submission from admin.
            await sql`
              UPDATE orders SET status = 'paid_hold',
                                notes = 'Missing print_url on some items or no shipping address — submit manually from admin.',
                                updated_at = NOW()
              WHERE id = ${orderId}
            `;
          }
        } catch (err) {
          console.error('Gelato submit failed', err);
          await sql`
            UPDATE orders SET status = 'failed',
                              notes = ${'Gelato: ' + (err.message || 'unknown')},
                              updated_at = NOW()
            WHERE id = ${orderId}
          `;
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe webhook handler failed', err);
    return res.status(500).json({ error: err.message });
  }
}
