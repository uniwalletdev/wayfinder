"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config"

let cached: SupabaseClient | null = null

// Singleton browser client, or null when Supabase isn't configured (local mode).
// Callers must handle null and fall back to local storage.
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!cached) cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return cached
}
