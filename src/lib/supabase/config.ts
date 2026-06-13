// Supabase is optional. When these env vars are absent the app runs in local
// (device-only) mode and never touches the network — exactly as it did before
// the backend existed. When they're present, venues are stored server-side and
// Postgres Row-Level Security enforces the public/private model across users.
//
// NEXT_PUBLIC_* values are safe to expose to the browser (the anon key is meant
// to be public; access is governed by RLS, not by hiding the key).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}
