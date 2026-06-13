"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "./client"
import { isSupabaseConfigured } from "./config"

// Tracks the signed-in user. In local mode (Supabase not configured) this is
// always { user: null, cloudEnabled: false } and the app behaves as before.
export function useSupabaseSession() {
  const [user, setUser] = useState<User | null>(null)
  // Ready immediately in local mode; otherwise once the first session check returns.
  const [ready, setReady] = useState(() => !isSupabaseConfigured())

  useEffect(() => {
    const sb = getSupabaseBrowserClient()
    if (!sb) return
    let active = true
    sb.auth.getUser().then(({ data }) => {
      if (!active) return
      setUser(data.user ?? null)
      setReady(true)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, ready, cloudEnabled: isSupabaseConfigured() }
}
