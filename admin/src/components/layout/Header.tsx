import React from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/map-editor': 'Map Editor',
  '/analytics': 'Analytics',
  '/qr-codes': 'QR Codes',
};

export default function Header() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Wayfinder';

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">NHS Trust Hospital</span>
        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
          A
        </div>
      </div>
    </header>
  );
}
