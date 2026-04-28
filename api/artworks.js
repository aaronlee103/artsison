// GET  /api/artworks          → list published artworks (with artist joined)
// POST /api/artworks          → admin: create an artwork
import { sql, json, readBody, serverError, shortId } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const adminMode = req.query && (req.query.all === '1' || req.query.all === 'true');
      const rows = adminMode
        ? (await sql`
            SELECT a.*, ar.name AS artist_name, ar.short_bio AS artist_short_bio,
                   ar.location AS artist_location, ar.year AS artist_year
            FROM artworks a
            LEFT JOIN artists ar ON ar.id = a.artist_id
            ORDER BY a.sort_order ASC, a.created_at DESC
          `).rows
        : (await sql`
            SELECT a.*, ar.name AS artist_name, ar.short_bio AS artist_short_bio,
                   ar.location AS artist_location, ar.year AS artist_year
            FROM artworks a
            LEFT JOIN artists ar ON ar.id = a.artist_id
            WHERE a.published = TRUE
            ORDER BY a.sort_order ASC, a.created_at DESC
          `).rows;
      return json(res, { artworks: rows });
    }

    if (req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const id = body.id || shortId('art');
      const {
        title, artist_id, year, medium, origin, edition,
        aspect, palette, stops, description, price,
        published = true, sort_order = 0,
      } = body;
      if (!title || !aspect || price == null) {
        return json(res, { error: 'title, aspect, price are required' }, 400);
      }
      await sql`
        INSERT INTO artworks
          (id, title, artist_id, year, medium, origin, edition, aspect, palette,
           stops, description, price, published, sort_order, updated_at)
        VALUES
          (${id}, ${title}, ${artist_id || null}, ${year || null}, ${medium || null},
           ${origin || null}, ${edition || null}, ${aspect},
           ${JSON.stringify(palette || [])}::jsonb,
           ${JSON.stringify(stops || [])}::jsonb,
           ${description || null}, ${price}, ${!!published}, ${sort_order}, NOW())
      `;
      return json(res, { id }, 201);
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return serverError(res, err);
  }
}
