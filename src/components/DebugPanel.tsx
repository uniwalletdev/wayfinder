"use client"

import { useEffect, useState } from "react"
import { Coordinates } from "@/lib/types"
import { LogEntry, subscribeLogs, clearLogs } from "@/lib/debug"
import { Bug, X, Copy, Trash2 } from "lucide-react"

interface Props {
  position: Coordinates | null
  accuracy: number
  heading: number
  locating: boolean
  locationError: string | null
  isMoving: boolean
  venueName?: string
  venueId?: number
  waypointCount: number
}

export default function DebugPanel(props: Props) {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => subscribeLogs(setLogs), [])

  const diagnostics = {
    url: typeof window !== "undefined" ? window.location.href : "",
    protocol: typeof window !== "undefined" ? window.location.protocol : "",
    secure: typeof window !== "undefined" ? window.isSecureContext : false,
    online: typeof navigator !== "undefined" ? navigator.onLine : false,
    geolocation: typeof navigator !== "undefined" && "geolocation" in navigator,
    locating: props.locating,
    locationError: props.locationError ?? "none",
    position: props.position
      ? `${props.position.lat.toFixed(6)}, ${props.position.lng.toFixed(6)}`
      : "null",
    accuracy: props.accuracy === 9999 ? "fallback (no GPS)" : `±${Math.round(props.accuracy)}m`,
    heading: `${Math.round(props.heading)}°`,
    moving: props.isMoving,
    venue: props.venueName ? `${props.venueName} (#${props.venueId})` : "none",
    waypoints: props.waypointCount,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  }

  function buildReport() {
    const lines = [
      "=== Wayfinder Diagnostics ===",
      ...Object.entries(diagnostics).map(([k, v]) => `${k}: ${v}`),
      "",
      "=== Logs ===",
      ...logs.map((l) => `[${new Date(l.t).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.msg}`),
    ]
    return lines.join("\n")
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildReport())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-36 right-3 z-[60] w-9 h-9 bg-gray-800/80 rounded-full flex items-center justify-center shadow-lg"
        title="Diagnostics"
      >
        <Bug size={16} className="text-white" />
      </button>
    )
  }

  return (
    <div className="absolute inset-0 z-[600] bg-black/60 flex items-end" onClick={() => setOpen(false)}>
      <div
        className="w-full bg-gray-900 text-gray-100 rounded-t-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Bug size={18} className="text-green-400" />
            <h3 className="font-bold text-sm">Diagnostics</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyReport} className="flex items-center gap-1 text-xs bg-gray-700 px-2.5 py-1.5 rounded-lg">
              <Copy size={13} /> {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={() => clearLogs()} className="flex items-center gap-1 text-xs bg-gray-700 px-2.5 py-1.5 rounded-lg">
              <Trash2 size={13} />
            </button>
            <button onClick={() => setOpen(false)} className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-3 text-xs font-mono">
          <div className="grid grid-cols-1 gap-1 mb-4">
            {Object.entries(diagnostics).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-400 flex-shrink-0 w-28">{k}</span>
                <span className={`break-all ${
                  (k === "locationError" && v !== "none") ? "text-red-400"
                  : (k === "secure" || k === "online" || k === "geolocation") && v === false ? "text-red-400"
                  : "text-gray-100"
                }`}>{String(v)}</span>
              </div>
            ))}
          </div>

          <p className="text-gray-400 mb-1.5 border-t border-gray-700 pt-3">Event log ({logs.length})</p>
          <div className="space-y-1">
            {logs.length === 0 && <p className="text-gray-500">No events yet…</p>}
            {[...logs].reverse().map((l, i) => (
              <div key={i} className={`break-all ${
                l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-yellow-400" : "text-gray-300"
              }`}>
                <span className="text-gray-500">{new Date(l.t).toLocaleTimeString()} </span>
                {l.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
