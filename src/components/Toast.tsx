"use client"

import { useEffect, useSyncExternalStore } from "react"
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react"

// Non-blocking notices, replacing window.alert().
//
// alert() stops the page, hides the map the message is about, and on a phone
// renders as an unstyled system sheet — the worst possible way to tell someone
// "survey complete, 4 places added". A toast says it in the app's own voice,
// over the map, and gets out of the way on its own.
//
// The store is module-level so anything can raise a notice without threading a
// callback through props: `toast.success("Saved")`. <ToastHost> is mounted once
// in the app shell and subscribes with useSyncExternalStore. Messages are
// announced to assistive tech through the host's live region, so a screen
// reader user hears the same thing a sighted user sees.

export type ToastKind = "info" | "success" | "warning" | "error"

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  body?: string
  // Milliseconds before it dismisses itself. 0 keeps it until closed.
  duration: number
}

interface ToastInput {
  kind?: ToastKind
  title: string
  body?: string
  duration?: number
}

const DEFAULT_DURATION: Record<ToastKind, number> = {
  info: 6000,
  success: 6000,
  warning: 9000,
  error: 10000,
}

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function push(input: ToastInput): number {
  const kind = input.kind ?? "info"
  const id = nextId++
  items = [...items, { id, kind, title: input.title, body: input.body, duration: input.duration ?? DEFAULT_DURATION[kind] }]
  emit()
  return id
}

export function dismissToast(id: number) {
  if (!items.some((t) => t.id === id)) return
  items = items.filter((t) => t.id !== id)
  emit()
}

export const toast = Object.assign(push, {
  info: (title: string, body?: string) => push({ kind: "info", title, body }),
  success: (title: string, body?: string) => push({ kind: "success", title, body }),
  warning: (title: string, body?: string) => push({ kind: "warning", title, body }),
  error: (title: string, body?: string) => push({ kind: "error", title, body }),
})

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => items
const EMPTY: ToastItem[] = []
const getServerSnapshot = () => EMPTY

const STYLE: Record<ToastKind, { Icon: typeof Info; icon: string; ring: string }> = {
  info: { Icon: Info, icon: "text-wf-primary", ring: "border-wf-border" },
  success: { Icon: CheckCircle2, icon: "text-wf-green", ring: "border-[#CDEBD8]" },
  warning: { Icon: AlertTriangle, icon: "text-amber-600", ring: "border-amber-200" },
  error: { Icon: XCircle, icon: "text-red-600", ring: "border-red-200" },
}

function ToastCard({ item }: { item: ToastItem }) {
  useEffect(() => {
    if (item.duration <= 0) return
    const t = setTimeout(() => dismissToast(item.id), item.duration)
    return () => clearTimeout(t)
  }, [item.id, item.duration])

  const { Icon, icon, ring } = STYLE[item.kind]
  const urgent = item.kind === "error" || item.kind === "warning"
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={`wf-toast-in pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-2xl border bg-white/97 px-4 py-3 shadow-[0_16px_40px_rgba(11,27,46,0.18)] backdrop-blur ${ring}`}
    >
      <Icon size={18} className={`mt-0.5 flex-shrink-0 ${icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-wf-ink">{item.title}</p>
        {item.body && <p className="mt-0.5 text-[13px] leading-snug text-wf-muted">{item.body}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-wf-faint hover:bg-wf-surface hover:text-wf-ink"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// Mount once, near the root of the app screen. Sits above every overlay so a
// notice raised as one closes (survey → map) is never hidden behind it.
export default function ToastHost() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[400] flex flex-col items-center gap-2 px-4 pt-safe-snug">
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}
