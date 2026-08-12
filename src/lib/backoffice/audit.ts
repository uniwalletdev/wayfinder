import "server-only"

import { isDatabaseConfigured, query } from "@/lib/db"

// The record of what administrators did.
//
// Every mutation in the back office writes one row here before it returns. That
// is not bureaucracy: the portal can suppress a venue somebody mapped, rewrite
// the name shown to patients, revoke a mapper's ownership of their own work and
// delete a hospital's map outright. Each of those is a decision someone may have
// to justify later — to the person whose work it was, to a partner trust, or to
// whoever is asking why a ward vanished from the app.
//
// It is append-only. Nothing in this file updates or deletes, and no screen
// offers to. A log an operator can edit is not evidence of anything.

export interface AuditInput {
  actor: string
  action: string
  targetType?: string
  targetId?: string
  summary: string
  detail?: Record<string, unknown>
}

/**
 * Write an audit row. Never throws: a failure to log must not roll back the
 * action the operator already performed (that would leave the portal claiming
 * the work failed when it succeeded), so it is reported to the server log and
 * the mutation stands.
 */
export async function recordAudit(entry: AuditInput): Promise<void> {
  if (!isDatabaseConfigured()) return
  try {
    await query(
      `insert into public.wf_admin_audit (actor, action, target_type, target_id, summary, detail)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        entry.actor.slice(0, 200),
        entry.action.slice(0, 60),
        entry.targetType ?? null,
        entry.targetId ?? null,
        entry.summary.slice(0, 500),
        JSON.stringify(entry.detail ?? {}),
      ]
    )
  } catch (err) {
    console.warn("[admin] could not write audit entry:", err instanceof Error ? err.message : err)
  }
}

/**
 * The before/after of a field change, in the shape the audit detail column and
 * the audit table's expander both expect. Only fields that actually moved are
 * included, so "renamed a venue" doesn't record the eleven columns that stayed
 * the same.
 */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, unknown> {
  const changed: Record<string, unknown> = {}
  for (const [key, next] of Object.entries(after)) {
    if (next === undefined) continue
    const prev = before[key as keyof T]
    if (prev === next) continue
    changed[key] = { from: prev ?? null, to: next ?? null }
  }
  return changed
}
