import { sql, json, readBody, serverError, notFound } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return json(res, { error: 'missing_id' }, 400);
  try {
    if (req.method === 'GET') {
      const rows = (await sql`SELECT * FROM artists WHERE id = ${id}`).rows;
      if (!rows.length) return notFound(res);
      return json(res, { artist: rows[0] });
    }
    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req);
      const existing = (await sql`SELECT * FROM artists WHERE id = ${id}`).rows[0];
      if (!existing) return notFound(res);
      const merged = { ...existing, ...body };
      await sql`
        UPDATE artists SET
          name = ${merged.name},
          short_bio = ${merged.short_bio || null},
          long_bio = ${merged.long_bio || null},
          location = ${merged.location || null},
          year = ${merged.year || null}
        WHERE id = ${id}
      `;
      return json(res, { ok: true });
    }
    if (req.method === 'DELETE') {
      if (!requireAuth(req, res)) return;
      await sql`DELETE FROM artists WHERE id = ${id}`;
      return json(res, { ok: true });
    }
    res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
    return json(res, { error: 'method_not_allowed' }, 405);
  } catch (err) {
    return serverError(res, err);
  }
}
