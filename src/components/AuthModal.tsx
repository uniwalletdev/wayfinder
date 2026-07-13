"use client"

import { useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useEscapeClose } from "@/lib/use-escape"
import { X, Loader2, LogIn, UserPlus } from "lucide-react"

interface Props {
  onClose: () => void
  onAuthed: () => void
}

export default function AuthModal({ onClose, onAuthed }: Props) {
  const [mode, setMode] = useState<"in" | "up">("in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEscapeClose(onClose)

  async function submit() {
    const sb = getSupabaseBrowserClient()
    if (!sb) {
      setError("Accounts aren't enabled on this server.")
      return
    }
    if (!email.trim() || password.length < 6) {
      setError("Enter an email and a password of at least 6 characters.")
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === "up") {
        const { error: e } = await sb.auth.signUp({ email: email.trim(), password })
        if (e) throw e
        const { data } = await sb.auth.getSession()
        if (data.session) {
          onAuthed()
          return
        }
        // Email confirmation is on for this project.
        setInfo("Account created. Check your email to confirm it, then sign in.")
        setMode("in")
      } else {
        const { error: e } = await sb.auth.signInWithPassword({ email: email.trim(), password })
        if (e) throw e
        onAuthed()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[250] bg-black/40 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-safe-bar sm:pb-5 slide-up">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">{mode === "in" ? "Sign in" : "Create account"}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={16} className="text-gray-600" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          An account lets you publish public places and keep private ones synced across your devices —
          rather than only on this one.
        </p>

        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 outline-none focus:border-[#005EB8]"
        />
        <input
          type="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#005EB8]"
        />

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {info && <p className="text-sm text-green-700 mb-2">{info}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3 font-bold text-base disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : mode === "in" ? <LogIn size={18} /> : <UserPlus size={18} />}
          {mode === "in" ? "Sign in" : "Create account"}
        </button>

        <button
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); setInfo(null) }}
          className="w-full text-center text-sm text-[#005EB8] font-medium mt-3"
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  )
}
