// Centralises Leaflet + plugin setup. Some Leaflet plugins are not UMD-wrapped
// and reference a global `L`; bundlers don't provide one, so we expose it here
// BEFORE any such plugin is imported. Import order matters: this module is fully
// evaluated (setting window.L) before dependents evaluate their plugin imports.
import L from "leaflet"
import "leaflet-rotate"

if (typeof window !== "undefined") {
  ;(window as unknown as { L: typeof L }).L = L
}

export default L
