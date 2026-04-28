-- artsison.com database schema
-- Run this once via /api/admin/migrate after Vercel Postgres is provisioned.

CREATE TABLE IF NOT EXISTS artists (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  short_bio     TEXT,
  long_bio      TEXT,
  location      TEXT,
  year          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artworks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  artist_id     TEXT REFERENCES artists(id) ON DELETE SET NULL,
  year          TEXT,
  medium        TEXT,          -- description of original source medium
  origin        TEXT,           -- studio / city / inspiration
  edition       TEXT,           -- e.g. "Open edition · signed COA"
  aspect        TEXT NOT NULL,  -- "3:4" | "4:3" | "3:2" | "1:1"
  palette       JSONB,          -- array of hex strings
  stops         JSONB,          -- gradient stops for preview
  description   TEXT,
  price         INTEGER NOT NULL, -- base price in USD whole dollars (medium canvas)
  published     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Gelato product UID mapping per (artwork, format, size)
-- Gelato expects a product UID like "canvas_product_pth-240-gsm_130x180-mm_4-0_ver"
-- so we store the mapping explicitly per variant.
CREATE TABLE IF NOT EXISTS gelato_variants (
  id            SERIAL PRIMARY KEY,
  artwork_id    TEXT REFERENCES artworks(id) ON DELETE CASCADE,
  format        TEXT NOT NULL,  -- "canvas" | "fine-art" | "poster"
  size_id       TEXT NOT NULL,  -- "small" | "medium" | "large"
  product_uid   TEXT NOT NULL,  -- Gelato product UID
  print_url     TEXT,           -- URL to high-res file hosted for Gelato
  UNIQUE(artwork_id, format, size_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                 TEXT PRIMARY KEY,   -- our internal order id (ord_xxx)
  stripe_session_id  TEXT UNIQUE,
  stripe_payment_id  TEXT,
  gelato_order_id    TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',
    -- pending | paid | submitted | in_production | shipped | delivered | failed | refunded
  customer_email     TEXT,
  customer_name      TEXT,
  shipping_address   JSONB,
  subtotal           INTEGER,
  shipping           INTEGER,
  total              INTEGER,
  currency           TEXT DEFAULT 'USD',
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      TEXT REFERENCES orders(id) ON DELETE CASCADE,
  artwork_id    TEXT,
  artwork_title TEXT,
  artist_name   TEXT,
  format        TEXT,
  size_id       TEXT,
  size_name     TEXT,
  quantity      INTEGER DEFAULT 1,
  unit_price    INTEGER,
  product_uid   TEXT,
  print_url     TEXT
);

CREATE INDEX IF NOT EXISTS idx_artworks_published ON artworks(published);
CREATE INDEX IF NOT EXISTS idx_artworks_sort ON artworks(sort_order);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
