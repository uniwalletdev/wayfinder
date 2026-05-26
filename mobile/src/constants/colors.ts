export const COLORS = {
  primary: '#3B82F6',
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#F8FAFC',
  white: '#FFFFFF',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  route: '#3B82F6',
  routeAccessible: '#10B981',
  marker: '#EF4444',
  markerDestination: '#3B82F6',
} as const;

export const COLORS_DARK = {
  ...COLORS,
  background: '#0F172A',
  white: '#1E293B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  border: '#334155',
} as const;
