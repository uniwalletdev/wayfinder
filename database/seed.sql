-- Create default admin user (password: changeme123 — change in production!)
INSERT INTO admin_users (email, password_hash) VALUES (
  'admin@hospital.nhs.uk',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
) ON CONFLICT DO NOTHING;

-- Demo hospital
INSERT INTO hospitals (id, name, address, timezone) VALUES
  ('00000000-0000-0000-0000-000000000001', 'City General Hospital', '1 Hospital Road, London, E1 4AA', 'Europe/London')
ON CONFLICT DO NOTHING;

-- Ground floor
INSERT INTO floors (id, hospital_id, floor_number, floor_name) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 0, 'Ground Floor')
ON CONFLICT DO NOTHING;

-- Locations
INSERT INTO locations (id, floor_id, name, type, coordinates, accessibility_features) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010', 'Main Entrance', 'entrance', '{"x":500,"y":950}', '{"Automatic doors","Wheelchair ramp"}'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', 'Outpatients Reception', 'reception', '{"x":500,"y":700}', '{"Hearing loop","Low counter"}'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000010', 'Radiology', 'department', '{"x":200,"y":400}', '{"Wheelchair accessible"}'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000010', 'Cardiology', 'department', '{"x":800,"y":400}', '{"Wheelchair accessible"}'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000010', 'Costa Coffee', 'cafe', '{"x":300,"y":800}', '{"Step-free access"}'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000010', 'Ground Floor Toilets', 'bathroom', '{"x":700,"y":600}', '{"Accessible toilet","Baby changing"}'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000010', 'Pharmacy', 'pharmacy', '{"x":600,"y":850}', '{"Wheelchair accessible"}'),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000010', 'Main Lift', 'lift', '{"x":500,"y":500}', '{"Wheelchair accessible","Audio announcements"}')
ON CONFLICT DO NOTHING;

-- QR code for main entrance
INSERT INTO qr_codes (id, code_uuid, location_id) VALUES
  ('00000000-0000-0000-0000-000000001000', '12345678-1234-1234-1234-123456789012', '00000000-0000-0000-0000-000000000100')
ON CONFLICT DO NOTHING;
