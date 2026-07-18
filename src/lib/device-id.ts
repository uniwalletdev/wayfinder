// A stable, anonymous per-device id. Signals a navigator emits (see
// use-trail-recorder.ts and /api/signals) are pooled server-side, and the
// aggregation that promotes a correction counts *independent* devices agreeing —
// so one phone can't single-handedly move a pin. This id is what makes "8 people
// walked the same corridor" countable. It identifies a browser, not a person:
// no account, no PII, and it resets if storage is cleared, which is fine — the
// only thing it's used for is de-duplicating agreement.

const KEY = "wayfinder.deviceId"

export function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  try {
    let id = window.localStorage.getItem(KEY)
    if (!id) {
      id = crypto?.randomUUID?.() ?? `dev-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
      window.localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Storage blocked (private mode). Without a stable id the signal can't be
    // attributed, so the endpoint will drop it — acceptable for fire-and-forget.
    return ""
  }
}
