import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

interface DailyStats { date: string; sessions: number; completions: number; }

export default function Analytics() {
  const [daily, setDaily] = useState<DailyStats[]>([]);

  useEffect(() => {
    api.get<{ daily: DailyStats[] }>('/api/sessions/stats')
      .then((d) => setDaily(d.daily.map((r) => ({ ...r, date: r.date.toString().slice(5, 10) }))))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Analytics</h3>
        <p className="text-sm text-gray-500 mt-1">Patient navigation patterns (last 7 days)</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4">Daily Sessions</h4>
        {daily.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No data yet. Sessions will appear here once patients start navigating.</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} dot={false} name="Started" />
              <Line type="monotone" dataKey="completions" stroke="#10B981" strokeWidth={2} dot={false} name="Completed" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
