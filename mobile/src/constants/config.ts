export const CONFIG = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  voiceRate: 0.85,
  voicePitch: 1.0,
  routeLineWidth: 8,
  locationMarkerSize: 20,
  navigationUpdateInterval: 2000,
} as const;
