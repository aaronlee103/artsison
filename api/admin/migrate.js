// POST /api/admin/migrate  (admin)
// Runs schema.sql and (optionally) seeds with the built-in catalog.
import { sql, json, readBody, serverError } from '../../lib/db.js';
import { requireAuth } from '../../lib/auth.js';

const SEED_ARTISTS = [
  { id: 'ar_hae',   name: 'Hae-jin Park',    short_bio: 'Seoul-based painter working in oil and pastel.',
    long_bio: 'Hae-jin\'s work sits between color-field painting and quiet landscape. She works from small studies made in the mountains of Gangwon-do.',
    location: 'Seoul, KR', year: 'b. 1995' },
  { id: 'ar_mika',  name: 'Mika Ihara',     short_bio: 'Tokyo-based printmaker and illustrator.',
    long_bio: 'Mika makes intaglio and woodblock prints by hand, often combining traditional gampi paper with sumi ink.',
    location: 'Tokyo, JP', year: 'b. 1993' },
  { id: 'ar_leo',   name: 'Leo Rousseau',   short_bio: 'Marseille-based painter, predominantly in oil.',
    long_bio: 'Leo paints the Mediterranean coast with palette-knife impasto. His studio sits a block from the sea.',
    location: 'Marseille, FR', year: 'b. 1991' },
  { id: 'ar_ines',  name: 'Inês Almeida',   short_bio: 'Lisbon-based illustrator and botanical artist.',
    long_bio: 'Inês studies botanical subjects in watercolor and gouache, then reinterprets them in bold graphic compositions.',
    location: 'Lisbon, PT', year: 'b. 1994' },
];

const SEED_ART = [
  { id: 'art_pine',   title: 'Pine Canopy',            artist_id: 'ar_hae',   year: '2024',
    medium: 'Oil on linen, 60 × 80 cm', origin: 'Studio, Seoul', edition: 'Open edition · signed COA',
    aspect: '3:4', price: 115,
    palette: ['#1e3a2c', '#3d5a3a', '#7a9a5a', '#d8c474'],
    stops: [ { c: '#0f2418', p: 0 }, { c: '#2a4a32', p: 30 }, { c: '#7a9a5a', p: 70 }, { c: '#f0d888', p: 100 } ],
    description: 'A close study of pine canopy light in late afternoon.', sort_order: 1 },
  { id: 'art_tide',   title: 'Morning Tide',           artist_id: 'ar_leo',   year: '2024',
    medium: 'Oil on canvas, 70 × 100 cm', origin: 'Cassis, FR', edition: 'Open edition · signed COA',
    aspect: '3:2', price: 145,
    palette: ['#1a3a5a', '#4a7ab0', '#b8d4e8', '#f0e4d4'],
    stops: [ { c: '#0d1f38', p: 0 }, { c: '#2a5080', p: 35 }, { c: '#b8d4e8', p: 75 }, { c: '#faecd8', p: 100 } ],
    description: 'Morning light across a calm Mediterranean bay.', sort_order: 2 },
  { id: 'art_parch',  title: 'Parchment No.7',         artist_id: 'ar_mika',  year: '2023',
    medium: 'Intaglio on gampi paper, 40 × 30 cm', origin: 'Tokyo studio', edition: 'Edition of 40 · signed',
    aspect: '4:3', price: 125,
    palette: ['#f4e8d0', '#c8a878', '#8a6a48', '#3a2a1c'],
    stops: [ { c: '#f8eed8', p: 0 }, { c: '#d4b488', p: 40 }, { c: '#7a5a3c', p: 80 }, { c: '#2a1a10', p: 100 } ],
    description: 'A quiet study in warm parchment tones.', sort_order: 3 },
  { id: 'art_blue',   title: 'Blue Hour',              artist_id: 'ar_hae',   year: '2024',
    medium: 'Oil on linen, 50 × 70 cm', origin: 'Gangwon-do', edition: 'Open edition · signed COA',
    aspect: '3:4', price: 115,
    palette: ['#0a1a3a', '#2a3a6a', '#6a7aa8', '#d0d8e8'],
    stops: [ { c: '#050e24', p: 0 }, { c: '#1a2a50', p: 40 }, { c: '#5a6a98', p: 75 }, { c: '#d8e0ee', p: 100 } ],
    description: 'The short stretch of blue just before night.', sort_order: 4 },
  { id: 'art_field',  title: 'Field Notation',         artist_id: 'ar_ines',  year: '2024',
    medium: 'Gouache on paper, 30 × 40 cm', origin: 'Lisbon', edition: 'Open edition · signed COA',
    aspect: '3:4', price: 95,
    palette: ['#e8e0c8', '#c8b898', '#8a7858', '#4a3a2a'],
    stops: [ { c: '#f0e8d0', p: 0 }, { c: '#d4c4a0', p: 40 }, { c: '#8a7858', p: 80 }, { c: '#3a2a1c', p: 100 } ],
    description: 'Notation from the field, simplified to color and form.', sort_order: 5 },
  { id: 'art_interior', title: 'Quiet Interior',       artist_id: 'ar_leo',   year: '2023',
    medium: 'Oil on canvas, 80 × 60 cm', origin: 'Marseille', edition: 'Open edition · signed COA',
    aspect: '3:4', price: 135,
    palette: ['#3a2a1c', '#8a6a48', '#c8a878', '#f0e4d4'],
    stops: [ { c: '#2a1810', p: 0 }, { c: '#6a4c30', p: 30 }, { c: '#c8a878', p: 70 }, { c: '#f4e8d0', p: 100 } ],
    description: 'Afternoon light in a small Marseille studio.', sort_order: 6 },
  { id: 'art_terrain','title': 'Terrain 03',           artist_id: 'ar_hae',   year: '2024',
    medium: 'Oil on linen, 50 × 75 cm', origin: 'Seoul', edition: 'Open edition · signed COA',
    aspect: '3:2', price: 115,
    palette: ['#2a3828', '#5a6a4a', '#a8a888', '#d8d4b8'],
    stops: [ { c: '#1a2418', p: 0 }, { c: '#3a4a30', p: 35 }, { c: '#8a9a78', p: 75 }, { c: '#e0ddc0', p: 100 } ],
    description: 'Layered terrain simplified to three bands of light.', sort_order: 7 },
  { id: 'art_pears',  title: 'Still Life — Pears',     artist_id: 'ar_leo',   year: '2024',
    medium: 'Oil on panel, 40 × 30 cm', origin: 'Marseille', edition: 'Open edition · signed COA',
    aspect: '4:3', price: 145,
    palette: ['#3a2818', '#8a6a48', '#b8a878', '#e8d8a8'],
    stops: [ { c: '#1e140c', p: 0 }, { c: '#6a4c30', p: 35 }, { c: '#b8a078', p: 75 }, { c: '#eed8a8', p: 100 } ],
    description: 'Three pears and a shadow.', sort_order: 8 },
];

async function runSchema() {
  // We can't execute the entire schema.sql as one tagged-template, so we
  // issue each CREATE TABLE / CREATE INDEX as a separate statement.
  await sql`
    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_bio TEXT,
      long_bio TEXT,
      location TEXT,
      year TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS artworks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
      year TEXT,
      medium TEXT,
      origin TEXT,
      edition TEXT,
      aspect TEXT NOT NULL,
      palette JSONB,
      stops JSONB,
      description TEXT,
      price INTEGER NOT NULL,
      published BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS gelato_variants (
      id SERIAL PRIMARY KEY,
      artwork_id TEXT REFERENCES artworks(id) ON DELETE CASCADE,
      format TEXT NOT NULL,
      size_id TEXT NOT NULL,
      product_uid TEXT NOT NULL,
      print_url TEXT,
      UNIQUE(artwork_id, format, size_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      stripe_session_id TEXT UNIQUE,
      stripe_payment_id TEXT,
      gelato_order_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_email TEXT,
      customer_name TEXT,
      shipping_address JSONB,
      subtotal INTEGER,
      shipping INTEGER,
      total INTEGER,
      currency TEXT DEFAULT 'USD',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
      artwork_id TEXT,
      artwork_title TEXT,
      artist_name TEXT,
      format TEXT,
      size_id TEXT,
      size_name TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price INTEGER,
      product_uid TEXT,
      print_url TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_artworks_published ON artworks(published)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_artworks_sort ON artworks(sort_order)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email)`;
}

async function seed() {
  for (const a of SEED_ARTISTS) {
    await sql`
      INSERT INTO artists (id, name, short_bio, long_bio, location, year)
      VALUES (${a.id}, ${a.name}, ${a.short_bio}, ${a.long_bio}, ${a.location}, ${a.year})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  for (const a of SEED_ART) {
    await sql`
      INSERT INTO artworks (id, title, artist_id, year, medium, origin, edition,
                            aspect, palette, stops, description, price,
                            published, sort_order)
      VALUES (${a.id}, ${a.title}, ${a.artist_id}, ${a.year}, ${a.medium},
              ${a.origin}, ${a.edition}, ${a.aspect},
              ${JSON.stringify(a.palette)}::jsonb,
              ${JSON.stringify(a.stops)}::jsonb,
              ${a.description}, ${a.price}, TRUE, ${a.sort_order})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, { error: 'method_not_allowed' }, 405);
  }
  if (!requireAuth(req, res)) return;
  try {
    const body = await readBody(req);
    await runSchema();
    if (body.seed) await seed();
    return json(res, { ok: true, seeded: !!body.seed });
  } catch (err) {
    return serverError(res, err);
  }
}
