// GET    /api/artworks/:id  → full artwork (with artist + variants)
// PUT    /api/artworks/:id  → admin: update
// DELETE /api/artworks/:id  → admin: delete
import { sql, json, readBody, serverError, notFound } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return json(res, { error: 'missing_id' }, 400);

  try {
    if (req.method === 'GET') {
      const rows = (await sql`
        SELECT a.*, ar.name AS artist_name, ar.short_bio AS artist_short_bio,
               ar.long_bio AS artist_long_bio, ar.location AS artist_location,
               ar.year AS artist_year
        FROM artworks a
        LEFT JOIN artists ar ON ar.id = a.artist_id
        WHERE a.id = ${id} LIMIT 1
      `).rows;
      if (!rows.length) return notFound(res);
      const variants = (await sql`
        SELECT format, size_id, product_uid, print_url
        FROM gelato_variants WHERE artwork_id = ${id}
      `).rows;
      return json(res, { artwork: rows[0], variants });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const existing = (await sql`SELECT * FROM artworks WHERE id = ${id}`).rows[0];
      if (!existing) return notFound(res);
      const merged = { ...existing, ...body };
      await sql`
        UPDATE artworks SET
          title = ${merged.title},
          artist_id = ${merged.artist_id || null},
          year = ${merged.year || null},
          medium = ${merged.medium || null},
          origin = ${merged.origin || null},
          edition = ${merged.edition || null},
          aspect = ${merged.aspect},
          palette = ${JSON.stringify(merged.palette || [])}::jsonb,
          stops = ${JSON.stringify(merged.stops || [])}::jsonb,
          description = ${merged.description || null},
          price = ${merged.price},
          published = ${!!merged.published},
          sort_order = ${merged.sort_order || 0},
          updated_at = NOW()
        WHERE id = ${id}
      `;
      return json(res, { ok: true });
    }

    if (req.method === 'DELETE') {
      if (!requireAuth(req, res)) return;
      await sql`DELETE FROM artworks WHERE id = ${id}`;
      return json(res, { ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
    return json(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return serverError(res, err);
  }
}
