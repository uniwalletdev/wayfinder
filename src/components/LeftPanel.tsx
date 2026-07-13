"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import {
  Building, ChevronsUpDown, Search, BadgeCheck, X, Navigation, Share2, ChevronRight,
  Loader2, PersonStanding, Bike, Car, ClipboardList, UploadCloud, QrCode, Camera,
  ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight, ArrowUpDown, Footprints, CheckCircle2,
  Info, MapPin,
} from "lucide-react"
import { Waypoint, Route, RouteStep, TravelMode, Venue, RoutePreference, FloorNaming } from "@/lib/types"
import { WAYPOINT_TYPE_ICONS, floorLabel } from "@/lib/waypoint-meta"
import Toggle from "@/components/Toggle"

interface NearbyItem extends Waypoint {
  distanceM: number
}

interface RouteOptionPair {
  fastest: Route
  stepfree: Route
}

interface Props {
  venue: Venue
  userInitials: string | null
  onOpenVenues: () => void
  onOpenSearch: () => void
  quickAccess: Waypoint[]
  onSelectDestination: (w: Waypoint) => void
  nearby: NearbyItem[]
  currentFloor: number
  destination: Waypoint | null
  route: Route | null
  routeLoading: boolean
  isNavigating: boolean
  currentStepIndex: number
  travelMode: TravelMode
  onTravelModeChange: (mode: TravelMode) => void
  routePreference: RoutePreference
  onChangeRoutePreference: (p: RoutePreference) => void
  alwaysStepFree: boolean
  onChangeAlwaysStepFree: (v: boolean) => void
  routeOptions: RouteOptionPair | null
  onStart: () => void
  onStop: () => void
  onShare: () => void
  showMapTools: boolean
  onMapArea: () => void
  onUploadPlan: () => void
  gpsStatus: "requesting" | "active" | "denied"
  onUseDemo: () => void
  onScanQR: () => void
  onOpenCamera: () => void
  // Set when the user's live position is a long way from the venue and they've
  // picked an indoor destination — the panel offers alternatives instead of a
  // straight-faced multi-hour walking route.
  farFromVenue: { distanceM: number } | null
  onPreviewFromVenue: () => void
  onRouteFromHereAnyway: () => void
}

function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

// Desktop (lg+): the fixed 392px side column of the app-home layout.
// Phones: a bottom sheet over a full-bleed map — collapsed it peeks just the
// search field and quick chips (or the active route card), the grab handle
// expands it to the full panel. This is what keeps the floating map controls
// and the panel from ever fighting over the same pixels on small screens.
export default function LeftPanel({
  venue,
  userInitials,
  onOpenVenues,
  onOpenSearch,
  quickAccess,
  onSelectDestination,
  nearby,
  currentFloor,
  destination,
  route,
  routeLoading,
  isNavigating,
  currentStepIndex,
  travelMode,
  onTravelModeChange,
  routePreference,
  onChangeRoutePreference,
  alwaysStepFree,
  onChangeAlwaysStepFree,
  routeOptions,
  onStart,
  onStop,
  onShare,
  showMapTools,
  onMapArea,
  onUploadPlan,
  gpsStatus,
  onUseDemo,
  onScanQR,
  onOpenCamera,
  farFromVenue,
  onPreviewFromVenue,
  onRouteFromHereAnyway,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const touchY = useRef<number | null>(null)
  const swiped = useRef(false)

  // Collapse the sheet whenever a destination is picked or guidance starts, so
  // the route being talked about is actually visible on the map behind it.
  // (State adjusted during render rather than in an effect — see the React
  // docs on adjusting state when props change.)
  const collapseKey = `${destination?.id ?? ""}:${isNavigating}`
  const [prevCollapseKey, setPrevCollapseKey] = useState(collapseKey)
  if (collapseKey !== prevCollapseKey) {
    setPrevCollapseKey(collapseKey)
    setExpanded(false)
  }

  // Peek-state sections only hide on phones; lg+ always shows everything.
  const expandable = `${expanded ? "flex" : "hidden"} lg:flex`

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-3xl bg-white pb-safe-snug shadow-[0_-12px_40px_rgba(11,27,46,0.18)] lg:static lg:h-full lg:max-h-none lg:w-[392px] lg:flex-shrink-0 lg:rounded-none lg:pb-0 lg:shadow-[8px_0_32px_rgba(11,27,46,0.10)]">
      {/* Grab handle (phones): tap or swipe to expand/collapse */}
      <button
        type="button"
        aria-label={expanded ? "Collapse panel" : "Expand panel"}
        onClick={() => {
          if (swiped.current) {
            swiped.current = false
            return
          }
          setExpanded((v) => !v)
        }}
        onTouchStart={(e) => {
          // A new touch always starts a fresh gesture. Browsers don't fire a
          // click after a swipe, so without this reset the flag from the last
          // swipe would swallow the next genuine tap.
          swiped.current = false
          touchY.current = e.touches[0].clientY
        }}
        onTouchEnd={(e) => {
          if (touchY.current === null) return
          const dy = e.changedTouches[0].clientY - touchY.current
          touchY.current = null
          if (Math.abs(dy) > 30) {
            swiped.current = true
            setExpanded(dy < 0)
          }
        }}
        className="flex w-full flex-shrink-0 items-center justify-center pb-1 pt-2.5 lg:hidden"
      >
        <span className="h-1 w-10 rounded-full bg-wf-border" />
      </button>

      {/* Brand row */}
      <div className={`${expandable} items-center justify-between px-6 pt-1 lg:pt-[22px]`}>
        <Link href="/" className="flex items-center gap-2.5" title="Back to home">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-gradient-to-br from-wf-primary to-wf-teal">
            <Navigation size={15} className="text-white" />
          </span>
          <span className="font-display text-lg font-bold text-wf-ink">Wayfinder</span>
        </Link>
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-wf-surface text-[13px] font-semibold text-wf-muted">
          {userInitials ?? "?"}
        </div>
      </div>

      {gpsStatus !== "active" && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl bg-wf-surface px-3 py-2 text-xs">
          {gpsStatus === "requesting" ? (
            <span className="text-wf-muted">Finding your location…</span>
          ) : (
            <>
              <span className="flex-1 text-wf-muted">GPS unavailable</span>
              <button onClick={onUseDemo} className="font-semibold text-wf-primary">Use demo</button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 px-6 pt-3 lg:pt-4">
        {/* Venue switcher */}
        <button
          onClick={onOpenVenues}
          className={`${expandable} items-center gap-2.5 rounded-[14px] border border-wf-border bg-wf-surface px-3.5 py-3 text-left`}
        >
          <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-[#E7F2FF]">
            <Building size={17} className="text-wf-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold text-wf-ink">{venue.name}</p>
            {venue.visibility === "public" && venue.verified && (
              <p className="flex items-center gap-1 truncate text-xs text-wf-muted">
                Public <BadgeCheck size={12} className="text-wf-primary" /> Verified
              </p>
            )}
          </div>
          <ChevronsUpDown size={15} className="flex-shrink-0 text-wf-faint" />
        </button>

        {!isNavigating && (
          <>
            {/* Search field */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-wf-primary px-4 py-[13px] text-left shadow-[0_4px_14px_rgba(10,93,194,0.12)]"
            >
              <Search size={17} className="flex-shrink-0 text-wf-primary" />
              <span className="flex-1 truncate text-sm text-wf-faint">
                {destination ? destination.name : "Search a room, place or address…"}
              </span>
              <span className="hidden flex-shrink-0 rounded-md border border-wf-border px-1.5 py-0.5 text-[11px] text-wf-faint lg:block">/</span>
            </button>

            {/* Quick chips: one scrollable row in the peek sheet, wrapping on lg */}
            {quickAccess.length > 0 && (
              <div className="flex gap-2 overflow-x-auto lg:flex-wrap lg:overflow-visible">
                {quickAccess.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => onSelectDestination(w)}
                    className="flex-shrink-0 whitespace-nowrap rounded-full border border-wf-border bg-white px-[13px] py-[7px] text-[13px] font-medium text-wf-body transition-colors hover:border-wf-primary hover:text-wf-primary"
                  >
                    {WAYPOINT_TYPE_ICONS[w.type]} {w.name}
                  </button>
                ))}
              </div>
            )}

            {!destination && (
              <div className={`${expandable} gap-2`}>
                <button
                  onClick={onScanQR}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-wf-border py-2 text-xs font-semibold text-wf-body"
                >
                  <QrCode size={14} /> Scan QR code
                </button>
                <button
                  onClick={onOpenCamera}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-wf-border py-2 text-xs font-semibold text-wf-body"
                >
                  <Camera size={14} /> Live camera
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={`mt-4 flex-1 overflow-y-auto px-6 pb-4 ${destination || expanded ? "" : "hidden lg:block"}`}>
        {isNavigating && destination && route ? (
          <NavigatingSummary
            destination={destination}
            route={route}
            currentStepIndex={currentStepIndex}
            floorNaming={venue.floorNaming}
            expanded={expanded}
            onStop={onStop}
            onScanQR={onScanQR}
            onOpenCamera={onOpenCamera}
          />
        ) : destination && route && farFromVenue ? (
          <FarFromVenueCard
            venue={venue}
            destination={destination}
            distanceM={farFromVenue.distanceM}
            onPreviewFromVenue={onPreviewFromVenue}
            onRouteFromHereAnyway={onRouteFromHereAnyway}
            onStop={onStop}
          />
        ) : destination && route ? (
          <RoutePreviewCard
            destination={destination}
            route={route}
            routeLoading={routeLoading}
            floorNaming={venue.floorNaming}
            expanded={expanded}
            travelMode={travelMode}
            onTravelModeChange={onTravelModeChange}
            routePreference={routePreference}
            onChangeRoutePreference={onChangeRoutePreference}
            alwaysStepFree={alwaysStepFree}
            onChangeAlwaysStepFree={onChangeAlwaysStepFree}
            routeOptions={routeOptions}
            onStart={onStart}
            onStop={onStop}
            onShare={onShare}
          />
        ) : (
          <NearbyList nearby={nearby} currentFloor={currentFloor} floorNaming={venue.floorNaming} onSelect={onSelectDestination} />
        )}
      </div>

      {showMapTools && !isNavigating && (
        <div className="flex flex-col border-t border-wf-border-faint">
          <button onClick={onMapArea} className="flex items-center gap-3 px-6 py-3.5 text-left">
            <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wf-primary to-wf-teal">
              <ClipboardList size={17} className="text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-wf-ink">Map area</p>
              <p className="truncate text-xs text-wf-muted">Walk through with your camera</p>
            </div>
            <ChevronRight size={16} className="flex-shrink-0 text-wf-faint" />
          </button>
          <button onClick={onUploadPlan} className="flex items-center gap-3 px-6 py-3.5 text-left">
            <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-wf-surface">
              <UploadCloud size={17} className="text-wf-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-wf-ink">Upload plan</p>
              <p className="truncate text-xs text-wf-muted">Add an existing floor plan</p>
            </div>
            <ChevronRight size={16} className="flex-shrink-0 text-wf-faint" />
          </button>
        </div>
      )}
    </div>
  )
}

function NearbyList({
  nearby,
  currentFloor,
  floorNaming,
  onSelect,
}: {
  nearby: NearbyItem[]
  currentFloor: number
  floorNaming?: FloorNaming
  onSelect: (w: Waypoint) => void
}) {
  if (nearby.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-wf-faint">Nearby on this floor</p>
      <div className="flex flex-col">
        {nearby.map((w) => (
          <button
            key={w.id}
            onClick={() => onSelect(w)}
            className="flex items-center gap-3 border-b border-wf-border-faint py-2.5 text-left last:border-b-0 hover:bg-[#F7FAFD]"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-wf-surface text-base">
              {WAYPOINT_TYPE_ICONS[w.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-wf-ink">{w.name}</p>
              <p className="truncate text-xs text-wf-muted">{floorLabel(currentFloor, floorNaming)}{w.description ? ` · ${w.description}` : ""}</p>
            </div>
            <span className="flex-shrink-0 font-display text-[12.5px] font-semibold text-wf-primary">
              {fmtDistance(w.distanceM)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Shown instead of the route preview when the walker's live GPS fix is far from
// the venue but they picked somewhere *inside* it — a 27km "walking route" into
// a hospital ward helps nobody. Offers a preview from the venue itself, or an
// explicit opt-in to the long route (they might genuinely be walking there).
function FarFromVenueCard({
  venue,
  destination,
  distanceM,
  onPreviewFromVenue,
  onRouteFromHereAnyway,
  onStop,
}: {
  venue: Venue
  destination: Waypoint
  distanceM: number
  onPreviewFromVenue: () => void
  onRouteFromHereAnyway: () => void
  onStop: () => void
}) {
  return (
    <div className="rounded-[18px] border border-wf-border p-[18px] shadow-[0_10px_30px_rgba(11,27,46,0.08)]">
      <div className="mb-3.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-wf-teal-tint text-lg">
            {WAYPOINT_TYPE_ICONS[destination.type]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15.5px] font-semibold text-wf-ink">{destination.name}</p>
            <p className="truncate text-xs text-wf-muted">{floorLabel(destination.floor, venue.floorNaming)} · {venue.name}</p>
          </div>
        </div>
        <button onClick={onStop} aria-label="Clear destination" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <X size={15} />
        </button>
      </div>

      <div className="mb-4 rounded-[14px] border border-[#F0E3B4] bg-[#FFFAEA] px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8A6D1A]">
          <MapPin size={14} /> You&apos;re {fmtDistance(distanceM)} from {venue.name}
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-[#9C8137]">
          Indoor directions start making sense once you arrive. Preview the route from the venue, or keep
          routing from where you are now.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={onPreviewFromVenue}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]"
        >
          <Building size={16} />
          Preview from {venue.name}
        </button>
        <button
          onClick={onRouteFromHereAnyway}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-wf-border py-3 text-sm font-semibold text-wf-ink"
        >
          <Navigation size={16} />
          Route from my location anyway
        </button>
      </div>
    </div>
  )
}

const TRAVEL_MODES: { mode: TravelMode; label: string; Icon: typeof PersonStanding }[] = [
  { mode: "walking", label: "Walk", Icon: PersonStanding },
  { mode: "cycling", label: "Cycle", Icon: Bike },
  { mode: "driving", label: "Drive", Icon: Car },
]

function RoutePreviewCard({
  destination,
  route,
  routeLoading,
  floorNaming,
  expanded,
  travelMode,
  onTravelModeChange,
  routePreference,
  onChangeRoutePreference,
  alwaysStepFree,
  onChangeAlwaysStepFree,
  routeOptions,
  onStart,
  onStop,
  onShare,
}: {
  destination: Waypoint
  route: Route
  routeLoading: boolean
  floorNaming?: FloorNaming
  expanded: boolean
  travelMode: TravelMode
  onTravelModeChange: (m: TravelMode) => void
  routePreference: RoutePreference
  onChangeRoutePreference: (p: RoutePreference) => void
  alwaysStepFree: boolean
  onChangeAlwaysStepFree: (v: boolean) => void
  routeOptions: RouteOptionPair | null
  onStart: () => void
  onStop: () => void
  onShare: () => void
}) {
  const hasArrivalInfo = !!(destination.hours || destination.arrivalNotes || destination.typicalWait)
  const isOpen = destination.hours?.toLowerCase().includes("open") ?? false

  // On phones the peek sheet shows just the essentials — destination, a compact
  // ETA glance and Start — so the map stays usable; swiping up (or lg+) reveals
  // arrival notes, travel modes and the step-by-step / route choice.
  const detailBlock = `${expanded ? "block" : "hidden"} lg:block`
  const detailFlex = `${expanded ? "flex" : "hidden"} lg:flex`

  return (
    <div className="rounded-[18px] border border-wf-border p-[18px] shadow-[0_10px_30px_rgba(11,27,46,0.08)]">
      <div className="mb-3.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-wf-teal-tint text-lg">
            {WAYPOINT_TYPE_ICONS[destination.type]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15.5px] font-semibold text-wf-ink">{destination.name}</p>
            <p className="truncate text-xs text-wf-muted">{floorLabel(destination.floor, floorNaming)}{destination.description ? ` · ${destination.description}` : ""}</p>
          </div>
        </div>
        <button onClick={onStop} aria-label="Clear destination" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <X size={15} />
        </button>
      </div>

      {hasArrivalInfo && (
        <div className={`${detailBlock} mb-4`}>
          {destination.hours && (
            <div className="mb-2 flex items-center gap-2">
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isOpen ? "bg-wf-green-tint text-wf-green-text" : "bg-wf-surface text-wf-muted"
              }`}>
                {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-wf-green" />}
                {destination.hours}
              </span>
            </div>
          )}
          {destination.arrivalNotes && (
            <div className="rounded-[14px] border border-[#D9E9FB] bg-[#F2F8FF] px-3.5 py-3">
              <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-wf-primary">
                <Info size={13} /> When you arrive
              </p>
              <p className="text-[13.5px] leading-snug text-wf-body">{destination.arrivalNotes}</p>
            </div>
          )}
          {destination.typicalWait && (
            <div className="mt-2 flex items-center justify-between rounded-[14px] border border-wf-border px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[13.5px] text-wf-body">🕐 Typical wait</span>
              <span className="font-display text-[13px] font-semibold text-wf-ink">{destination.typicalWait}</span>
            </div>
          )}
        </div>
      )}

      {route.outdoor && (
        <div className={`${detailFlex} mb-3 gap-2`}>
          {TRAVEL_MODES.map(({ mode, label, Icon }) => {
            const active = mode === travelMode
            return (
              <button
                key={mode}
                onClick={() => onTravelModeChange(mode)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                  active ? "border-wf-primary bg-wf-primary text-white" : "border-wf-border text-wf-muted"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>
      )}

      {routeOptions ? (
        <>
          {/* Full route chooser — expanded / desktop only */}
          <div className={detailBlock}>
            <RouteChoice
              routeOptions={routeOptions}
              routePreference={routePreference}
              onChangeRoutePreference={onChangeRoutePreference}
              alwaysStepFree={alwaysStepFree}
              onChangeAlwaysStepFree={onChangeAlwaysStepFree}
              activeSteps={route.steps}
            />
          </div>
          {/* Compact glance for the peek sheet on phones */}
          <div className={`${expanded ? "hidden" : "grid"} lg:hidden mb-4 grid-cols-3 gap-2`}>
            <StatTile label={route.outdoor ? travelMode : "walking"} value={`${route.estimatedMinutes} min`} />
            <StatTile label={route.floorChanges > 0 ? `${route.floorChanges} floor change${route.floorChanges > 1 ? "s" : ""}` : "same floor"} value={fmtDistance(route.totalDistance)} />
            <StatTile label="accuracy" value="±4 m" />
          </div>
        </>
      ) : (
        <>
          <div className={detailBlock}>
            <StepDots destination={destination} />
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <StatTile label={routeLoading ? "…" : route.outdoor ? travelMode : "walking"} value={routeLoading ? "—" : `${route.estimatedMinutes} min`} />
            <StatTile label={route.floorChanges > 0 ? `${route.floorChanges} floor change${route.floorChanges > 1 ? "s" : ""}` : "same floor"} value={routeLoading ? "—" : fmtDistance(route.totalDistance)} />
            <StatTile label="accuracy" value={destination ? "±4 m" : "—"} />
          </div>
        </>
      )}

      <div className="flex gap-2.5">
        <button
          onClick={onStart}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-wf-primary py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)]"
        >
          {routeLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
          {routeLoading ? "Finding route…" : routeOptions ? `Start ${routePreference === "fastest" ? "fastest" : "step-free"} route` : "Start"}
        </button>
        <button
          onClick={onShare}
          aria-label="Share this destination"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-wf-border text-wf-ink"
        >
          <Share2 size={17} />
        </button>
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-wf-surface px-2.5 py-2.5 text-center">
      <p className="font-display text-[15px] font-bold text-wf-ink">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-wf-muted">{label}</p>
    </div>
  )
}

function StepDots({ destination }: { destination: Waypoint }) {
  return (
    <div className="mb-4 flex flex-col gap-0">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 border-[#CFE3FA] bg-wf-primary" />
        <span className="text-[13.5px] text-wf-body">Your location</span>
      </div>
      <div className="ml-[5px] h-[22px] w-0.5 bg-wf-border" />
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 border-[#CFF3EF] bg-wf-teal" />
        <span className="text-[13.5px] font-medium text-wf-ink">{destination.name}</span>
      </div>
    </div>
  )
}

function RouteChoice({
  routeOptions,
  routePreference,
  onChangeRoutePreference,
  alwaysStepFree,
  onChangeAlwaysStepFree,
  activeSteps,
}: {
  routeOptions: RouteOptionPair
  routePreference: RoutePreference
  onChangeRoutePreference: (p: RoutePreference) => void
  alwaysStepFree: boolean
  onChangeAlwaysStepFree: (v: boolean) => void
  activeSteps: RouteStep[]
}) {
  const cardClass = (on: boolean) =>
    `flex w-full items-center justify-between gap-3 rounded-[14px] border-[1.5px] px-4 py-[13px] text-left transition-colors ${
      on ? "border-wf-teal bg-[#F2FBF9] shadow-[0_6px_18px_rgba(15,181,174,0.15)]" : "border-wf-border bg-white"
    }`

  const fastestFloorChange = routeOptions.fastest.steps.find((s) => s.floorChange)?.floorChange
  const stepfreeFloorChange = routeOptions.stepfree.steps.find((s) => s.floorChange)?.floorChange

  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-wf-faint">Choose a route</p>
      <div className="flex flex-col gap-2.5">
        <button className={cardClass(routePreference === "fastest")} onClick={() => onChangeRoutePreference("fastest")}>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-wf-ink">Fastest</p>
            <p className="truncate text-xs text-wf-muted">
              {fastestFloorChange?.via === "stairs" ? "Includes stairs" : "Via lift"}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-display text-[17px] font-bold text-wf-ink">{routeOptions.fastest.estimatedMinutes} min</p>
            <p className="text-[11.5px] text-wf-muted">{fmtDistance(routeOptions.fastest.totalDistance)}</p>
          </div>
        </button>
        <button className={cardClass(routePreference === "stepfree")} onClick={() => onChangeRoutePreference("stepfree")}>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-wf-ink">
              Step-free
              <span className="rounded-full bg-wf-teal px-2 py-[2px] text-[10.5px] font-bold text-white">RECOMMENDED</span>
            </p>
            <p className="truncate text-xs text-wf-muted">
              {stepfreeFloorChange ? "Via lift, no stairs" : "No floor change"}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-display text-[17px] font-bold text-wf-ink">{routeOptions.stepfree.estimatedMinutes} min</p>
            <p className="text-[11.5px] text-wf-muted">{fmtDistance(routeOptions.stepfree.totalDistance)}</p>
          </div>
        </button>
      </div>

      <div className="mt-3 rounded-[14px] border border-wf-border-faint bg-[#F7FAFD] px-4 py-3.5">
        {activeSteps.filter((s) => !s.instruction.startsWith("You have arrived")).map((s, i) => (
          <div key={i} className={`flex items-start gap-2.5 ${i > 0 ? "mt-2" : ""}`}>
            <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-[#E7F2FF] font-display text-[11px] font-bold text-wf-primary">
              {i + 1}
            </span>
            <span className="text-[13.5px] leading-snug text-wf-body">{s.instruction}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[13.5px] text-wf-body">Always prefer step-free routes</span>
        <Toggle on={alwaysStepFree} onChange={onChangeAlwaysStepFree} />
      </div>
    </div>
  )
}

function StepIcon({ step }: { step: RouteStep }) {
  if (step.instruction.includes("arrived")) return <CheckCircle2 size={24} className="text-white" />
  if (step.floorChange) return <ArrowUpDown size={24} className="text-white" />
  if (step.instruction.includes("north")) return <ArrowUp size={24} className="text-white" />
  if (step.instruction.includes("east")) return <ArrowUpRight size={24} className="text-white" />
  if (step.instruction.includes("west")) return <ArrowUpLeft size={24} className="text-white" />
  if (step.instruction.includes("south")) return <Footprints size={24} className="text-white" />
  if (step.instruction.includes("left")) return <ArrowLeft size={24} className="text-white" />
  if (step.instruction.includes("right")) return <ArrowRight size={24} className="text-white" />
  return <Navigation size={24} className="text-white" />
}

function NavigatingSummary({
  destination,
  route,
  currentStepIndex,
  floorNaming,
  expanded,
  onStop,
  onScanQR,
  onOpenCamera,
}: {
  destination: Waypoint
  route: Route
  currentStepIndex: number
  floorNaming?: FloorNaming
  expanded: boolean
  onStop: () => void
  onScanQR: () => void
  onOpenCamera: () => void
}) {
  const step = route.steps[currentStepIndex] ?? route.steps[route.steps.length - 1]
  const isArrived = step.instruction.includes("arrived")

  // On phones the peek sheet shows just the maneuver + a one-line ETA glance, so
  // the map keeps most of the screen; swiping up (or lg+) reveals stats and
  // actions. `detail` gates the heavier rows.
  const detailFlex = `${expanded ? "flex" : "hidden"} lg:flex`
  const detailGrid = `${expanded ? "grid" : "hidden"} lg:grid`

  return (
    <div className="rounded-[18px] border border-wf-border p-[18px] shadow-[0_10px_30px_rgba(11,27,46,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-wf-teal-tint text-lg">
            {WAYPOINT_TYPE_ICONS[destination.type]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15.5px] font-semibold text-wf-ink">{destination.name}</p>
            <p className="truncate text-xs text-wf-muted">
              Step {currentStepIndex + 1} of {route.steps.length} · {route.estimatedMinutes} min · {fmtDistance(route.totalDistance)}
            </p>
          </div>
        </div>
        <button onClick={onStop} aria-label="Stop navigating" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <X size={15} />
        </button>
      </div>

      <div className={`flex items-center gap-3 rounded-[14px] px-4 py-3.5 ${isArrived ? "bg-wf-green-tint" : "bg-wf-primary"}`}>
        <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${isArrived ? "bg-wf-green" : "bg-wf-primary-deep"}`}>
          <StepIcon step={step} />
        </span>
        <div className="min-w-0">
          <p className={`text-[14.5px] font-semibold leading-snug line-clamp-2 ${isArrived ? "text-wf-green-text" : "text-white"}`}>{step.instruction}</p>
          {step.distance > 0 && <p className={`text-xs ${isArrived ? "text-wf-green-text" : "text-white/80"}`}>{fmtDistance(step.distance)}</p>}
        </div>
      </div>

      <div className={`${detailGrid} mt-4 grid-cols-3 gap-2`}>
        <StatTile label="time" value={`${route.estimatedMinutes} min`} />
        <StatTile label="distance" value={fmtDistance(route.totalDistance)} />
        <StatTile label="floor" value={floorLabel(destination.floor, floorNaming)} />
      </div>

      <div className={`${detailFlex} mt-4 gap-2.5`}>
        <button
          onClick={onScanQR}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-wf-primary py-2.5 text-xs font-semibold text-white"
        >
          <QrCode size={14} /> Scan to locate me
        </button>
        <button
          onClick={onOpenCamera}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-wf-border py-2.5 text-xs font-semibold text-wf-ink"
        >
          <Camera size={14} /> Live camera
        </button>
      </div>

      <button
        onClick={onStop}
        className={`${detailFlex} mt-2.5 w-full items-center justify-center gap-2 rounded-xl border border-wf-border py-3 text-sm font-semibold text-wf-ink`}
      >
        Stop navigating
      </button>
    </div>
  )
}
