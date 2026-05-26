-- Seed data for development and testing

-- Insert a demo hospital
INSERT INTO hospitals (id, name, address, timezone) VALUES
  ('00000000-0000-0000-0000-000000000001', 'City General Hospital', '1 Hospital Road, London, E1 4AA', 'Europe/London');

-- Insert ground floor
INSERT INTO floors (id, hospital_id, floor_number, floor_name, map_image_url) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 0, 'Ground Floor', null);

-- Insert locations
INSERT INTO locations (id, floor_id, name, type, coordinates, accessibility_features, is_accessible) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010', 'Main Entrance', 'entrance', '{"x":500,"y":950}', '{"Automatic doors","Wheelchair ramp"}', true),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', 'Outpatients Reception', 'reception', '{"x":500,"y":700}', '{"Hearing loop","Low counter"}', true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000010', 'Radiology', 'department', '{"x":200,"y":400}', '{"Wheelchair accessible"}', true),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000010', 'Cardiology', 'department', '{"x":800,"y":400}', '{"Wheelchair accessible"}', true),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000010', 'Costa Coffee', 'cafe', '{"x":300,"y":800}', '{"Wheelchair accessible","Step-free"}', true),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000010', 'Ground Floor Toilets', 'bathroom', '{"x":700,"y":600}', '{"Accessible toilet","Baby changing"}', true),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000010', 'Pharmacy', 'pharmacy', '{"x":600,"y":850}', '{"Wheelchair accessible"}', true),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000010', 'Main Lift', 'lift', '{"x":500,"y":500}', '{"Wheelchair accessible","Audio announcements"}', true);

-- Insert a QR code for main entrance
INSERT INTO qr_codes (id, code_uuid, location_id) VALUES
  ('00000000-0000-0000-0000-000000001000', '12345678-1234-1234-1234-123456789012', '00000000-0000-0000-0000-000000000100');

-- Insert a demo route: Main Entrance → Radiology
INSERT INTO routes (id, floor_id, start_location_id, end_location_id, path_coordinates, is_accessible, estimated_time_seconds, instructions) VALUES
  (
    '00000000-0000-0000-0000-000000002000',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000102',
    '[{"x":500,"y":950},{"x":500,"y":700},{"x":350,"y":700},{"x":200,"y":700},{"x":200,"y":400}]',
    true,
    180,
    '[{"step":1,"text":"Walk straight ahead through the main corridor","coordinates":{"x":500,"y":700}},{"step":2,"text":"Turn left at Outpatients Reception","landmark":"Outpatients Reception","coordinates":{"x":350,"y":700}},{"step":3,"text":"Continue straight, Radiology is on your left","coordinates":{"x":200,"y":400}}]'
  );
