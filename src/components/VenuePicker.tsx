"use client"

import { useState } from "react"
import { Venue, VenueCategory, VenueVisibility, Coordinates } from "@/lib/types"
import { NewVenueInput } from "@/lib/venues"
import {
  X, Plus, Check, MapPin, ChevronRight, Globe, Lock, Link2,
  ShieldCheck, Accessibility, Trash2, BadgeCheck, Navigation,
  LogIn, LogOut, Cloud, CloudOff,
} from "lucide-react"

interface Props {
  venues: Venue[]
  activeVenueId: string
  // Centre used for a newly-created venue — the live GPS fix when available,
  // otherwise the current map centre.
  currentCenter: Coordinates
  hasGps: boolean
  // Account state. cloudEnabled = a backend is configured; userEmail set = signed in.
  cloudEnabled: boolean
  userEmail: string | null
  onSignIn: () => void
  onSignOut: () => void
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

export default function VenuePicker({
  venues, activeVenueId, currentCenter, hasGps, cloudEnabled, userEmail,
  onSignIn, onSignOut, onSelect, onCreate, onDelete, onClose,
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

  const publicVenues = venues.filter((v) => v.visibility === "public")
  const otherVenues = venues.filter((v) => v.visibility !== "public")

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

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      {/* Header */}
      <div className="bg-[#005EB8] px-4 pt-safe-bar pb-4 flex items-center gap-3">
        <button onClick={view === "create" ? () => setView("list") : onClose} className="text-white" aria-label="Back">
          <X size={22} />
        </button>
        <h2 className="text-white font-bold text-lg flex-1">
          {view === "list" ? "Places" : "Map a new place"}
        </h2>
      </div>

      {view === "list" ? (
        <div className="flex-1 overflow-y-auto pb-safe-bar">
          {/* Account / sync status */}
          {!cloudEnabled ? (
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <CloudOff size={16} className="text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-500">Saved on this device. Sign-in isn&apos;t set up on this server yet.</p>
            </div>
          ) : userEmail ? (
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
              <Cloud size={16} className="text-[#005EB8] flex-shrink-0" />
              <p className="text-xs text-gray-600 flex-1 truncate">Synced · {userEmail}</p>
              <button onClick={onSignOut} className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          ) : (
            <button onClick={onSignIn} className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 active:bg-gray-50 text-left">
              <LogIn size={16} className="text-[#005EB8] flex-shrink-0" />
              <p className="text-xs text-gray-600 flex-1">Sign in to publish public places and sync private ones across devices</p>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          )}

          <button
            onClick={() => setView("create")}
            className="w-full flex items-center gap-3 px-4 py-4 border-b border-gray-100 active:bg-gray-50 text-left"
          >
            <div className="w-10 h-10 bg-[#005EB8] rounded-full flex items-center justify-center flex-shrink-0">
              <Plus size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Map a new place</p>
              <p className="text-xs text-gray-500">Public or private — you choose who can see it</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>

          <SectionLabel>Public places</SectionLabel>
          {publicVenues.map((v) => (
            <VenueRow key={v.id} venue={v} active={v.id === activeVenueId} onSelect={onSelect} onDelete={onDelete} />
          ))}

          {otherVenues.length > 0 && (
            <>
              <SectionLabel>Your places</SectionLabel>
              {otherVenues.map((v) => (
                <VenueRow key={v.id} venue={v} active={v.id === activeVenueId} onSelect={onSelect} onDelete={onDelete} />
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe-bar">
          {/* Where */}
          <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs ${hasGps ? "bg-blue-50 text-[#005EB8]" : "bg-amber-50 text-amber-700"}`}>
            {hasGps ? <Navigation size={15} className="mt-0.5 flex-shrink-0" /> : <MapPin size={15} className="mt-0.5 flex-shrink-0" />}
            <span>
              {hasGps
                ? "The place will be pinned to your current location. Stand at its entrance or centre, then survey it to add points."
                : "No GPS fix — the place will be pinned to the current map centre. You can survey it once you're there."}
            </span>
          </div>

          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Mall, 5th-floor office"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#005EB8]"
            />
          </Field>

          <Field label="Full name / subtitle (optional)">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Riverside Shopping Centre, Level 2"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#005EB8]"
            />
          </Field>

          <Field label="Type of place">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_META.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    category === c.value ? "bg-[#005EB8] text-white border-[#005EB8]" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Who can see it">
            <div className="flex flex-col gap-2">
              {VISIBILITY_META.map(({ value, label, Icon, blurb }) => (
                <button
                  key={value}
                  onClick={() => setVisibility(value)}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                    visibility === value ? "border-[#005EB8] bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <Icon size={18} className={visibility === value ? "text-[#005EB8] mt-0.5" : "text-gray-400 mt-0.5"} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 leading-snug">{blurb}</p>
                  </div>
                  {visibility === value && <Check size={16} className="text-[#005EB8] mt-0.5" />}
                </button>
              ))}
            </div>
          </Field>

          {/* Measure: publishing a public place requires an authority attestation */}
          {visibility === "public" && (
            <label className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-200 px-3 py-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={authorised}
                onChange={(e) => setAuthorised(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#005EB8]"
              />
              <span className="text-xs text-gray-600 leading-snug">
                <ShieldCheck size={13} className="inline mb-0.5 mr-1 text-[#005EB8]" />
                I&apos;m authorised to map and publish this place. It will appear as
                <span className="font-semibold"> Unverified</span> until an administrator confirms it.
              </span>
            </label>
          )}

          {/* Measure: accessibility & safety info, encouraged for public venues */}
          <Field label="Accessibility (optional)">
            <div className="flex flex-col gap-2">
              <Toggle label="Step-free route" Icon={Accessibility} on={stepFree} onChange={setStepFree} />
              <Toggle label="Accessible toilets" Icon={Accessibility} on={accessibleToilets} onChange={setAccessibleToilets} />
              <Toggle label="Hearing loop" Icon={Accessibility} on={hearingLoop} onChange={setHearingLoop} />
              <input
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                placeholder="Other access or safety notes…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#005EB8]"
              />
            </div>
          </Field>

          <button
            onClick={submit}
            disabled={!canCreate}
            className="w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white rounded-xl py-3.5 font-bold text-base disabled:opacity-50"
          >
            <Check size={18} />
            Create place
          </button>
          {visibility === "public" && !authorised && (
            <p className="text-center text-xs text-gray-400 mt-2">Confirm you&apos;re authorised to publish a public place.</p>
          )}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Toggle({ label, Icon, on, onChange }: { label: string; Icon: typeof Globe; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
        on ? "border-[#005EB8] bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <Icon size={16} className={on ? "text-[#005EB8]" : "text-gray-400"} />
      <span className="flex-1 text-sm text-gray-800">{label}</span>
      {on && <Check size={16} className="text-[#005EB8]" />}
    </button>
  )
}

function VenueRow({ venue, active, onSelect, onDelete }: { venue: Venue; active: boolean; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  const isUserVenue = venue.id.startsWith("venue-")
  return (
    <div className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 ${active ? "bg-blue-50" : ""}`}>
      <button onClick={() => onSelect(venue.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
          {categoryIcon(venue.category)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
            {venue.name}
            {venue.verified && <BadgeCheck size={14} className="text-[#005EB8] flex-shrink-0" />}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {venue.subtitle ? `${venue.subtitle} · ` : ""}
            {venue.visibility[0].toUpperCase() + venue.visibility.slice(1)}
          </p>
        </div>
      </button>
      {active ? (
        <Check size={18} className="text-[#005EB8] flex-shrink-0" />
      ) : isUserVenue ? (
        <button onClick={() => onDelete(venue.id)} aria-label="Delete place" className="p-1.5 text-gray-300 hover:text-red-500 flex-shrink-0">
          <Trash2 size={16} />
        </button>
      ) : (
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
      )}
    </div>
  )
}
