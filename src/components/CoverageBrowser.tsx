"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Building2, Search } from "lucide-react"
import { apiUrl } from "@/lib/app-shell"
import { countryName, detectCountry, HOME_COUNTRY } from "@/lib/country"
import { MAPPED_VENUE_SUMMARIES } from "@/lib/venues/catalog-data"

// Everything Findway can show a visitor around, country by country: the
// counts, then a card per site map and indoor map that opens it in the app.
// The worldwide part comes from the shared database (/api/world, filled by the
// World hospital data workflow); the UK's maps ship with the app and its
// hospital list is the NHS register, so it is listed from the bundle.

interface CountryRow {
  country: string
  // null for the UK, whose list is the NHS register rather than a count here.
  hospitals: number | null
  indoor: number
  siteMaps: number
}

interface MapRow {
  id: string
  name: string
  kind: "indoor" | "campus"
  city?: string
  floors?: number
  places?: number
  // The first floor plan, shown as the card's thumbnail.
  plan?: string
  // A stand-in drawing rather than a map of the real building (src/lib/types.ts).
  illustrative?: boolean
}

const PAGE = 30

const UK_MAPS: MapRow[] = MAPPED_VENUE_SUMMARIES.filter(
  (v) => v.country === HOME_COUNTRY && v.category === "hospital" && v.visibility === "public"
).map((v) => ({
  id: v.id,
  name: v.name,
  kind: "indoor",
  city: v.subtitle?.split(" · ").slice(1).join(" · ") || undefined,
  illustrative: v.illustrative,
}))

const UK_ROW: CountryRow = { country: HOME_COUNTRY, hospitals: null, indoor: UK_MAPS.length, siteMaps: 0 }

const mapsOf = (c: CountryRow) => c.indoor + c.siteMaps
const n = (v: number) => v.toLocaleString("en-GB")

export default function CoverageBrowser() {
  const [countries, setCountries] = useState<CountryRow[] | null>(null)
  // Why only the UK is listed, when it is: the deployment has no database
  // (404), or the database has nothing published yet.
  const [missing, setMissing] = useState<"no-database" | "unpublished" | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [maps, setMaps] = useState<Record<string, MapRow[] | "error">>({ [HOME_COUNTRY]: UK_MAPS })
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(PAGE)
  const requested = useRef(new Set<string>([HOME_COUNTRY]))

  const loadMaps = useCallback((cc: string) => {
    if (requested.current.has(cc)) return
    requested.current.add(cc)
    fetch(apiUrl(`/api/world/${cc}/maps`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { maps: MapRow[] }) => setMaps((m) => ({ ...m, [cc]: d.maps })))
      .catch(() => {
        requested.current.delete(cc)
        setMaps((m) => ({ ...m, [cc]: "error" }))
      })
  }, [])

  const select = useCallback(
    (cc: string) => {
      setSelected(cc)
      setQuery("")
      setShown(PAGE)
      loadMaps(cc)
      try {
        window.history.replaceState(null, "", `?country=${cc}`)
      } catch {}
    },
    [loadMaps]
  )

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl("/api/world"))
      .then((r) => (r.ok ? r.json() : r.status === 404 ? { countries: [], noDatabase: true } : null))
      .catch(() => null)
      .then((data: { countries?: CountryRow[]; noDatabase?: boolean } | null) => {
        if (cancelled) return
        const world = (data?.countries ?? []).filter((c) => c.country !== HOME_COUNTRY)
        if (world.length === 0) setMissing(data?.noDatabase ? "no-database" : "unpublished")
        const rows = [UK_ROW, ...world].sort((a, b) => mapsOf(b) - mapsOf(a) || (b.hospitals ?? 0) - (a.hospitals ?? 0))
        setCountries(rows)
        // The country in the link, else the visitor's own, else the one with the most maps.
        const asked = new URLSearchParams(window.location.search).get("country")?.toUpperCase()
        const pick = [asked, detectCountry()].find((c) => c && rows.some((r) => r.country === c)) ?? rows[0].country
        select(pick)
      })
    return () => {
      cancelled = true
    }
  }, [select])

  const totals = useMemo(() => {
    const rows = countries ?? []
    return {
      countries: rows.length,
      hospitals: rows.reduce((s, c) => s + (c.hospitals ?? 0), 0),
      siteMaps: rows.reduce((s, c) => s + c.siteMaps, 0),
      indoor: rows.reduce((s, c) => s + c.indoor, 0),
    }
  }, [countries])

  const current = countries?.find((c) => c.country === selected) ?? null
  const list = selected ? maps[selected] : undefined
  const filtered = useMemo(() => {
    if (!Array.isArray(list)) return []
    const q = query.trim().toLowerCase()
    return q ? list.filter((m) => m.name.toLowerCase().includes(q) || m.city?.toLowerCase().includes(q)) : list
  }, [list, query])

  if (!countries) return <div className="py-10 text-[15px] text-wf-muted">Loading what has been mapped…</div>

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={n(totals.countries)} label={totals.countries === 1 ? "country" : "countries"} />
        <Stat value={n(totals.hospitals)} label="hospitals listed, plus the NHS register" />
        <Stat value={n(totals.siteMaps)} label="site maps of hospital grounds" />
        <Stat value={n(totals.indoor)} label="indoor maps" />
      </div>

      {missing && (
        <div className="mt-6 rounded-2xl border border-wf-border bg-wf-surface px-5 py-4 text-[15px] text-wf-muted">
          {missing === "no-database"
            ? "This deployment is not connected to the database that holds the worldwide hospital data (DATABASE_URL), so only the UK’s maps are listed."
            : "No worldwide hospital data has been published to the database yet, so only the UK’s maps are listed for now."}
        </div>
      )}

      <h2>Countries</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Countries">
        {countries.map((c) => {
          const on = c.country === selected
          return (
            <button
              key={c.country}
              type="button"
              aria-pressed={on}
              onClick={() => select(c.country)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors ${
                on ? "border-wf-primary bg-wf-primary text-white" : "border-wf-border bg-white text-wf-ink hover:border-wf-primary"
              }`}
            >
              {countryName(c.country)}
              <span className={`text-[12.5px] ${on ? "text-white/80" : "text-wf-faint"}`}>{n(mapsOf(c))}</span>
            </button>
          )
        })}
      </div>

      {current && (
        <section aria-labelledby="coverage-country">
          <h2 id="coverage-country">{countryName(current.country)}</h2>
          <div className="text-[15px] text-wf-muted">
            {[
              current.hospitals === null ? "Every NHS hospital, from the NHS register" : `${n(current.hospitals)} hospitals listed`,
              current.siteMaps ? `${n(current.siteMaps)} site ${current.siteMaps === 1 ? "map" : "maps"}` : null,
              current.indoor ? `${n(current.indoor)} indoor ${current.indoor === 1 ? "map" : "maps"}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>

          {Array.isArray(list) && list.length > 8 && (
            <label className="mt-5 flex items-center gap-2 rounded-xl border border-wf-border bg-white px-3.5 py-2.5 focus-within:border-wf-primary">
              <Search size={16} className="text-wf-faint" aria-hidden="true" />
              <span className="sr-only">Find a hospital in {countryName(current.country)}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShown(PAGE)
                }}
                placeholder={`Find a hospital or town in ${countryName(current.country)}`}
                className="w-full bg-transparent text-[15px] text-wf-ink outline-none placeholder:text-wf-faint"
              />
            </label>
          )}

          {list === undefined && <div className="py-8 text-[15px] text-wf-muted">Loading maps…</div>}
          {list === "error" && (
            <div className="py-8 text-[15px] text-wf-muted">
              The maps for {countryName(current.country)} could not be loaded.{" "}
              <button type="button" className="font-semibold text-wf-primary" onClick={() => loadMaps(current.country)}>
                Try again
              </button>
            </div>
          )}
          {Array.isArray(list) && list.length === 0 && (
            <div className="py-8 text-[15px] text-wf-muted">
              No site or indoor maps yet: OpenStreetMap does not have enough of this country’s hospital grounds mapped. Its hospitals are still
              listed in the app with directions to the door.
            </div>
          )}
          {Array.isArray(list) && list.length > 0 && filtered.length === 0 && (
            <div className="py-8 text-[15px] text-wf-muted">Nothing matches “{query.trim()}”.</div>
          )}

          {filtered.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, shown).map((m) => (
                <MapCard key={m.id} map={m} />
              ))}
            </div>
          )}
          {filtered.length > shown && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShown((s) => s + PAGE)}
                className="rounded-full border border-wf-border px-5 py-2.5 text-[14px] font-semibold text-wf-ink hover:border-wf-primary"
              >
                Show more ({n(filtered.length - shown)} left)
              </button>
            </div>
          )}
        </section>
      )}

      <div className="mt-12 border-t border-wf-border-faint pt-5 text-[13px] leading-relaxed text-wf-faint">
        Hospital lists, site maps and indoor maps outside the UK: ©{" "}
        <a href="https://www.openstreetmap.org/copyright" className="underline hover:text-wf-primary" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
        , available under the Open Database Licence. UK hospitals: the NHS register.
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-wf-border bg-white px-4 py-3.5">
      <div className="font-display text-[26px] font-bold leading-none -tracking-[0.5px] text-wf-ink">{value}</div>
      <div className="mt-1.5 text-[13px] leading-snug text-wf-muted">{label}</div>
    </div>
  )
}

function MapCard({ map: m }: { map: MapRow }) {
  const facts =
    m.places === undefined
      ? m.illustrative
        ? "Illustrative floor plan, not the real layout"
        : "Floor plans in the app"
      : m.kind === "campus"
        ? `${n(m.places)} ${m.places === 1 ? "place" : "places"} on the grounds`
        : `${n(m.floors ?? 1)} ${m.floors === 1 ? "floor" : "floors"} · ${n(m.places)} places`
  return (
    <Link
      href={`/navigate?venue=${encodeURIComponent(m.id)}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-wf-border bg-white transition-shadow hover:border-wf-primary hover:shadow-[0_10px_28px_rgba(10,93,194,0.12)]"
    >
      {m.plan ? (
        <div className="relative aspect-[4/3] overflow-hidden border-b border-wf-border-faint bg-wf-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={apiUrl(`/api/world/plans/${m.id}/${m.plan}.svg`)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain" />
        </div>
      ) : (
        // The UK's bundled maps have no thumbnail to hand without loading each venue.
        <div className="flex h-14 items-center border-b border-wf-border-faint bg-wf-surface px-4">
          <Building2 size={22} className="text-wf-faint" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 px-4 py-3.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-wf-teal-text">
          {m.kind === "campus" ? "Site map" : "Indoor map"}
        </span>
        <h3 className="font-display text-[16px] font-semibold leading-snug text-wf-ink group-hover:text-wf-primary">{m.name}</h3>
        {m.city && <span className="text-[13.5px] text-wf-muted">{m.city}</span>}
        <span className="mt-auto pt-2 text-[13px] text-wf-faint">{facts}</span>
      </div>
    </Link>
  )
}
