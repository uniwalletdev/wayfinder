import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Stats {
  total_sessions: string;
  completed_sessions: string;
  completion_rate: string;
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
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<{ summary: Stats }>('/api/sessions/stats')
      .then((d) => setStats(d.summary))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Overview</h3>
        <p className="text-gray-500 text-sm mt-1">Last 30 days navigation activity</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Sessions" value={stats?.total_sessions ?? '—'} />
        <StatCard label="Completed" value={stats?.completed_sessions ?? '—'} />
        <StatCard label="Completion Rate" value={stats ? `${stats.completion_rate}%` : '—'} sub="of started routes" />
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
              <span className="flex-shrink-0 w-6 h-6 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center font-bold text-xs">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
