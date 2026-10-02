"use client"

import { useMemo, useState } from "react"
import { VenueSummary, VenueCategory, VenueVisibility, Coordinates } from "@/lib/types"
import { NewVenueInput } from "@/lib/venues/core"
import { HOME_COUNTRY, countryName, matchCountries } from "@/lib/country"
import Overlay from "@/components/Overlay"
import {
  X, Plus, Check, MapPin, ChevronRight, Globe, Lock, Link2,
  ShieldCheck, Accessibility, Trash2, BadgeCheck, Navigation,
  Search, Footprints, Loader2,
} from "lucide-react"

// Cap how many directory venues render at once. The NHS hospital directory adds
// hundreds of location-only pins; showing them all would bloat the DOM, so that
// list is capped and the search box narrows it down. Fully-mapped venues are
// never capped — there are only a handful and they always show first.
const PUBLIC_LIST_LIMIT = 60

// A venue you can actually walk inside: it ships a real floor plan or mapped
// points, as opposed to a location-only directory pin.
const isMapped = (v: VenueSummary) => v.mapped

interface Props {
  // Summaries, not full venues: the list must not cost every hospital's
  // interior. The venue is loaded when it is chosen.
  venues: VenueSummary[]
  // True until the directory half of the list has arrived.
  directoryLoading?: boolean
  // The country whose public places are listed (ISO 3166-1 alpha-2). Public
  // venues elsewhere are not shown at all: a visitor sees their own country's
  // hospitals, and reaches another country only by searching for it, which
  // calls onCountryChange.
  country: string
  onCountryChange: (code: string) => void
  activeVenueId: string
  // Centre used for a newly-created venue — the live GPS fix when available,
  // otherwise the current map centre.
  currentCenter: Coordinates
  hasGps: boolean
  onSelect: (id: string) => void
  onCreate: (input: NewVenueInput) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const CATEGORY_META: { value: VenueCategory; label: string; icon: string }[] = [
  { value: "hospital", label: "Hospital", icon: "🏥" },
  { value: "mall", label: "Shopping centre", icon: "🛍️" },
  { value: "airport", label: "Airport", icon: "✈️" },
  { value: "station", label: "Station", icon: "🚉" },
  { value: "university", label: "Campus", icon: "🎓" },
  { value: "office", label: "Office", icon: "🏢" },
  { value: "home", label: "Home", icon: "🏠" },
  { value: "other", label: "Other", icon: "📍" },
]

function categoryIcon(c: VenueCategory): string {
  return CATEGORY_META.find((m) => m.value === c)?.icon ?? "📍"
}

const VISIBILITY_META: {
  value: VenueVisibility
  label: string
  Icon: typeof Globe
  blurb: string
}[] = [
  {
    value: "public",
    label: "Public",
    Icon: Globe,
    blurb: "Anyone can find and navigate it. Best for places people rely on — a hospital, mall or station. Needs you to confirm you're allowed to publish it; shows as Unverified until reviewed.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    Icon: Link2,
    blurb: "Not discoverable in search — only people you share it with can open it. Good for a venue still being mapped.",
  },
  {
    value: "private",
    label: "Private",
    Icon: Lock,
    blurb: "Only you. Best for an office, clinic or home. Only map places you're permitted to, and where filming is allowed.",
  },
]

const inputClass =
  "w-full rounded-xl border border-wf-border bg-white px-4 py-3 text-sm text-wf-ink outline-none placeholder:text-wf-muted focus:border-wf-primary"

export default function VenuePicker({
  venues, directoryLoading = false, country, onCountryChange, activeVenueId, currentCenter, hasGps,
  onSelect, onCreate, onDelete, onClose,
}: Props) {
  const [view, setView] = useState<"list" | "create">("list")

  // Create-form state
  const [name, setName] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [category, setCategory] = useState<VenueCategory>("other")
  const [visibility, setVisibility] = useState<VenueVisibility>("private")
  const [authorised, setAuthorised] = useState(false)
  const [stepFree, setStepFree] = useState(false)
  const [accessibleToilets, setAccessibleToilets] = useState(false)
  const [hearingLoop, setHearingLoop] = useState(false)
  const [accessNotes, setAccessNotes] = useState("")

  const [query, setQuery] = useState("")

  // Public places in the visitor's country. A venue without a country is one
  // someone made on this device, which is theirs wherever they are.
  const publicVenues = venues.filter((v) => v.visibility === "public" && (!v.country || v.country === country))
  const otherVenues = venues.filter((v) => v.visibility !== "public")
  // Typing a country's name is how someone reaches hospitals elsewhere.
  const countryMatches = useMemo(() => matchCountries(query).filter((c) => c !== country), [query, country])

  // Split public venues into the fully-mapped places (real floor plans / points
  // — walk inside) and the location-only directory pins, each alphabetical. The
  // mapped places are shown first and in full; the huge directory is capped.
  const { mappedVenues, directoryVenues } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? publicVenues.filter(
          (v) => v.name.toLowerCase().includes(q) || (v.subtitle?.toLowerCase().includes(q) ?? false)
        )
      : publicVenues
    const byName = (a: VenueSummary, b: VenueSummary) => a.name.localeCompare(b.name)
    return {
      mappedVenues: matches.filter(isMapped).sort(byName),
      directoryVenues: matches.filter((v) => !isMapped(v)).sort(byName),
    }
  }, [publicVenues, query])

  const shownDirectory = directoryVenues.slice(0, PUBLIC_LIST_LIMIT)
  const hiddenDirectoryCount = directoryVenues.length - shownDirectory.length
  // The mapped list is mostly hospitals, but a demonstration venue (a
  // residential building mapped from its CAD files) sits among them; the
  // heading must not call it one.
  const allHospitals = mappedVenues.every((v) => v.category === "hospital")

  // A public venue can only be published once the user attests they're allowed to.
  const canCreate = name.trim().length > 0 && (visibility !== "public" || authorised)

  function submit() {
    if (!canCreate) return
    onCreate({
      name,
      subtitle: subtitle.trim() || undefined,
      category,
      center: currentCenter,
      visibility,
      accessibility: {
        stepFreeRoute: stepFree,
        accessibleToilets,
        hearingLoop,
        notes: accessNotes.trim() || undefined,
      },
    })
  }

  if (view === "create") {
    return (
      <Overlay title="Map a new place" dismiss="back" dismissLabel="Back to places" onClose={() => setView("list")}>
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe-bar lg:px-6">
          {/* Where */}
          <div className={`mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${hasGps ? "bg-[#E7F2FF] text-wf-primary" : "bg-amber-50 text-amber-800"}`}>
            {hasGps ? <Navigation size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> : <MapPin size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />}
            <span>
              {hasGps
                ? "The place will be pinned to your current location. Stand at its entrance or centre, then survey it to add points."
                : "No GPS fix — the place will be pinned to the current map centre. You can survey it once you're there."}
            </span>
          </div>

          <Field label="Name" htmlFor="venue-name">
            <input
              id="venue-name"
              autoFocus
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Mall, 5th-floor office"
              className={inputClass}
            />
          </Field>

          <Field label="Full name / subtitle (optional)" htmlFor="venue-subtitle">
            <input
              id="venue-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Riverside Shopping Centre, Level 2"
              className={inputClass}
            />
          </Field>

          <Field label="Type of place">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of place">
              {CATEGORY_META.map((c) => (
                <button
                  key={c.value}
                  role="radio"
                  aria-checked={category === c.value}
                  onClick={() => setCategory(c.value)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c.value ? "border-wf-primary bg-wf-primary text-white" : "border-wf-border bg-white text-wf-body hover:border-wf-primary"
                  }`}
                >
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Who can see it">
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Who can see it">
              {VISIBILITY_META.map(({ value, label, Icon, blurb }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={visibility === value}
                  onClick={() => setVisibility(value)}
                  className={`flex items-start gap-3 rounded-[14px] border-[1.5px] px-3 py-3 text-left transition-colors ${
                    visibility === value ? "border-wf-primary bg-[#F2F8FF]" : "border-wf-border bg-white"
                  }`}
                >
                  <Icon size={18} className={`mt-0.5 ${visibility === value ? "text-wf-primary" : "text-wf-faint"}`} aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-wf-ink">{label}</p>
                    <p className="text-xs leading-snug text-wf-muted">{blurb}</p>
                  </div>
                  {visibility === value && <Check size={16} className="mt-0.5 text-wf-primary" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </Field>

          {/* Measure: publishing a public place requires an authority attestation */}
          {visibility === "public" && (
            <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-wf-border bg-wf-surface px-3 py-3">
              <input
                type="checkbox"
                checked={authorised}
                onChange={(e) => setAuthorised(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-wf-primary"
              />
              <span className="text-xs leading-snug text-wf-body">
                <ShieldCheck size={13} className="mb-0.5 mr-1 inline text-wf-primary" aria-hidden="true" />
                I&apos;m authorised to map and publish this place. It will appear as
                <span className="font-semibold"> Unverified</span> until an administrator confirms it.
              </span>
            </label>
          )}

          {/* Measure: accessibility & safety info, encouraged for public venues */}
          <Field label="Accessibility (optional)">
            <div className="flex flex-col gap-2">
              <OptionRow label="Step-free route" Icon={Accessibility} on={stepFree} onChange={setStepFree} />
              <OptionRow label="Accessible toilets" Icon={Accessibility} on={accessibleToilets} onChange={setAccessibleToilets} />
              <OptionRow label="Hearing loop" Icon={Accessibility} on={hearingLoop} onChange={setHearingLoop} />
              <input
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                placeholder="Other access or safety notes…"
                aria-label="Other access or safety notes"
                className={`${inputClass} py-2.5`}
              />
            </div>
          </Field>

          <button
            onClick={submit}
            disabled={!canCreate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-wf-primary py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(10,93,194,0.3)] disabled:opacity-50 disabled:shadow-none"
          >
            <Check size={18} aria-hidden="true" />
            Create place
          </button>
          {visibility === "public" && !authorised && (
            <p className="mt-2 text-center text-xs text-wf-muted">Confirm you&apos;re authorised to publish a public place.</p>
          )}
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay title="Places" onClose={onClose} dismissLabel="Close places">
      <div className="flex-1 overflow-y-auto pb-safe-bar">
        <button
          onClick={() => setView("create")}
          className="flex w-full items-center gap-3 border-b border-wf-border-faint px-4 py-4 text-left hover:bg-[#F7FAFD] lg:px-6"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wf-primary to-wf-teal">
            <Plus size={20} className="text-white" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block text-[14.5px] font-semibold text-wf-ink">Map a new place</span>
            <span className="block text-xs text-wf-muted">Public or private — you choose who can see it</span>
          </span>
          <ChevronRight size={16} className="text-wf-faint" aria-hidden="true" />
        </button>

        <SectionLabel>Public places · {countryName(country)}</SectionLabel>
        <div className="px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-wf-border bg-wf-surface px-3 py-2.5 focus-within:border-wf-primary">
            <Search size={16} className="flex-shrink-0 text-wf-faint" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hospitals & places"
              aria-label="Search hospitals and places"
              className="flex-1 bg-transparent text-sm text-wf-ink placeholder:text-wf-muted focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="text-wf-faint hover:text-wf-ink">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {countryMatches.map((code) => (
          <button
            key={code}
            onClick={() => { onCountryChange(code); setQuery("") }}
            className="flex w-full items-center gap-3 border-b border-wf-border-faint px-4 py-3 text-left hover:bg-[#F7FAFD] lg:px-6"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-wf-surface" aria-hidden="true">
              <Globe size={18} className="text-wf-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold text-wf-ink">Hospitals in {countryName(code)}</span>
              <span className="block text-xs text-wf-muted">Show that country&apos;s places instead</span>
            </span>
            <ChevronRight size={16} className="text-wf-faint" aria-hidden="true" />
          </button>
        ))}
        {/* Fully-mapped hospitals first — you can walk inside these. */}
        {mappedVenues.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pb-1.5 pt-3 lg:px-6">
            <Footprints size={13} className="text-wf-primary" aria-hidden="true" />
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-wf-primary">
              {allHospitals ? "Mapped hospitals" : "Mapped places"} · walk inside
            </p>
          </div>
        )}
        {mappedVenues.map((v) => (
          <VenueRow key={v.id} venue={v} mapped active={v.id === activeVenueId} onSelect={onSelect} onDelete={onDelete} />
        ))}

        {/* Then the location-only directory pins. */}
        {shownDirectory.length > 0 && (
          <p className="px-4 pb-1.5 pt-4 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-wf-muted lg:px-6">
            Hospital directory · location only
          </p>
        )}
        {shownDirectory.map((v) => (
          <VenueRow key={v.id} venue={v} active={v.id === activeVenueId} onSelect={onSelect} onDelete={onDelete} />
        ))}

        {directoryLoading && (
          <p className="flex items-center gap-2 px-4 py-3 text-xs text-wf-muted lg:px-6" role="status">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />{" "}
            {country === HOME_COUNTRY ? "Loading the NHS hospital directory…" : `Loading hospitals in ${countryName(country)}…`}
          </p>
        )}

        {!directoryLoading && mappedVenues.length === 0 && shownDirectory.length === 0 && countryMatches.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-wf-muted">
            {query.trim()
              ? `No places match “${query}”.`
              : `No hospitals are listed for ${countryName(country)} yet. You can map a place yourself.`}
          </p>
        )}
        {hiddenDirectoryCount > 0 && (
          <p className="px-4 py-3 text-center text-xs text-wf-muted">
            Showing {shownDirectory.length} of {directoryVenues.length} directory hospitals. Keep typing to narrow it down.
          </p>
        )}

        {otherVenues.length > 0 && (
          <>
            <SectionLabel>Your places</SectionLabel>
            {otherVenues.map((v) => (
              <VenueRow key={v.id} venue={v} active={v.id === activeVenueId} onSelect={onSelect} onDelete={onDelete} />
            ))}
          </>
        )}
      </div>
    </Overlay>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-2 pt-4 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-wf-muted lg:px-6">{children}</p>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-wf-muted">{label}</label>
      ) : (
        <p className="mb-1.5 text-xs font-semibold text-wf-muted">{label}</p>
      )}
      {children}
    </div>
  )
}

// A tickable option row (checkbox semantics), distinct from the app's pill
// Toggle switch: these are facts about the place, not settings.
function OptionRow({ label, Icon, on, onChange }: { label: string; Icon: typeof Globe; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        on ? "border-wf-primary bg-[#F2F8FF]" : "border-wf-border bg-white"
      }`}
    >
      <Icon size={16} className={on ? "text-wf-primary" : "text-wf-faint"} aria-hidden="true" />
      <span className="flex-1 text-sm text-wf-ink">{label}</span>
      {on && <Check size={16} className="text-wf-primary" aria-hidden="true" />}
    </button>
  )
}

function VenueRow({ venue, active, mapped = false, onSelect, onDelete }: { venue: VenueSummary; active: boolean; mapped?: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  const isUserVenue = venue.id.startsWith("venue-")
  return (
    <div className={`flex w-full items-center gap-3 border-b border-wf-border-faint px-4 py-3 lg:px-6 ${active ? "bg-[#EEF5FD]" : mapped ? "bg-[#F7FAFD]" : ""}`}>
      <button onClick={() => onSelect(venue.id)} aria-current={active ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl ${mapped ? "bg-[#E7F2FF] ring-1 ring-wf-primary/30" : "bg-wf-surface"}`} aria-hidden="true">
          {categoryIcon(venue.category)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-[14.5px] font-semibold text-wf-ink">
            {venue.name}
            {venue.verified && <BadgeCheck size={14} className="flex-shrink-0 text-wf-primary" aria-label="Verified" />}
          </span>
          <span className="flex items-center gap-1.5 truncate text-xs text-wf-muted">
            {mapped && (venue.illustrative ? (
              <span className="inline-flex flex-shrink-0 items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-800">
                Illustrative
              </span>
            ) : (
              <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-wf-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                <Footprints size={9} aria-hidden="true" /> Mapped
              </span>
            ))}
            <span className="truncate">
              {venue.subtitle ? `${venue.subtitle} · ` : ""}
              {venue.visibility[0].toUpperCase() + venue.visibility.slice(1)}
            </span>
          </span>
        </span>
      </button>
      {active ? (
        <Check size={18} className="flex-shrink-0 text-wf-primary" aria-label="Currently open" />
      ) : isUserVenue ? (
        <button onClick={() => onDelete(venue.id)} aria-label={`Delete ${venue.name}`} className="flex-shrink-0 rounded-full p-1.5 text-wf-faint hover:bg-red-50 hover:text-red-600">
          <Trash2 size={16} />
        </button>
      ) : (
        <ChevronRight size={16} className="flex-shrink-0 text-wf-faint" aria-hidden="true" />
      )}
    </div>
  )
}
