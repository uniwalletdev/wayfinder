"use client"

import { updateVenueAction } from "@/lib/admin/actions"
import type { AdminVenue } from "@/lib/admin/types"
import { ActionForm, SubmitButton } from "./forms"
import { VENUE_CATEGORIES } from "./labels"
import { BTN_PRIMARY, INPUT, LABEL } from "./ui"

// Editing what a shared venue says about itself.
//
// The fields here are the ones a navigator sees or is moved by: the name on the
// card, the centre the map opens at, and whether the venue is offered to
// everyone. Nothing about the *content* of the map — the places inside it — is
// edited here; that is the panel below, because renaming a hospital and moving
// one of its wards are different kinds of decision and should not share a Save
// button.
//
// Visibility is the creator's setting and stays editable rather than being
// silently overridden by moderation: `status` is the operator's decision, and
// keeping the two apart means a venue can be un-hidden later without having
// forgotten that its creator asked for it to be unlisted.

const SELECT = "w-full rounded-xl border border-wf-border bg-white px-3.5 py-2.5 text-[13.5px] text-wf-ink outline-none focus:border-wf-primary"

export default function VenueEditor({ venue }: { venue: AdminVenue }) {
  return (
    <ActionForm action={updateVenueAction} hidden={{ id: venue.id }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="name">
            Name
          </label>
          <input id="name" name="name" defaultValue={venue.name} maxLength={120} required className={INPUT} />
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="subtitle">
            Subtitle <span className="font-normal text-wf-faint">— the official name, or which site this is</span>
          </label>
          <input
            id="subtitle"
            name="subtitle"
            defaultValue={venue.subtitle ?? ""}
            maxLength={200}
            className={INPUT}
            placeholder="Optional"
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="category">
            Category
          </label>
          <select id="category" name="category" defaultValue={venue.category} className={SELECT}>
            {VENUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="visibility">
            Visibility <span className="font-normal text-wf-faint">— as the creator set it</span>
          </label>
          <select id="visibility" name="visibility" defaultValue={venue.visibility} className={SELECT}>
            <option value="public">Public — listed for everyone</option>
            <option value="unlisted">Unlisted — reachable by link</option>
            <option value="private">Private — for its own people</option>
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="centerLat">
            Centre latitude
          </label>
          <input
            id="centerLat"
            name="centerLat"
            type="number"
            step="any"
            min={-90}
            max={90}
            defaultValue={venue.centerLat}
            required
            className={INPUT}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="centerLng">
            Centre longitude
          </label>
          <input
            id="centerLng"
            name="centerLng"
            type="number"
            step="any"
            min={-180}
            max={180}
            defaultValue={venue.centerLng}
            required
            className={INPUT}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="defaultZoom">
            Opening zoom <span className="font-normal text-wf-faint">— 18 is a hospital site</span>
          </label>
          <input
            id="defaultZoom"
            name="defaultZoom"
            type="number"
            min={1}
            max={22}
            step={1}
            defaultValue={venue.defaultZoom}
            required
            className={INPUT}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton className={BTN_PRIMARY} pendingLabel="Saving…">
          Save changes
        </SubmitButton>
        <p className="text-[12px] text-wf-faint">Moving the centre changes where the map opens, not where its places are.</p>
      </div>
    </ActionForm>
  )
}
