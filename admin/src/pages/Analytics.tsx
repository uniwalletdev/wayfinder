import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { supabase } from '../services/supabase';

interface DailyStats {
  date: string;
  sessions: number;
  completions: number;
}

export default function Analytics() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [topDestinations, setTopDestinations] = useState<Array<{ name: string; count: number }>>([]);

  useEffect(() => {
    supabase
      .from('navigation_sessions')
      .select('started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;

        const byDay: Record<string, { sessions: number; completions: number }> = {};
        data.forEach((s) => {
          const date = s.started_at.slice(0, 10);
          if (!byDay[date]) byDay[date] = { sessions: 0, completions: 0 };
          byDay[date].sessions++;
          if (s.completed_at) byDay[date].completions++;
        });

        setDailyStats(
          Object.entries(byDay)
            .slice(0, 7)
            .map(([date, v]) => ({ date: date.slice(5), ...v }))
            .reverse()
        );
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Analytics</h3>
        <p className="text-sm text-gray-500 mt-1">Patient navigation patterns (last 7 days)</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4">Daily Sessions</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} dot={false} name="Started" />
            <Line type="monotone" dataKey="completions" stroke="#10B981" strokeWidth={2} dot={false} name="Completed" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-800 mb-4">Top Destinations</h4>
        {topDestinations.length === 0 ? (
          <p className="text-sm text-gray-400">No destination data yet. Start tracking navigation sessions.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topDestinations} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
