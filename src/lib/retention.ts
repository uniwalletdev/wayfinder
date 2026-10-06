import { isDatabaseConfigured, query } from "./db"

// Storage limitation for the pooled usage data (docs/location-data-and-gdpr.md,
// option A). A corridor trace has done its work — been counted towards a map
// correction — long before a month is out, and a search miss is stale after a
// quarter; keeping either for ever turned a bounded purpose into an indefinite
// record of where devices went and what people typed. Reports and support
// messages, which can carry an email address, are bounded the same way.
//
// There is no scheduler in this deployment model, so the sweep piggybacks on
// the ingest routes: at most once an hour per server process, fire-and-forget,
// never in the caller's way.

export const SIGNAL_RETENTION_DAYS = 30
export const SEARCH_MISS_RETENTION_DAYS = 90
// Reports and support messages: kept while staff deal with them, then for
// half a year after (so a repeat report can be seen against the last one),
// and never more than a year in all.
export const FEEDBACK_RESOLVED_RETENTION_DAYS = 180
export const FEEDBACK_MAX_RETENTION_DAYS = 365
const SWEEP_INTERVAL_MS = 60 * 60 * 1000

let lastSweep = 0

export function sweepExpiredData(): void {
  if (!isDatabaseConfigured()) return
  const now = Date.now()
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  void (async () => {
    try {
      await query(`delete from public.nav_signals where created_at < now() - ($1 || ' days')::interval`, [String(SIGNAL_RETENTION_DAYS)])
      await query(`delete from public.search_misses where created_at < now() - ($1 || ' days')::interval`, [String(SEARCH_MISS_RETENTION_DAYS)])
      await query(
        `delete from public.feedback
          where resolved_at < now() - ($1 || ' days')::interval or created_at < now() - ($2 || ' days')::interval`,
        [String(FEEDBACK_RESOLVED_RETENTION_DAYS), String(FEEDBACK_MAX_RETENTION_DAYS)]
      )
    } catch (err) {
      // A failed sweep is retried next hour; it must never affect the request
      // that triggered it.
      console.warn("Retention sweep failed:", err instanceof Error ? err.message : err)
    }
  })()
}
