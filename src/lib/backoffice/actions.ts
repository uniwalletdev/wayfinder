"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { randomUUID } from "crypto"
import { isDatabaseConfigured, query } from "@/lib/db"
import { getAdmin, signInWithPassword, signOut, type AdminIdentity } from "./auth"
import { diff, recordAudit } from "./audit"
import { isUuid } from "./data"
import type { ActionState, DemandResolution, VenueStatus } from "./types"

// Every write the back office can perform.
//
// Server Actions are ordinary POST endpoints — reachable directly, not only
// through the forms that render them (Next.js, "Mutating Data") — so each one
// here starts by re-establishing who is calling. The page-level guard is a
// convenience for the operator, not a security boundary; this is the boundary.
//
// The shape is the same in all of them: authorise, validate, read the current
// row, write, record what changed, refresh. The read-before-write is what makes
// the audit log worth having — without it a rename records "name is now X" and
// loses the only fact anyone will later want, which is what it used to be.

const CATEGORIES = ["hospital", "mall", "airport", "station", "university", "office", "home", "other"]
const VISIBILITIES = ["public", "unlisted", "private"]
const STATUSES: VenueStatus[] = ["published", "pending", "suppressed"]
const RESOLUTIONS: DemandResolution[] = ["mapped", "not_a_place", "duplicate", "wont_fix"]
const WAYPOINT_TYPES = [
  "ward", "department", "lift", "stairs", "toilet", "exit", "reception", "canteen", "pharmacy", "other",
]

// ── Small helpers ──────────────────────────────────────────────────────────

function ok(message: string): ActionState {
  return { ok: true, message }
}
function no(message: string): ActionState {
  return { ok: false, message }
}

/**
 * The guard every action below runs first. Returns the identity or an error
 * state to hand straight back to the form — expressed as a value rather than a
 * thrown exception so a signed-out operator sees "your session has expired"
 * instead of the framework's error boundary.
 */
async function authorize(): Promise<{ admin: AdminIdentity } | { error: ActionState }> {
  const admin = await getAdmin()
  if (!admin) return { error: no("Your session has ended. Sign in again to make changes.") }
  if (!isDatabaseConfigured()) return { error: no("No database is configured, so there is nothing to change.") }
  return { admin }
}

function text(form: FormData, key: string, max = 500): string {
  const v = form.get(key)
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

function num(form: FormData, key: string): number | null {
  const v = form.get(key)
  if (typeof v !== "string" || v.trim() === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function oneOf<T extends string>(form: FormData, key: string, allowed: readonly T[]): T | null {
  const v = form.get(key)
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null
}

// ── Session ────────────────────────────────────────────────────────────────

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const password = typeof form.get("password") === "string" ? (form.get("password") as string) : ""
  if (!password) return no("Enter the back-office password.")
  const result = await signInWithPassword(password)
  if (!result.ok) return no(result.error)
  await recordAudit({
    actor: "shared password",
    action: "session.start",
    summary: "Signed in to the back office with the shared password",
  })
  redirect("/backoffice")
}

export async function logoutAction(): Promise<void> {
  const admin = await getAdmin()
  await signOut()
  if (admin) {
    await recordAudit({ actor: admin.actor, action: "session.end", summary: "Signed out of the back office" })
  }
  redirect("/backoffice/login")
}

// ── Venues ─────────────────────────────────────────────────────────────────

interface VenueSnapshot {
  id: string
  name: string
  subtitle: string | null
  category: string
  visibility: string
  status: VenueStatus
  verified: boolean
  center_lat: number
  center_lng: number
  default_zoom: number
  review_note: string | null
}

async function snapshot(id: string): Promise<VenueSnapshot | null> {
  const { rows } = await query<VenueSnapshot>(
    `select id, name, subtitle, category, visibility, status, verified,
            center_lat, center_lng, default_zoom, review_note
       from public.wf_venues where id = $1`,
    [id]
  )
  return rows[0] ?? null
}

export async function updateVenueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const id = text(form, "id", 64)
  if (!isUuid(id)) return no("That venue id is not valid.")

  const name = text(form, "name", 120)
  const subtitle = text(form, "subtitle", 200)
  const category = oneOf(form, "category", CATEGORIES)
  const visibility = oneOf(form, "visibility", VISIBILITIES)
  const lat = num(form, "centerLat")
  const lng = num(form, "centerLng")
  const zoom = num(form, "defaultZoom")

  if (!name) return no("A venue needs a name.")
  if (!category || !visibility) return no("Pick a category and a visibility.")
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return no("The centre point must be a real latitude and longitude.")
  }
  if (zoom === null || zoom < 1 || zoom > 22) return no("Default zoom must be between 1 and 22.")

  try {
    const before = await snapshot(id)
    if (!before) return no("That venue no longer exists.")

    await query(
      `update public.wf_venues
          set name = $2, subtitle = $3, category = $4, visibility = $5,
              center_lat = $6, center_lng = $7, default_zoom = $8, updated_at = now()
        where id = $1`,
      [id, name, subtitle || null, category, visibility, lat, lng, Math.round(zoom)]
    )

    const changed = diff(before as unknown as Record<string, unknown>, {
      name,
      subtitle: subtitle || null,
      category,
      visibility,
      center_lat: lat,
      center_lng: lng,
      default_zoom: Math.round(zoom),
    })
    await recordAudit({
      actor: auth.admin.actor,
      action: "venue.update",
      targetType: "venue",
      targetId: id,
      summary: `Edited “${before.name}”`,
      detail: { venueId: id, changed },
    })
    refresh()
    return ok(Object.keys(changed).length === 0 ? "Nothing to change — saved as it was." : "Venue saved.")
  } catch (err) {
    return no(`Could not save: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function setVenueStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const id = text(form, "id", 64)
  const status = oneOf(form, "status", STATUSES)
  const note = text(form, "note", 500)
  if (!isUuid(id) || !status) return no("That moderation request was not valid.")

  const WORDS: Record<VenueStatus, string> = {
    published: "listed in the app",
    pending: "held for review",
    suppressed: "hidden from the app",
  }

  try {
    const before = await snapshot(id)
    if (!before) return no("That venue no longer exists.")
    await query(
      `update public.wf_venues
          set status = $2, review_note = $3, reviewed_at = now(), reviewed_by = $4, updated_at = now()
        where id = $1`,
      [id, status, note || null, auth.admin.actor]
    )
    await recordAudit({
      actor: auth.admin.actor,
      action: `venue.${status}`,
      targetType: "venue",
      targetId: id,
      summary: `“${before.name}” is now ${WORDS[status]}`,
      detail: { venueId: id, from: before.status, to: status, note: note || null },
    })
    refresh()
    return ok(`“${before.name}” is now ${WORDS[status]}.`)
  } catch (err) {
    return no(`Could not update: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function setVenueVerifiedAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const id = text(form, "id", 64)
  const verified = form.get("verified") === "true"
  if (!isUuid(id)) return no("That venue id is not valid.")

  try {
    const before = await snapshot(id)
    if (!before) return no("That venue no longer exists.")
    await query(
      `update public.wf_venues set verified = $2, reviewed_at = now(), reviewed_by = $3, updated_at = now() where id = $1`,
      [id, verified, auth.admin.actor]
    )
    await recordAudit({
      actor: auth.admin.actor,
      action: verified ? "venue.verify" : "venue.unverify",
      targetType: "venue",
      targetId: id,
      summary: `${verified ? "Verified" : "Removed verification from"} “${before.name}”`,
      detail: { venueId: id, from: before.verified, to: verified },
    })
    refresh()
    return ok(verified ? `“${before.name}” is marked verified.` : `Verification removed from “${before.name}”.`)
  } catch (err) {
    return no(`Could not update: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Delete a venue and, by the schema's cascade, every waypoint in it.
 *
 * Guarded by typing the venue's name back. That is not theatre: this row may be
 * the only copy of a map somebody walked a hospital to build — the creator's
 * device holds an edit token, not the data — and there is no undo.
 */
export async function deleteVenueAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const id = text(form, "id", 64)
  const confirm = text(form, "confirm", 200)
  if (!isUuid(id)) return no("That venue id is not valid.")

  try {
    const before = await snapshot(id)
    if (!before) return no("That venue no longer exists.")
    if (confirm.toLowerCase() !== before.name.toLowerCase()) {
      return no(`Type the venue's name exactly — “${before.name}” — to confirm.`)
    }
    const { rows: counts } = await query<{ n: string }>(
      `select count(*) as n from public.wf_waypoints where venue_id = $1`,
      [id]
    )
    await query(`delete from public.wf_venues where id = $1`, [id])
    await recordAudit({
      actor: auth.admin.actor,
      action: "venue.delete",
      targetType: "venue",
      targetId: id,
      summary: `Deleted “${before.name}” and ${counts[0]?.n ?? 0} waypoint(s)`,
      // The whole row, because after this the audit entry is all that is left of it.
      detail: { venueId: id, deleted: before, waypoints: Number(counts[0]?.n ?? 0) },
    })
  } catch (err) {
    return no(`Could not delete: ${err instanceof Error ? err.message : String(err)}`)
  }
  redirect("/backoffice/venues?deleted=1")
}

/**
 * Mint a new edit token for a venue, invalidating the old one.
 *
 * The only lever the portal has over ownership. A venue's edit token is held by
 * whichever device created it; rotating revokes that device's ability to add
 * waypoints or delete the venue, and hands a fresh token to whoever the operator
 * gives it to. It is shown once, here, and never readable again — including by
 * this portal, which deliberately has no query that selects the column.
 */
export async function rotateVenueTokenAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const id = text(form, "id", 64)
  if (!isUuid(id)) return no("That venue id is not valid.")

  try {
    const before = await snapshot(id)
    if (!before) return no("That venue no longer exists.")
    const token = randomUUID()
    await query(`update public.wf_venues set edit_token = $2, updated_at = now() where id = $1`, [id, token])
    await recordAudit({
      actor: auth.admin.actor,
      action: "venue.rotate_token",
      targetType: "venue",
      targetId: id,
      summary: `Revoked the previous owner's edit token for “${before.name}”`,
      // Never the token itself — an audit log readable by every operator is not
      // where a live credential belongs.
      detail: { venueId: id },
    })
    refresh()
    return ok(`New edit token — copy it now, it is not shown again: ${token}`)
  } catch (err) {
    return no(`Could not rotate the token: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── Waypoints ──────────────────────────────────────────────────────────────

export async function createWaypointAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const venueId = text(form, "venueId", 64)
  const name = text(form, "name", 200)
  const type = oneOf(form, "type", WAYPOINT_TYPES) ?? "other"
  const lat = num(form, "lat")
  const lng = num(form, "lng")
  const floor = num(form, "floor") ?? 0
  const description = text(form, "description", 500)

  if (!isUuid(venueId)) return no("That venue id is not valid.")
  if (!name) return no("A place needs a name.")
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return no("Give the place a real latitude and longitude.")
  }

  try {
    const { rows } = await query<{ id: string }>(
      `insert into public.wf_waypoints (venue_id, name, type, lat, lng, floor, description)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [venueId, name, type, lat, lng, Math.trunc(floor), description || null]
    )
    await query(`update public.wf_venues set updated_at = now() where id = $1`, [venueId])
    await recordAudit({
      actor: auth.admin.actor,
      action: "waypoint.create",
      targetType: "waypoint",
      targetId: rows[0].id,
      summary: `Added “${name}” to a venue`,
      detail: { venueId, name, type, lat, lng, floor: Math.trunc(floor) },
    })
    refresh()
    return ok(`Added “${name}”.`)
  } catch (err) {
    return no(`Could not add the place: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function updateWaypointAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const id = text(form, "id", 64)
  const name = text(form, "name", 200)
  const type = oneOf(form, "type", WAYPOINT_TYPES) ?? "other"
  const lat = num(form, "lat")
  const lng = num(form, "lng")
  const floor = num(form, "floor") ?? 0
  const description = text(form, "description", 500)

  if (!isUuid(id)) return no("That place id is not valid.")
  if (!name) return no("A place needs a name.")
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return no("Give the place a real latitude and longitude.")
  }

  try {
    const { rows } = await query<{
      venue_id: string
      name: string
      type: string
      lat: number
      lng: number
      floor: number
      description: string | null
    }>(`select venue_id, name, type, lat, lng, floor, description from public.wf_waypoints where id = $1`, [id])
    const before = rows[0]
    if (!before) return no("That place no longer exists.")

    await query(
      `update public.wf_waypoints set name = $2, type = $3, lat = $4, lng = $5, floor = $6, description = $7 where id = $1`,
      [id, name, type, lat, lng, Math.trunc(floor), description || null]
    )
    await query(`update public.wf_venues set updated_at = now() where id = $1`, [before.venue_id])

    const changed = diff(before as unknown as Record<string, unknown>, {
      name,
      type,
      lat,
      lng,
      floor: Math.trunc(floor),
      description: description || null,
    })
    await recordAudit({
      actor: auth.admin.actor,
      action: "waypoint.update",
      targetType: "waypoint",
      targetId: id,
      summary: `Edited “${before.name}”`,
      detail: { venueId: before.venue_id, changed },
    })
    refresh()
    return ok(`Saved “${name}”.`)
  } catch (err) {
    return no(`Could not save: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function deleteWaypointAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const id = text(form, "id", 64)
  if (!isUuid(id)) return no("That place id is not valid.")

  try {
    const { rows } = await query<{ venue_id: string; name: string; type: string; lat: number; lng: number; floor: number }>(
      `select venue_id, name, type, lat, lng, floor from public.wf_waypoints where id = $1`,
      [id]
    )
    const before = rows[0]
    if (!before) return no("That place no longer exists.")
    await query(`delete from public.wf_waypoints where id = $1`, [id])
    await query(`update public.wf_venues set updated_at = now() where id = $1`, [before.venue_id])
    await recordAudit({
      actor: auth.admin.actor,
      action: "waypoint.delete",
      targetType: "waypoint",
      targetId: id,
      summary: `Removed “${before.name}”`,
      detail: { venueId: before.venue_id, deleted: before },
    })
    refresh()
    return ok(`Removed “${before.name}”.`)
  } catch (err) {
    return no(`Could not remove: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── Demand (search misses) ─────────────────────────────────────────────────

export async function resolveDemandAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const venueKey = text(form, "venueKey", 80)
  const q = text(form, "query", 160)
  const resolution = oneOf(form, "resolution", RESOLUTIONS)
  if (!venueKey || !q) return no("That search could not be identified.")
  if (!resolution) return no("Pick what happened to this search.")

  try {
    // Every repeat of the same search at the same venue closes together — the
    // queue is grouped that way, so resolving one row and leaving its twins open
    // would put the entry straight back on the list.
    const res = await query(
      `update public.search_misses
          set resolution = $3, resolved_at = now(), resolved_by = $4
        where venue_key = $1 and lower(query) = lower($2) and resolved_at is null`,
      [venueKey, q, resolution, auth.admin.actor]
    )
    await recordAudit({
      actor: auth.admin.actor,
      action: "demand.resolve",
      targetType: "search",
      targetId: `${venueKey}:${q.toLowerCase()}`,
      summary: `Closed “${q}” as ${resolution.replace(/_/g, " ")}`,
      detail: { venueId: venueKey, query: q, resolution, rows: res.rowCount ?? 0 },
    })
    refresh()
    return ok(`“${q}” closed.`)
  } catch (err) {
    return no(`Could not close it: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function reopenDemandAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const venueKey = text(form, "venueKey", 80)
  const q = text(form, "query", 160)
  if (!venueKey || !q) return no("That search could not be identified.")

  try {
    await query(
      `update public.search_misses
          set resolution = null, resolved_at = null, resolved_by = null
        where venue_key = $1 and lower(query) = lower($2)`,
      [venueKey, q]
    )
    await recordAudit({
      actor: auth.admin.actor,
      action: "demand.reopen",
      targetType: "search",
      targetId: `${venueKey}:${q.toLowerCase()}`,
      summary: `Reopened “${q}”`,
      detail: { venueId: venueKey, query: q },
    })
    refresh()
    return ok(`“${q}” is back on the list.`)
  } catch (err) {
    return no(`Could not reopen it: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── Retention and data-subject requests ────────────────────────────────────
//
// docs/location-data-and-gdpr.md sets out why these exist: a trail is a
// timestamped indoor path ending, in a hospital, at a department that implies a
// diagnosis, keyed to an identifier that persists for the life of a browser's
// storage. Whatever the eventual lawful basis, an operator has to be able to
// answer "delete everything you hold about this device" and "stop keeping this
// for longer than we said" — and be able to show they did.

const MIN_RETENTION_DAYS = 7

export async function purgeSignalsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const days = num(form, "days")
  if (days === null || days < MIN_RETENTION_DAYS || days > 3650) {
    return no(`Choose a cut-off between ${MIN_RETENTION_DAYS} and 3650 days.`)
  }
  const cutoff = Math.trunc(days)

  try {
    const res = await query(`delete from public.nav_signals where created_at < now() - ($1 || ' days')::interval`, [
      String(cutoff),
    ])
    const removed = res.rowCount ?? 0
    await recordAudit({
      actor: auth.admin.actor,
      action: "retention.purge_signals",
      targetType: "retention",
      summary: `Deleted ${removed} trail(s) older than ${cutoff} days`,
      detail: { days: cutoff, removed },
    })
    refresh()
    return ok(`Deleted ${removed} trail(s) older than ${cutoff} days.`)
  } catch (err) {
    return no(`Could not purge: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function purgeMissesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const days = num(form, "days")
  if (days === null || days < MIN_RETENTION_DAYS || days > 3650) {
    return no(`Choose a cut-off between ${MIN_RETENTION_DAYS} and 3650 days.`)
  }
  const cutoff = Math.trunc(days)

  try {
    const res = await query(`delete from public.search_misses where created_at < now() - ($1 || ' days')::interval`, [
      String(cutoff),
    ])
    const removed = res.rowCount ?? 0
    await recordAudit({
      actor: auth.admin.actor,
      action: "retention.purge_searches",
      targetType: "retention",
      summary: `Deleted ${removed} recorded search(es) older than ${cutoff} days`,
      detail: { days: cutoff, removed },
    })
    refresh()
    return ok(`Deleted ${removed} recorded search(es) older than ${cutoff} days.`)
  } catch (err) {
    return no(`Could not purge: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function eraseDeviceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await authorize()
  if ("error" in auth) return auth.error

  const deviceId = text(form, "deviceId", 64)
  if (!deviceId) return no("Paste the device identifier to erase.")

  try {
    const res = await query(`delete from public.nav_signals where device_id = $1`, [deviceId])
    const removed = res.rowCount ?? 0
    await recordAudit({
      actor: auth.admin.actor,
      action: "retention.erase_device",
      targetType: "device",
      // The identifier is the whole point of the record — an erasure you cannot
      // evidence against a specific request is not an erasure anyone can rely on.
      targetId: deviceId,
      summary: `Erased ${removed} trail(s) held for one device`,
      detail: { removed },
    })
    refresh()
    return removed === 0
      ? ok("Nothing was held for that device identifier.")
      : ok(`Erased ${removed} trail(s) for that device.`)
  } catch (err) {
    return no(`Could not erase: ${err instanceof Error ? err.message : String(err)}`)
  }
}
