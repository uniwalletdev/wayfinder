import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import MapEditor from './pages/MapEditor';
import Analytics from './pages/Analytics';
import QRCodes from './pages/QRCodes';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="map-editor" element={<MapEditor />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="qr-codes" element={<QRCodes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
