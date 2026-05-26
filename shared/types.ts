export interface Hospital {
  id: string;
  name: string;
  address: string;
  timezone: string;
  created_at: string;
}

export interface Floor {
  id: string;
  hospital_id: string;
  floor_number: number;
  floor_name: string;
  map_image_url: string;
  map_bounds: MapBounds;
  created_at: string;
}

export interface Location {
  id: string;
  floor_id: string;
  name: string;
  description?: string;
  type: LocationType;
  coordinates: Coordinates;
  accessibility_features: string[];
  is_accessible: boolean;
}

export type LocationType =
  | 'department'
  | 'bathroom'
  | 'cafe'
  | 'landmark'
  | 'atm'
  | 'pharmacy'
  | 'waiting_area'
  | 'lift'
  | 'stairs'
  | 'entrance'
  | 'reception';

export interface QRCode {
  id: string;
  code_uuid: string;
  location_id: string;
  location?: Location;
  created_at: string;
}

export interface Route {
  id: string;
  floor_id: string;
  start_location_id: string;
  end_location_id: string;
  path_coordinates: Coordinates[];
  is_accessible: boolean;
  estimated_time_seconds: number;
  instructions: RouteInstruction[];
}

export interface RouteInstruction {
  step: number;
  text: string;
  landmark?: string;
  coordinates: Coordinates;
}

export interface Appointment {
  id: string;
  patient_phone_hash: string;
  location_id: string;
  location?: Location;
  appointment_time: string;
}

export interface NavigationSession {
  id: string;
  qr_code_id: string;
  destination_location_id: string;
  started_at: string;
  completed_at?: string;
  route_taken: Coordinates[];
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface AnalyticsSummary {
  daily_active_users: number;
  total_sessions: number;
  completion_rate: number;
  avg_navigation_time_seconds: number;
  top_destinations: Array<{ location_id: string; name: string; count: number }>;
  popular_qr_locations: Array<{ location_id: string; name: string; scans: number }>;
}
