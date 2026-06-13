# Backend setup (Supabase)

The backend is **optional**. With no Supabase env vars set, Wayfinder runs in
local mode: venues and mapped points live in the browser, exactly as before.
Adding Supabase turns on **accounts** and **shared venues**, with the
public / unlisted / private rules enforced server-side by Postgres Row-Level
Security (RLS) — not just in the UI.

## 1. Create a project

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy the **Project URL** and the **anon public**
   key into `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

## 2. Apply the schema

The schema and all RLS policies are in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

- **Dashboard:** open the **SQL Editor**, paste the file, run it; **or**
- **CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

## 3. Configure auth

**Authentication → Providers → Email.** This app uses email + password.
- For the smoothest first run, you can turn **off** "Confirm email"
  (Authentication → Providers → Email) so sign-up logs you straight in.
- Leaving confirmation on also works — the app tells the user to confirm, then
  sign in.

## 4. Run

```bash
npm run dev
```

Open the app, tap the place name in the top bar → **Sign in**. Once signed in,
the places you create are stored server-side; sign in on another device and
they follow you.

## What the database enforces

| Concern | Rule (in `0001_init.sql`) |
| --- | --- |
| **Public** venue | Readable by anyone (signed in or not). |
| **Unlisted** venue | Reachable only if you know it (owner + invited members; excluded from discovery). |
| **Private** venue | Owner and explicitly-invited members only. |
| **Verified** badge | Can only be set with the **service role** (an admin/back office). Users can never self-verify — a DB trigger forces `verified = false` otherwise. |
| **Waypoints** | Inherit their venue's read rule; only the owner or an `editor` member can add/edit/delete. |
| **Membership** | Managed only by the venue owner. |

Because these live in RLS, they hold for *any* caller — the API can't be tricked
into leaking a private venue, even with a valid anon key.

## Not yet wired (next steps)

- A **sharing UI** to invite members to private/unlisted venues (the
  `venue_members` table + policies already exist).
- An **admin path** (service-role) to mark public venues `verified`.
- Uploading/persisting **floor plans** (the `floor_plans` JSONB column exists).
- Moving outdoor routing / AI survey calls behind the authenticated server
  client.
