# Wayfinder — Hospital Indoor Navigation

Waze-quality indoor navigation for NHS hospitals. Patients scan a QR code, get turn-by-turn directions to their appointment, with voice guidance and full accessibility support.

## Monorepo Structure

```
wayfinder/
├── mobile/          # React Native (Expo) patient app
├── admin/           # React (Vite) hospital staff dashboard
├── backend/         # Node.js + Express REST API
└── database/        # PostgreSQL migrations and seed data
```

## Tech Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Mobile app | React Native (Expo) | Expo EAS + App Stores |
| Admin dashboard | React + Vite + Tailwind | Vercel |
| REST API | Node.js + Express | Railway |
| Database | PostgreSQL | Railway |

## Quick Start

### 1. Database (Railway)
- Create a new Railway project
- Add a PostgreSQL service
- Run `database/migrations/001_initial_schema.sql` in the Railway Postgres shell
- Optionally run `database/seed.sql` for demo data

### 2. Backend (Railway)
```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm install
npm run dev
```
Deploy: connect the `backend/` folder to a Railway service.

### 3. Admin Dashboard (Vercel)
```bash
cd admin
cp .env.example .env   # set VITE_API_URL to your Railway backend URL
npm install
npm run dev
```
Deploy: connect the repo to Vercel, set root directory to `admin/`, add `VITE_API_URL` env var.

### 4. Mobile App
```bash
cd mobile
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your Railway backend URL
npm install
npx expo start
```

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...   # from Railway Postgres
JWT_SECRET=long-random-secret
PORT=3000
```

### Admin (`admin/.env`)
```
VITE_API_URL=https://your-app.up.railway.app
```

### Mobile (`mobile/.env`)
```
EXPO_PUBLIC_API_URL=https://your-app.up.railway.app
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Admin login → JWT token |
| GET | `/api/locations?search=X` | — | Search locations |
| GET | `/api/locations/:id` | — | Get single location |
| POST | `/api/locations` | Admin | Create location |
| GET | `/api/qr-codes/scan/:uuid` | — | Resolve QR code scan |
| POST | `/api/qr-codes` | Admin | Generate QR code |
| GET | `/api/routes?start=X&end=Y&accessible=false` | — | Get route |
| POST | `/api/sessions` | — | Start navigation session |
| PATCH | `/api/sessions/:id/complete` | — | Mark session complete |
| GET | `/api/sessions/stats` | Admin | Analytics summary |
| GET | `/health` | — | Health check |
