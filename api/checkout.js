// POST /api/checkout
// body: { items: [{ artworkId, format, sizeId, sizeName, quantity, unitPrice }],
//         shipping: 0|15, email?: string }
// Creates a Stripe Checkout Session, returns { url }.
// Also records a pending order row so we can match it back on the webhook.
import { sql, json, readBody, serverError, shortId } from '../lib/db.js';
import { stripe, siteUrl } from '../lib/stripe.js';
import { defaultProductUid } from '../lib/gelato.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, { error: 'method_not_allowed' }, 405);
  }
  try {
    const body = await readBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return json(res, { error: 'empty_cart' }, 400);

    // Pull artwork rows so we trust prices/titles server-side.
    const ids = [...new Set(items.map((i) => i.artworkId))];
    if (!ids.length) return json(res, { error: 'empty_cart' }, 400);
    const artRows = (await sql`
      SELECT a.id, a.title, a.aspect, a.price, ar.name AS artist_name
      FROM artworks a
      LEFT JOIN artists ar ON ar.id = a.artist_id
      WHERE a.id = ANY(${ids})
    `).rows;
    const artById = Object.fromEntries(artRows.map((a) => [a.id, a]));

    // Variant overrides (if admin set custom UIDs / print urls)
    const varRows = (await sql`
      SELECT * FROM gelato_variants WHERE artwork_id = ANY(${ids})
    `).rows;
    const variantByKey = {};
    varRows.forEach((v) => {
      variantByKey[`${v.artwork_id}:${v.format}:${v.size_id}`] = v;
    });

    // Size multipliers match the front-end (keep in sync with SIZES_BY_ASPECT).
    const SIZE_MULT = {
      '3:4':  { small: 0.55, medium: 1.0, large: 1.75 },
      '4:3':  { small: 0.55, medium: 1.0, large: 1.75 },
      '3:2':  { small: 0.5,  medium: 1.0, large: 1.55 },
      '1:1':  { small: 0.55, medium: 1.0, large: 1.6  },
    };
    const FORMAT_MULT = { canvas: 1.0, 'fine-art': 0.55, 'framed-poster': 0.65, poster: 0.30 };
    const FORMAT_NAME = {
      canvas: 'Gallery-wrap canvas',
      'fine-art': 'Fine Art giclée',
      'framed-poster': 'Framed poster (pine wood frame)',
      poster: 'Premium matte poster',
    };

    const line_items = [];
    const orderItems = [];
    let subtotal = 0;

    for (const it of items) {
      const art = artById[it.artworkId];
      if (!art) return json(res, { error: `unknown_artwork: ${it.artworkId}` }, 400);
      const format = it.format || 'canvas';
      const sizeId = it.sizeId || 'medium';
      const qty = Math.max(1, Math.min(10, parseInt(it.quantity, 10) || 1));
      const sizeMult = (SIZE_MULT[art.aspect] || SIZE_MULT['3:4'])[sizeId] || 1;
      const formatMult = FORMAT_MULT[format] || 1;
      const unit = Math.round(art.price * formatMult * sizeMult);
      subtotal += unit * qty;

      const variant = variantByKey[`${art.id}:${format}:${sizeId}`];
      const productUid = (variant && variant.product_uid) ||
        defaultProductUid(format, art.aspect, sizeId);
      const printUrl = (variant && variant.print_url) || null;

      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'usd',
          unit_amount: unit * 100,
          product_data: {
            name: `${art.title} — ${it.sizeName || sizeId}`,
            description: `${art.artist_name || ''} · ${FORMAT_NAME[format] || format}`.trim(),
            metadata: { artwork_id: art.id, format, size_id: sizeId },
          },
        },
      });

      orderItems.push({
        artwork_id: art.id,
        artwork_title: art.title,
        artist_name: art.artist_name || null,
        format,
        size_id: sizeId,
        size_name: it.sizeName || sizeId,
        quantity: qty,
        unit_price: unit,
        product_uid: productUid,
        print_url: printUrl,
      });
    }

    const shipping = subtotal > 150 ? 0 : 15;
    if (shipping > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: shipping * 100,
          product_data: { name: 'Worldwide shipping (7–10 days)' },
        },
      });
    }
    const total = subtotal + shipping;

    const orderId = shortId('ord');
    await sql`
      INSERT INTO orders (id, status, subtotal, shipping, total, currency, customer_email)
      VALUES (${orderId}, 'pending', ${subtotal}, ${shipping}, ${total}, 'USD',
              ${body.email || null})
    `;
    for (const oi of orderItems) {
      await sql`
        INSERT INTO order_items
          (order_id, artwork_id, artwork_title, artist_name, format, size_id,
           size_name, quantity, unit_price, product_uid, print_url)
        VALUES
          (${orderId}, ${oi.artwork_id}, ${oi.artwork_title}, ${oi.artist_name},
           ${oi.format}, ${oi.size_id}, ${oi.size_name}, ${oi.quantity},
           ${oi.unit_price}, ${oi.product_uid}, ${oi.print_url})
      `;
    }

    const base = siteUrl();
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: body.email || undefined,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'KR', 'AU', 'JP', 'DE', 'FR', 'NL', 'SE', 'DK', 'NO', 'FI', 'IT', 'ES'] },
      phone_number_collection: { enabled: true },
      metadata: { order_id: orderId },
      success_url: `${base}/success?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel?order=${orderId}`,
    });

    await sql`
      UPDATE orders SET stripe_session_id = ${session.id}, updated_at = NOW()
      WHERE id = ${orderId}
    `;
    return json(res, { url: session.url, orderId });
  } catch (err) {
    return serverError(res, err);
  }
}
