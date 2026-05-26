# Wayfinder — Hospital Indoor Navigation

Waze-quality indoor navigation for NHS hospitals. Patients scan a QR code, get turn-by-turn directions to their appointment, with voice guidance and full accessibility support.

## Monorepo Structure

```
wayfinder/
├── mobile/          # React Native (Expo) patient app
├── admin/           # React (Vite) hospital staff dashboard
└── supabase/        # Database schema and migrations
```

## Quick Start

### Mobile App
```bash
cd mobile
npm install
npx expo start
```

### Admin Dashboard
```bash
cd admin
npm install
npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo), TypeScript |
| Navigation | React Navigation v6 |
| Maps | react-native-maps with custom floor plan overlays |
| Voice | expo-speech |
| QR Scanner | expo-barcode-scanner |
| Admin UI | React, Vite, Tailwind CSS, shadcn/ui |
| Backend | Supabase (PostgreSQL + PostGIS + Auth + Storage) |
| Analytics | Recharts |

## MVP Features (Phase 1)

- QR code entry → instant "you are here" positioning
- Turn-by-turn visual navigation on floor plans
- Voice guidance (calm, reassuring tone)
- Accessibility mode (wheelchair routes, large text, high contrast)
- Nearby amenities (bathrooms, café, ATM, pharmacy)
- Appointment time countdown
- Admin: floor plan upload, location pinning, QR generation
- Admin: basic analytics (daily users, popular routes)

## Environment Variables

### Mobile (`mobile/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Admin (`admin/.env`)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
