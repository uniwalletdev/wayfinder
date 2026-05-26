import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface Stats {
  totalSessions: number;
  completedSessions: number;
  totalLocations: number;
  totalQRCodes: number;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    completedSessions: 0,
    totalLocations: 0,
    totalQRCodes: 0,
  });

  useEffect(() => {
    Promise.all([
      supabase.from('navigation_sessions').select('id, completed_at', { count: 'exact' }),
      supabase.from('locations').select('id', { count: 'exact' }),
      supabase.from('qr_codes').select('id', { count: 'exact' }),
    ]).then(([sessions, locations, qrCodes]) => {
      const total = sessions.count ?? 0;
      const completed = sessions.data?.filter((s) => s.completed_at).length ?? 0;
      setStats({
        totalSessions: total,
        completedSessions: completed,
        totalLocations: locations.count ?? 0,
        totalQRCodes: qrCodes.count ?? 0,
      });
    });
  }, []);

  const completionRate =
    stats.totalSessions > 0
      ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Overview</h3>
        <p className="text-gray-500 text-sm mt-1">Today's navigation activity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={stats.totalSessions} />
        <StatCard label="Completion Rate" value={`${completionRate}%`} sub="of started routes" />
        <StatCard label="Mapped Locations" value={stats.totalLocations} />
        <StatCard label="Active QR Codes" value={stats.totalQRCodes} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4">Getting Started</h4>
        <ol className="space-y-3 text-sm text-gray-600">
          {[
            'Upload your hospital floor plan in Map Editor',
            'Pin key locations (departments, bathrooms, cafés)',
            'Generate QR codes for each entrance point',
            'Print and place QR codes at hospital entrances',
            'Monitor patient navigation in Analytics',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center font-bold text-xs">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
