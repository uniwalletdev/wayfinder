# The back office

`/admin` — where the people who run Wayfinder manage everything the app pools
from the people who use it.

The app itself is deliberately anonymous: you never sign in to find a ward, and
you never sign in to map one. That is the right trade for a navigator standing in
a hospital corridor, and it leaves a gap on the other side. A venue created
through “Map a place” is written by a stranger and offered to everyone. A search
that finds nothing is the clearest signal the map is wrong, and nobody was
reading them. A trail is a timestamped indoor path that, in a hospital, can imply
a diagnosis — and there was no way to delete one on request.

This is the other side.

---

## Getting in

The portal is **closed until it is configured**. Every other integration in this
app follows “no key → feature quietly off” (see `.env.example`); this one
inverts it, because an unconfigured back office that fell open would be an open
door onto every venue, trail and delete button in the database. With nothing set,
`/admin` renders setup instructions and authorises nobody.

Set either — or both:

| Variable | What it does |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated allowlist checked against the signed-in Clerk account. Preferred: the audit log names a person, and sign-in inherits whatever the organisation enforces. Needs Clerk configured. |
| `ADMIN_PASSWORD` | A shared secret exchanged for a signed, httpOnly, 12-hour session cookie scoped to `/admin`. For deployments with no Clerk, and for getting the first operator in today. |
| `ADMIN_SESSION_SECRET` | Optional. Signs the cookie. Without it the key is derived from `ADMIN_PASSWORD`, so changing the password ends every open session. |

Sign-in is rate limited (8 attempts per 15 minutes per caller), compared in
constant time, and a wrong password is indistinguishable from an unconfigured
deployment — the form cannot be used to discover whether `ADMIN_PASSWORD` is set.

**Authorisation is enforced twice.** The `(portal)` layout gates every screen,
and every Server Action re-checks independently: actions are ordinary POST
endpoints reachable without going through the UI, so a check in the page that
renders a form is worth nothing.

---

## The screens

| Screen | What it is for |
| --- | --- |
| **Dashboard** | Coverage, the queue, usage, and what people searched for and didn't find. The catalogue half works with no database at all. |
| **Shared venues** | The moderation queue: every venue created through the app. List / hold / hide, verify, edit, manage the places inside, reset ownership, delete. |
| **Venue catalogue** | The venues that ship with the build, as a read-only inventory — how many are genuinely navigable inside, how many are a plan with nothing named on it, how many are still a pin. |
| **Unmet searches** | Searches that returned nothing, grouped by venue and text. The shortest route to knowing what the map is missing. |
| **Navigation activity** | Trails per day, which venues are being walked, and by how many devices. |
| **Data & retention** | Purge by age, and answer an erasure request for one device identifier. |
| **Audit log** | Every change made in here, with who made it and what it replaced. Append-only. |
| **Settings & health** | Which integrations are configured (never their values), whether the database answers, the rate-limit ceilings, and the moderation mode. |

---

## Moderation

A shared venue carries two separate facts, and keeping them separate matters:

- **`visibility`** is what the *creator* asked for — public, unlisted or private.
- **`status`** is the *operator's* decision — published, pending or suppressed.

A venue is listed only when both agree. Un-hiding therefore restores what the
creator actually wanted, instead of assuming public.

| Status | Effect on someone using the app |
| --- | --- |
| `published` | Offered, as far as its own visibility allows. |
| `pending` | Not listed anywhere. Whoever created it can still open it by link. |
| `suppressed` | Not reachable at all, by link or otherwise. Reversible. |

New venues are `published` by default, which preserves exactly the behaviour the
app had before the back office existed — adding this to a running deployment
cannot silently unlist a venue somebody is in the middle of creating. Set
`WAYFINDER_VENUE_MODERATION=queue` to hold every new venue for review instead.
That is the right setting once the app is genuinely public.

**Verification** (`verified`) is a separate claim, and a stronger one: that
someone has confirmed with the organisation which owns the building that the map
is theirs and is right. It cannot be set by any request to the public API — only
from here.

**Ownership.** A venue is owned by whichever device created it, through an
`edit_token` held in that browser's storage. The portal can *rotate* that token —
revoking the old device and handing you a replacement, shown once — but it can
never display the current one. No query in `src/lib/admin/` selects the column.

---

## Data protection

`docs/location-data-and-gdpr.md` is the analysis; this is the tooling for it.

- **Retention.** Purge trails or recorded searches older than a chosen number of
  days. Both are exact counts, both are audited.
- **Erasure.** Look up everything held for one device identifier — the random id
  the app mints into `localStorage` under `wayfinder.deviceId` — and delete it.
  Searches carry no device id, so they cannot be tied to a person and are not
  included; say so when answering a subject access request rather than implying
  the list is everything.

Every use of both is written to the audit log with its count, which is what makes
an erasure evidenceable after the rows are gone.

---

## How it is built

```
src/lib/admin/
  auth.ts        who is allowed in, and how it is proved
  data.ts        every read, as one Data Access Layer — no SQL lives in a page
  actions.ts     every write, each re-authorising and each audited
  audit.ts       the append-only record, plus the before/after differ
  catalog.ts     coverage statistics over the venues that ship with the build
  moderation.ts  whether new venues are listed immediately or held
  types.ts       the shapes the portal renders

src/app/admin/
  login/         sign-in — OUTSIDE the gated group, or it would redirect to itself
  (portal)/      every gated screen, behind one layout that checks first

src/components/admin/   the shell, the primitives, the charts, the forms
db/migrations/0004_admin.sql   moderation columns, resolution columns, audit table
```

Notes worth knowing before changing it:

- **Reads never throw at a page.** Every function in `data.ts` returns a
  `Result`, so “the database is down” renders as a message rather than a stack
  trace. An operator's first question during an outage is whether the database is
  up, and a portal that 500s cannot answer it.
- **The schema is applied automatically** by `src/lib/db.ts` on first use, and
  mirrored in `db/migrations/` for ops. The two must stay in step.
- **No chart library.** The four chart forms are a handful of divs and one small
  SVG (`src/components/admin/charts.tsx`).
- **Filters live in the URL.** A queue someone is working through can be
  bookmarked, shared and reloaded without losing their place.
