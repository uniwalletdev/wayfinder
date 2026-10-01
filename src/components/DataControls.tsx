"use client"

import { useEffect, useState } from "react"
import { Trash2, Loader2, Check } from "lucide-react"
import { apiUrl } from "@/lib/app-shell"

// The one control the privacy page needs: a way to erase what this device has
// sent to the server. The device id is minted on the phone and is the only
// key the server has for the rows, so deleting by it is exact, and forgetting
// it afterwards means anything sent later is a fresh, unlinked device.

const DEVICE_KEY = "wayfinder.deviceId"

export default function DataControls() {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle")
  const [deleted, setDeleted] = useState(0)

  useEffect(() => {
    // Storage only exists in the browser, so this cannot be an initial state
    // without a server/client hydration mismatch.
    let id: string | null = null
    try {
      id = window.localStorage.getItem(DEVICE_KEY)
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeviceId(id)
  }, [])

  const erase = async () => {
    if (!deviceId) return
    setState("working")
    try {
      const res = await fetch(apiUrl("/api/signals"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      })
      const data = (await res.json()) as { ok?: boolean; deleted?: number }
      if (!data.ok) throw new Error("delete failed")
      setDeleted(data.deleted ?? 0)
      try {
        window.localStorage.removeItem(DEVICE_KEY)
      } catch {}
      setDeviceId(null)
      setState("done")
    } catch {
      setState("failed")
    }
  }

  return (
    <div className="mt-4 rounded-[14px] border border-wf-border bg-wf-surface-2 p-4">
      {state === "done" ? (
        <p className="flex items-start gap-2 text-[15px] text-wf-body">
          <Check size={18} className="mt-0.5 flex-shrink-0 text-wf-green" aria-hidden="true" />
          <span>
            Done. {deleted === 0 ? "There was nothing stored for this device." : `${deleted} walk${deleted === 1 ? "" : "s"} deleted from the server.`}{" "}
            This device’s identifier has been forgotten too; anything sent from now on starts fresh.
          </span>
        </p>
      ) : (
        <>
          <p className="text-[15px] text-wf-body">
            {deviceId
              ? "This browser has an identifier that any walks it has shared are filed under. Delete them from the server and forget the identifier:"
              : "This browser has no identifier yet — it has not shared any walks."}
          </p>
          {deviceId && (
            <button
              type="button"
              onClick={erase}
              disabled={state === "working"}
              className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {state === "working" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
              Delete my walks from the server
            </button>
          )}
          {state === "failed" && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              That didn’t work — check your connection and try again.
            </p>
          )}
        </>
      )}
    </div>
  )
}
