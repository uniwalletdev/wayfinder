import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './services/api';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MapEditor from './pages/MapEditor';
import Analytics from './pages/Analytics';
import QRCodes from './pages/QRCodes';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
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
