// Places someone has chosen not to see: a place another person published that
// they found offensive, spammy or just unwanted. Kept on this device only, and
// applied to the places list; a link to a hidden place still opens it, because
// following a link is asking for it. Staff remove what breaks the rules for
// everyone (the report goes to the back office Inbox); this is the
// individual's own block, which works at once.

const KEY = "findway.hiddenPlaces"

export function loadHiddenPlaces(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string").slice(0, 500) : []
  } catch {
    return []
  }
}

export function saveHiddenPlaces(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...new Set(ids)].slice(0, 500)))
  } catch {
    // Storage blocked: the place stays hidden until the app is closed.
  }
}
