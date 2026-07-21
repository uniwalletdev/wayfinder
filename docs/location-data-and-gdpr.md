# Location data: what Wayfinder collects, and the gaps

**Status: for decision, not a bug report.** Nothing here is an attack path. It is a
data-protection exposure that needs a product/legal answer — ideally with a DPO or the
partner trust — before Wayfinder is deployed into an NHS setting at scale.

Written 2026-07-21 during a security review. No behaviour was changed.

---

## What is collected today

### 1. Indoor location traces — `POST /api/signals`

Every routed walk emits the path actually taken.

| | |
|---|---|
| Route | `src/app/api/signals/route.ts` |
| Table | `nav_signals` (`src/lib/db.ts:101-112`, `db/migrations/0001_nav_signals.sql`) |
| Payload | up to **400 GPS points** per trail (`MAX_TRAIL_POINTS`, `signals/route.ts:20`) |
| Stored | `venue_id`, `device_id`, `kind`, `floor`, `{ points }` as jsonb, `created_at` |
| Identifier | `device_id` — see below |

### 2. Free-text search queries — `POST /api/search-misses`

Every search that returns nothing.

| | |
|---|---|
| Route | `src/app/api/search-misses/route.ts` |
| Table | `search_misses` (`src/lib/db.ts:116-124`) |
| Stored | `venue_id`, the raw query string (capped at 160 chars), whether a suggestion was shown |

### 3. The device identifier

`src/lib/device-id.ts` mints a `crypto.randomUUID()` into `localStorage` under
`wayfinder.deviceId` and reuses it indefinitely. Its comment argues this is not PII:

> "It identifies a browser, not a person: no account, no PII, and it resets if storage is
> cleared, which is fine — the only thing it's used for is de-duplicating agreement."

That reasoning is sound for its **purpose** (counting independent devices so one phone
cannot move a pin on its own) but it does not follow that the resulting data is
non-personal.

---

## Why this is likely personal data under UK GDPR

A stable pseudonymous identifier joined to timestamped indoor location traces is personal
data. Recital 26 turns on whether a person is *identifiable*, directly or indirectly — and
pseudonymised data explicitly remains in scope (Art. 4(5)).

The sharper issue is **special category data (Art. 9)**. In a hospital, the destination is
the message. A trail that terminates at an oncology ward, a sexual-health clinic, or
maternity is a health inference about an identifiable device — and inferred health data is
still health data. Wayfinder's own GOSH map makes ward-level destinations explicit, which
is exactly what makes the traces revealing.

Search misses compound it: users may type a clinician's name, a relative's name, or a
condition.

---

## The gaps

1. **No consent gate.** Collection starts on first use. For special-category data the
   lawful basis has to be explicit — Art. 9(2) — and legitimate interests is not
   available.
2. **No retention limit.** Neither table has a TTL or a cleanup job. Rows persist
   indefinitely (Art. 5(1)(e) storage limitation).
3. **No deletion path.** No endpoint, and no UI, lets someone erase their device's history
   (Art. 17). Clearing `localStorage` orphans the id — it does not delete server rows, and
   afterwards the user can no longer even identify which rows were theirs.
4. **No privacy notice.** Nothing tells users any of this happens (Arts. 13-14).
5. **No DPIA.** Large-scale processing of health-adjacent data in a public setting is the
   textbook Art. 35 trigger.
6. **Unauthenticated ingest.** `/api/signals` and `/api/search-misses` have no rate limit,
   so the tables can also be inflated by a third party.

---

## Options

Roughly in increasing order of effort. Not mutually exclusive.

**A. Retention window** — a scheduled `delete from nav_signals where created_at < now() -
interval '30 days'`. Cheapest meaningful reduction: aggregation that promotes a correction
has already happened long before 30 days. Addresses gap 2.

**B. Deletion endpoint** — `DELETE /api/signals?deviceId=…` plus a control in the UI.
Addresses gap 3. Cheap, and it is the one a user is most likely to ask for.

**C. Truncate on ingest** — store the trail at reduced precision, or drop the final N
points so the destination itself is not recorded. Directly weakens the health inference
while keeping the corridor-correction value, which is the actual purpose.

**D. Consent gate** — an explicit opt-in before the first signal is sent, defaulting to
off. Addresses gap 1 and is the only thing that makes an Art. 9 basis defensible. Costs
data volume, which is the real tension: the aggregation needs many independent devices.

**E. Privacy notice + DPIA** — documentation, not code. Addresses gaps 4 and 5, and would
normally be a precondition of a trust deployment.

**F. Rate-limit the ingest routes** — reuse `rateLimit()` from `src/lib/rate-limit.ts`.
Addresses gap 6. Small, and consistent with what the other routes now do.

---

## Recommendation

If only one thing is done, do **A** (retention). It is a few lines, needs no product
decision, and converts an indefinite accumulation into a bounded one.

**B** and **F** are both small and independently worthwhile.

**D** is the one that genuinely needs a decision rather than an implementation, because it
trades data quality against lawful basis — and that trade is not mine to make.

Before any real NHS deployment, **E** is not optional.
