// Where browsers send Content-Security-Policy violation reports.
//
// The policy is REPORT-ONLY (next.config.ts): nothing is blocked yet. A
// source-list policy written without exercising every third party against a
// live deployment — Clerk's per-deployment domains above all — is far more
// likely to break sign-in or the map than to stop an attack, and it would fail
// silently. So the browser is asked to report what it would have blocked, this
// route writes each report to the server log, and the policy is tightened or
// enforced once the log has been quiet for a while.
//
// Reports are untrusted input from anyone on the internet: capped, rate
// limited, never stored, never echoed back.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { rateLimit, readCappedJson, LIMITS, BODY_LIMITS } from "@/lib/rate-limit"

interface CspReport {
  "csp-report"?: Record<string, unknown>
  body?: Record<string, unknown>
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "csp-report", LIMITS.cspReport.limit, LIMITS.cspReport.windowMs)
  if (limited) return limited

  const read = await readCappedJson<CspReport | CspReport[]>(request, BODY_LIMITS.cspReport)
  if (read.ok) {
    // Two formats are in the wild: the legacy `csp-report` wrapper (report-uri)
    // and the Reporting API's array of {type, body} (report-to).
    const items = Array.isArray(read.body) ? read.body : [read.body]
    for (const item of items) {
      const r = (item && (item["csp-report"] ?? item.body)) as Record<string, unknown> | undefined
      if (!r) continue
      const directive = r["violated-directive"] ?? r["effectiveDirective"] ?? r["effective-directive"]
      const blocked = r["blocked-uri"] ?? r["blockedURL"]
      const doc = r["document-uri"] ?? r["documentURL"]
      console.warn(`[csp] ${String(directive)} blocked ${String(blocked)} on ${String(doc)}`.slice(0, 500))
    }
  }
  return new Response(null, { status: 204 })
}
