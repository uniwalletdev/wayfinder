-- Enable PostGIS for spatial queries (optional for MVP)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Hospitals
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Floors
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  floor_number INTEGER NOT NULL,
  floor_name TEXT NOT NULL,
  map_image_url TEXT,
  map_bounds JSONB NOT NULL DEFAULT '{"minX":0,"minY":0,"maxX":1000,"maxY":1000,"width":1000,"height":1000}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'department','bathroom','cafe','landmark','atm','pharmacy',
    'waiting_area','lift','stairs','entrance','reception'
  )),
  coordinates JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
  accessibility_features TEXT[] NOT NULL DEFAULT '{}',
  is_accessible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_floor_id ON locations(floor_id);
CREATE INDEX idx_locations_type ON locations(type);

-- QR Codes
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qr_codes_code_uuid ON qr_codes(code_uuid);

-- Routes
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  start_location_id UUID NOT NULL REFERENCES locations(id),
  end_location_id UUID NOT NULL REFERENCES locations(id),
  path_coordinates JSONB NOT NULL DEFAULT '[]',
  is_accessible BOOLEAN NOT NULL DEFAULT false,
  estimated_time_seconds INTEGER NOT NULL DEFAULT 120,
  instructions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routes_start_end ON routes(start_location_id, end_location_id, is_accessible);

-- Appointments (mock for MVP — no real PII)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_phone_hash TEXT,
  location_id UUID NOT NULL REFERENCES locations(id),
  appointment_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Navigation sessions (analytics)
CREATE TABLE IF NOT EXISTS navigation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID REFERENCES qr_codes(id),
  destination_location_id UUID NOT NULL REFERENCES locations(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  route_taken JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_nav_sessions_started_at ON navigation_sessions(started_at);

-- Row-level security: public read for MVP, restrict writes
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public read access (patients navigating anonymously)
CREATE POLICY "Public read hospitals" ON hospitals FOR SELECT USING (true);
CREATE POLICY "Public read floors" ON floors FOR SELECT USING (true);
CREATE POLICY "Public read locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Public read qr_codes" ON qr_codes FOR SELECT USING (true);
CREATE POLICY "Public read routes" ON routes FOR SELECT USING (true);
CREATE POLICY "Public insert sessions" ON navigation_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read sessions" ON navigation_sessions FOR SELECT USING (true);
-- Admin writes require service role key (set in Supabase dashboard)
