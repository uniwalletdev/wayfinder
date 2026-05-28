import { NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { slog } from "@/lib/logger"

const SCHEMA = `
CREATE TABLE IF NOT EXISTS venues (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  country     TEXT DEFAULT 'UK',
  logo_url    TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE venues ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS floors INTEGER DEFAULT 1;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS venue_type TEXT;

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

CREATE TABLE IF NOT EXISTS gps_traces (
  id          SERIAL PRIMARY KEY,
  venue_id    INTEGER REFERENCES venues(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  heading     DOUBLE PRECISION,
  accuracy    DOUBLE PRECISION,
  floor       INTEGER DEFAULT 0,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed GOSH as venue 1 with real coordinates
INSERT INTO venues (id, name, address, city, lat, lng)
VALUES (1, 'Great Ormond Street Hospital', 'Great Ormond Street', 'London', 51.5225, -0.1199)
ON CONFLICT (id) DO NOTHING;

UPDATE venues SET lat = 51.5225, lng = -0.1199 WHERE id = 1 AND lat IS NULL;

SELECT setval('venues_id_seq', GREATEST((SELECT MAX(id) FROM venues), 1));
`

export async function GET() {
  try {
    slog.info("api:db-init", "Running schema migration")
    await pool.query(SCHEMA)
    slog.info("api:db-init", "Schema migration complete")
    return NextResponse.json({ ok: true, message: "Database schema created successfully" })
  } catch (error) {
    slog.error("api:db-init", error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
