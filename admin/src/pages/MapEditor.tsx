import React, { useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { LocationType, Coordinates } from '../types';

interface PinnedLocation {
  name: string;
  type: LocationType;
  coordinates: Coordinates;
}

const LOCATION_TYPES: LocationType[] = [
  'department', 'bathroom', 'cafe', 'landmark', 'atm',
  'pharmacy', 'waiting_area', 'lift', 'stairs', 'entrance', 'reception',
];

export default function MapEditor() {
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [pins, setPins] = useState<PinnedLocation[]>([]);
  const [pendingPin, setPendingPin] = useState<Coordinates | null>(null);
  const [newLocation, setNewLocation] = useState({ name: '', type: 'department' as LocationType });
  const [uploading, setUploading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const { data, error } = await supabase.storage
      .from('floor-plans')
      .upload(`plans/${Date.now()}-${file.name}`, file);

    if (!error && data) {
      const { data: urlData } = supabase.storage.from('floor-plans').getPublicUrl(data.path);
      setFloorPlanUrl(urlData.publicUrl);
    }
    setUploading(false);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000);
    setPendingPin({ x, y });
  };

  const confirmPin = () => {
    if (!pendingPin || !newLocation.name) return;
    setPins((prev) => [...prev, { ...newLocation, coordinates: pendingPin }]);
    setPendingPin(null);
    setNewLocation({ name: '', type: 'department' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Map Editor</h3>
          <p className="text-sm text-gray-500 mt-1">Upload floor plans and pin locations</p>
        </div>
        <label className="btn-primary cursor-pointer bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors">
          {uploading ? 'Uploading...' : 'Upload Floor Plan'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFloorPlanUpload} />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div
            ref={mapRef}
            className="relative bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden cursor-crosshair"
            style={{ height: '500px' }}
            onClick={handleMapClick}
          >
            {floorPlanUrl ? (
              <img src={floorPlanUrl} alt="Floor plan" className="w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <span className="text-5xl mb-4">🗺️</span>
                <p className="font-medium">Upload a floor plan to get started</p>
                <p className="text-sm mt-1">Click to place location pins once uploaded</p>
              </div>
            )}

            {pins.map((pin, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 bg-primary-500 rounded-full border-2 border-white shadow-md -translate-x-2 -translate-y-2"
                style={{ left: `${(pin.coordinates.x / 1000) * 100}%`, top: `${(pin.coordinates.y / 1000) * 100}%` }}
                title={pin.name}
              />
            ))}

            {pendingPin && (
              <div
                className="absolute w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow-md -translate-x-2 -translate-y-2 animate-pulse"
                style={{ left: `${(pendingPin.x / 1000) * 100}%`, top: `${(pendingPin.y / 1000) * 100}%` }}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          {pendingPin && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-gray-800">Add Location</h4>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Location name"
                value={newLocation.name}
                onChange={(e) => setNewLocation((p) => ({ ...p, name: e.target.value }))}
              />
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={newLocation.type}
                onChange={(e) => setNewLocation((p) => ({ ...p, type: e.target.value as LocationType }))}
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
              <button
                onClick={confirmPin}
                disabled={!newLocation.name}
                className="w-full bg-primary-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Confirm Pin
              </button>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 mb-3">Pinned Locations ({pins.length})</h4>
            {pins.length === 0 ? (
              <p className="text-sm text-gray-400">Click on the map to add locations</p>
            ) : (
              <ul className="space-y-2">
                {pins.map((pin, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 bg-primary-500 rounded-full" />
                    <span className="font-medium">{pin.name}</span>
                    <span className="text-gray-400 text-xs capitalize">{pin.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
