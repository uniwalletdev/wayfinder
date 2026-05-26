import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../services/supabase';
import { Location } from '../types';

interface QREntry {
  id: string;
  code_uuid: string;
  location: Location;
}

export default function QRCodes() {
  const [qrCodes, setQrCodes] = useState<QREntry[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase
      .from('qr_codes')
      .select('*, location:locations(*)')
      .then(({ data }) => setQrCodes((data as QREntry[]) ?? []));

    supabase
      .from('locations')
      .select('*')
      .then(({ data }) => setLocations((data as Location[]) ?? []));
  }, []);

  const generateQRCode = async () => {
    if (!selectedLocation) return;
    setGenerating(true);
    const codeUuid = crypto.randomUUID();

    const { data, error } = await supabase
      .from('qr_codes')
      .insert({ code_uuid: codeUuid, location_id: selectedLocation })
      .select('*, location:locations(*)')
      .single();

    if (!error && data) {
      setQrCodes((prev) => [...prev, data as QREntry]);
    }
    setGenerating(false);
  };

  const downloadQR = (code: QREntry) => {
    const svg = document.getElementById(`qr-${code.id}`);
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wayfinder-qr-${code.location.name.replace(/\s+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">QR Codes</h3>
        <p className="text-sm text-gray-500 mt-1">Generate and manage entrance QR codes</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="">Select a location...</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={generateQRCode}
          disabled={!selectedLocation || generating}
          className="bg-primary-500 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary-600 transition-colors"
        >
          {generating ? 'Generating...' : 'Generate QR'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {qrCodes.map((code) => (
          <div key={code.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-3">
            <QRCodeSVG
              id={`qr-${code.id}`}
              value={code.code_uuid}
              size={140}
              level="M"
              includeMargin
            />
            <div className="text-center">
              <p className="font-semibold text-sm text-gray-800">{code.location.name}</p>
              <p className="text-xs text-gray-400 capitalize">{code.location.type}</p>
            </div>
            <button
              onClick={() => downloadQR(code)}
              className="text-xs text-primary-500 font-medium hover:underline"
            >
              Download SVG
            </button>
          </div>
        ))}
        {qrCodes.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📷</p>
            <p>No QR codes yet. Generate your first one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
