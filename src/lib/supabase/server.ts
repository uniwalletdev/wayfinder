import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config"

// Server client for Route Handlers / Server Components. Next.js 16 made
// `cookies()` async, so this is awaited. Returns null in local mode.
//
// Not yet wired into a server route — the SPA uses the browser client — but it's
// the correct foundation for server-side reads/mutations and is kept import-safe.
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component where cookies are read-only — safe to
          // ignore when a proxy/middleware is responsible for refreshing sessions.
        }
      },
    },
  })
}
