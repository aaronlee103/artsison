// GET  /api/artists
// POST /api/artists   (admin)
import { sql, json, readBody, serverError, shortId } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = (await sql`SELECT * FROM artists ORDER BY name ASC`).rows;
      return json(res, { artists: rows });
    }

    if (req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const id = body.id || shortId('art_ar');
      const { name, short_bio, long_bio, location, year } = body;
      if (!name) return json(res, { error: 'name required' }, 400);
      await sql`
        INSERT INTO artists (id, name, short_bio, long_bio, location, year)
        VALUES (${id}, ${name}, ${short_bio || null}, ${long_bio || null},
                ${location || null}, ${year || null})
      `;
      return json(res, { id }, 201);
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return serverError(res, err);
  }
}
