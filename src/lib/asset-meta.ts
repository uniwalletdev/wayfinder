import { Asset, AssetCategory } from "./types"

// Presentation + classification for facility assets (the located fixtures a CAD
// plan carries, like plug sockets). Mirrors waypoint-meta but for the separate,
// non-routable asset overlay.

export const ALL_ASSET_CATEGORIES: AssetCategory[] = [
  "power", "data", "lighting", "fire", "plumbing", "hvac", "security", "other",
]

export const ASSET_CATEGORY_ICONS: Record<AssetCategory, string> = {
  power: "🔌",
  data: "🌐",
  lighting: "💡",
  fire: "🧯",
  plumbing: "🚰",
  hvac: "🌬️",
  security: "📷",
  other: "⚙️",
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  power: "Power socket",
  data: "Data / network point",
  lighting: "Lighting",
  fire: "Fire safety",
  plumbing: "Plumbing",
  hvac: "HVAC / ventilation",
  security: "Security / CCTV",
  other: "Other fixture",
}

// Maps a CAD layer/block name (or any free-text hint) onto an asset category.
// Returns null when nothing looks like a fixture, so the caller can treat the
// symbol as a room/waypoint instead. Ordered most-specific first.
const ASSET_KEYWORDS: [RegExp, AssetCategory][] = [
  // Data before power: a "data outlet" / "RJ45 outlet" must not be swallowed by
  // the generic "outlet" in the power pattern.
  [/data|network|\bcomms?\b|\brj45\b|ethernet|\blan\b|patch|telecom|\bfibre\b|\bfiber\b/, "data"],
  [/socket|outlet|\bgpo\b|\bpower\b|\bpwr\b|receptacle|13a|plug/, "power"],
  [/light|luminaire|\blamp\b|downlight|\bled\b|fixture.*light/, "lighting"],
  [/fire|smoke|\balarm\b|extinguisher|sprinkler|hose.?reel|\bfcp\b/, "fire"],
  [/tap|sink|basin|drain|\bwater\b|plumb|\bwc\b.*fitting|radiator/, "plumbing"],
  [/hvac|\bvent\b|duct|diffuser|grille|\bahu\b|\bfcu\b|air.?con/, "hvac"],
  [/cctv|camera|\bcard.?reader\b|\bpir\b|security|access.?control|\bdoor.?entry\b/, "security"],
]

export function classifyAsset(hint: string): AssetCategory | null {
  const lower = hint.toLowerCase()
  for (const [pattern, category] of ASSET_KEYWORDS) {
    if (pattern.test(lower)) return category
  }
  return null
}

// A readable default name for an asset that only carried a layer/block code.
export function defaultAssetName(category: AssetCategory, hint: string): string {
  const trimmed = hint.trim()
  if (trimmed && !/^[0-9a-fx_\-\s]+$/i.test(trimmed)) return trimmed
  return ASSET_CATEGORY_LABELS[category]
}

export function assetsOnFloor(assets: Asset[], floor: number): Asset[] {
  return assets.filter((a) => a.floor === floor)
}
