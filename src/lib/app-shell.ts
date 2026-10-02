// The Android and iOS apps (android/, ios/) ship the interface inside the
// binary and call the website's /api over the network; the website serves both
// from one origin. scripts/app-shell-build.mjs bakes these values in when it
// builds the apps, and they are empty on the web, so call sites use them
// unconditionally and the web keeps its same-origin behaviour.

// True inside the Android and iOS apps, false on the web.
export const IS_APP_SHELL = process.env.NEXT_PUBLIC_APP_SHELL === "1"

// Where /api lives: empty (same origin) on the web, the deployment in the apps.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "")

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

// The origin a shareable link or poster QR code should carry. Inside the apps
// window.location.origin is capacitor://localhost, which nobody else can open,
// so links are written against the website instead.
export function publicOrigin(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ?? ""
  if (IS_APP_SHELL && site) return site
  return typeof window !== "undefined" ? window.location.origin : site
}
