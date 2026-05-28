import { NextResponse } from "next/server"
import { pool } from "@/lib/db"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS venues (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  country     TEXT DEFAULT 'UK',
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS floor_plans (
  id          SERIAL PRIMARY KEY,
  venue_id    INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  floor       INTEGER NOT NULL,
  label       TEXT NOT NULL,
  image_url   TEXT,
  bounds      JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waypoints (
  id          SERIAL PRIMARY KEY,
  venue_id    INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  floor       INTEGER NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  description TEXT,
  qr_code     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_frames (
  id          SERIAL PRIMARY KEY,
  venue_id    INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  floor       INTEGER NOT NULL,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  heading     DOUBLE PRECISION,
  annotation  TEXT,
  image_data  TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed GOSH as venue 1 if not exists
INSERT INTO venues (id, name, address, city)
VALUES (1, 'Great Ormond Street Hospital', 'Great Ormond Street', 'London')
ON CONFLICT (id) DO NOTHING;

SELECT setval('venues_id_seq', GREATEST((SELECT MAX(id) FROM venues), 1));
`

export async function GET() {
  try {
    await pool.query(SCHEMA)
    return NextResponse.json({ ok: true, message: "Database schema created successfully" })
  } catch (error) {
    console.error("DB init error:", error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
