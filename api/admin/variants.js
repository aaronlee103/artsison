// PUT /api/admin/variants
// body: { artwork_id, format, size_id, product_uid, print_url }
// Upserts a Gelato variant override for a specific artwork/format/size.
import { sql, json, readBody, serverError } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  try {
    if (req.method === 'GET') {
      const { artwork_id } = req.query;
      const rows = artwork_id
        ? (await sql`SELECT * FROM gelato_variants WHERE artwork_id = ${artwork_id}`).rows
        : (await sql`SELECT * FROM gelato_variants`).rows;
      return json(res, { variants: rows });
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readBody(req);
      const { artwork_id, format, size_id, product_uid, print_url } = body;
      if (!artwork_id || !format || !size_id || !product_uid) {
        return json(res, { error: 'artwork_id, format, size_id, product_uid required' }, 400);
      }
      await sql`
        INSERT INTO gelato_variants (artwork_id, format, size_id, product_uid, print_url)
        VALUES (${artwork_id}, ${format}, ${size_id}, ${product_uid}, ${print_url || null})
        ON CONFLICT (artwork_id, format, size_id)
        DO UPDATE SET product_uid = EXCLUDED.product_uid, print_url = EXCLUDED.print_url
      `;
      return json(res, { ok: true });
    }
    if (req.method === 'DELETE') {
      const body = await readBody(req);
      await sql`
        DELETE FROM gelato_variants
        WHERE artwork_id = ${body.artwork_id}
          AND format = ${body.format}
          AND size_id = ${body.size_id}
      `;
      return json(res, { ok: true });
    }
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return json(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return serverError(res, err);
  }
}
