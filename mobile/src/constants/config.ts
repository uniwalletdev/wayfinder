export const CONFIG = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  voiceRate: 0.85,
  voicePitch: 1.0,
  routeLineWidth: 8,
  locationMarkerSize: 20,
  navigationUpdateInterval: 2000,
} as const;
