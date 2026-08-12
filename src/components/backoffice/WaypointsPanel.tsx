"use client"

import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { createWaypointAction, deleteWaypointAction, updateWaypointAction } from "@/lib/backoffice/actions"
import type { AdminWaypoint } from "@/lib/backoffice/types"
import { ActionForm, SubmitButton } from "./forms"
import { WAYPOINT_TYPES, humanise } from "./labels"
import { BTN_PRIMARY, BTN_QUIET, INPUT, LABEL, TABLE, TABLE_SCROLL, TD, TH, formatNumber } from "./ui"

// The places inside a venue: the things people actually search for.
//
// Every row here is a destination someone can be routed to, which is why this
// panel is editable at all — a ward that moved, or a name only the porters use,
// makes the map wrong in the way that matters most, and the person who mapped it
// may be long gone (their edit token lives in one browser's storage).
//
// Only one row is a form at a time. A venue can hold up to 500 places, and 500
// simultaneous forms would be both slow and an invitation to change the wrong
// one; expanding a single row keeps each edit deliberate.

const SELECT = "w-full rounded-xl border border-wf-border bg-white px-3 py-2 text-[13px] text-wf-ink outline-none focus:border-wf-primary"
const CELL_INPUT = "w-full rounded-lg border border-wf-border bg-white px-2.5 py-1.5 text-[13px] text-wf-ink outline-none focus:border-wf-primary"

export default function WaypointsPanel({ venueId, waypoints }: { venueId: string; waypoints: AdminWaypoint[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState("")
  const [floor, setFloor] = useState<string>("all")

  const floors = useMemo(
    () => [...new Set(waypoints.map((w) => w.floor))].sort((a, b) => a - b),
    [waypoints]
  )

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return waypoints.filter((w) => {
      if (floor !== "all" && String(w.floor) !== floor) return false
      if (!needle) return true
      return w.name.toLowerCase().includes(needle) || w.type.toLowerCase().includes(needle)
    })
  }, [waypoints, filter, floor])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-wf-border-faint px-5 py-3.5">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter places…"
          aria-label="Filter places"
          className={`${INPUT} max-w-[220px] flex-1 py-2`}
        />
        {floors.length > 1 ? (
          <select value={floor} onChange={(e) => setFloor(e.target.value)} aria-label="Filter by floor" className={SELECT + " w-auto"}>
            <option value="all">Every floor</option>
            {floors.map((f) => (
              <option key={f} value={String(f)}>
                {f === 0 ? "Ground floor" : `Floor ${f}`}
              </option>
            ))}
          </select>
        ) : null}
        <p className="text-[12.5px] text-wf-muted">
          {formatNumber(shown.length)} of {formatNumber(waypoints.length)}
        </p>
        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          className={`${BTN_QUIET} ml-auto py-2`}
          aria-expanded={adding}
        >
          {adding ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
          {adding ? "Cancel" : "Add a place"}
        </button>
      </div>

      {adding ? (
        <div className="border-b border-wf-border-faint bg-wf-surface-2 px-5 py-4">
          <ActionForm action={createWaypointAction} hidden={{ venueId }}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label className={LABEL} htmlFor="new-name">
                  Name
                </label>
                <input id="new-name" name="name" required maxLength={200} className={CELL_INPUT} placeholder="e.g. Rainforest Ward" />
              </div>
              <div>
                <label className={LABEL} htmlFor="new-type">
                  Type
                </label>
                <select id="new-type" name="type" defaultValue="ward" className={SELECT}>
                  {WAYPOINT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {humanise(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="new-floor">
                  Floor
                </label>
                <input id="new-floor" name="floor" type="number" step={1} defaultValue={0} className={CELL_INPUT} />
              </div>
              <div>
                <label className={LABEL} htmlFor="new-lat">
                  Latitude
                </label>
                <input id="new-lat" name="lat" type="number" step="any" required className={CELL_INPUT} />
              </div>
              <div>
                <label className={LABEL} htmlFor="new-lng">
                  Longitude
                </label>
                <input id="new-lng" name="lng" type="number" step="any" required className={CELL_INPUT} />
              </div>
              <div className="sm:col-span-2 lg:col-span-6">
                <label className={LABEL} htmlFor="new-description">
                  Description <span className="font-normal text-wf-faint">— shown on the destination card</span>
                </label>
                <input id="new-description" name="description" maxLength={500} className={CELL_INPUT} placeholder="Optional" />
              </div>
            </div>
            <SubmitButton className={`${BTN_PRIMARY} mt-3.5`} pendingLabel="Adding…">
              Add place
            </SubmitButton>
          </ActionForm>
        </div>
      ) : null}

      {waypoints.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-wf-faint">
          Nothing has been mapped inside this venue yet — it is a pin with no destinations.
        </p>
      ) : (
        <div className={TABLE_SCROLL}>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Place</th>
                <th className={TH}>Type</th>
                <th className={`${TH} text-right`}>Floor</th>
                <th className={TH}>Position</th>
                <th className={`${TH} text-right`}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w) =>
                editing === w.id ? (
                  <tr key={w.id} className="bg-wf-surface-2">
                    <td className={TD} colSpan={5}>
                      <ActionForm action={updateWaypointAction} hidden={{ id: w.id }}>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                          <div className="lg:col-span-2">
                            <label className={LABEL} htmlFor={`name-${w.id}`}>
                              Name
                            </label>
                            <input id={`name-${w.id}`} name="name" defaultValue={w.name} required maxLength={200} className={CELL_INPUT} />
                          </div>
                          <div>
                            <label className={LABEL} htmlFor={`type-${w.id}`}>
                              Type
                            </label>
                            <select id={`type-${w.id}`} name="type" defaultValue={w.type} className={SELECT}>
                              {WAYPOINT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {humanise(t)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={LABEL} htmlFor={`floor-${w.id}`}>
                              Floor
                            </label>
                            <input id={`floor-${w.id}`} name="floor" type="number" step={1} defaultValue={w.floor} className={CELL_INPUT} />
                          </div>
                          <div>
                            <label className={LABEL} htmlFor={`lat-${w.id}`}>
                              Latitude
                            </label>
                            <input id={`lat-${w.id}`} name="lat" type="number" step="any" defaultValue={w.lat} required className={CELL_INPUT} />
                          </div>
                          <div>
                            <label className={LABEL} htmlFor={`lng-${w.id}`}>
                              Longitude
                            </label>
                            <input id={`lng-${w.id}`} name="lng" type="number" step="any" defaultValue={w.lng} required className={CELL_INPUT} />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-6">
                            <label className={LABEL} htmlFor={`description-${w.id}`}>
                              Description
                            </label>
                            <input
                              id={`description-${w.id}`}
                              name="description"
                              defaultValue={w.description ?? ""}
                              maxLength={500}
                              className={CELL_INPUT}
                            />
                          </div>
                        </div>
                        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                          <SubmitButton className={`${BTN_PRIMARY} py-2`} pendingLabel="Saving…">
                            Save
                          </SubmitButton>
                          <button type="button" onClick={() => setEditing(null)} className={`${BTN_QUIET} py-2`}>
                            Cancel
                          </button>
                        </div>
                      </ActionForm>

                      <ActionForm action={deleteWaypointAction} hidden={{ id: w.id }} className="mt-3 border-t border-wf-border pt-3">
                        <SubmitButton
                          className="text-[12.5px] font-semibold text-[#B3261E] hover:underline"
                          pendingLabel="Removing…"
                          confirm={`Remove “${w.name}”? People will no longer be able to search for it.`}
                        >
                          Remove this place
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ) : (
                  <tr key={w.id} className="transition-colors hover:bg-wf-surface-2">
                    <td className={TD}>
                      <p className="font-medium text-wf-ink">{w.name}</p>
                      {w.description ? <p className="mt-0.5 text-[11.5px] text-wf-faint">{w.description}</p> : null}
                    </td>
                    <td className={`${TD} text-wf-muted`}>{humanise(w.type)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{w.floor}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums text-wf-faint`}>
                      {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                    </td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        onClick={() => setEditing(w.id)}
                        className="text-[12.5px] font-semibold text-wf-primary hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
