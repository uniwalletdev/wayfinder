"use client"
import { useEffect, useState } from "react"
import { apiUrl } from "./app-shell"

// Which hospitals are Official (listed and kept up to date by the hospital
// itself; src/lib/billing/), for the badge in the venue header and the places
// list. Fetched once per page life and shared. Offline or on a deployment
// without billing it is simply empty: no badge, nothing else changes.

export interface OfficialListing {
  org: string
  orgId: string
  brandColor: string | null
  logo: boolean
}

type Listings = Record<string, OfficialListing>

let cached: Listings | null = null
let pending: Promise<Listings> | null = null

function load(): Promise<Listings> {
  if (cached) return Promise.resolve(cached)
  if (!pending) {
    pending = fetch(apiUrl("/api/official"))
      .then((r) => (r.ok ? r.json() : { sites: {} }))
      .then((d: { sites?: Listings }) => (cached = d.sites ?? {}))
      .catch(() => {
        // Tried again on the next page that asks.
        pending = null
        return {}
      })
  }
  return pending
}

export function useOfficialListings(): Listings {
  const [listings, setListings] = useState<Listings>(cached ?? {})
  useEffect(() => {
    let live = true
    load().then((l) => live && setListings(l))
    return () => {
      live = false
    }
  }, [])
  return listings
}

export function officialLogoUrl(listing: OfficialListing): string | null {
  return listing.logo ? apiUrl(`/api/official/logo/${listing.orgId}`) : null
}
