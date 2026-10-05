// The deployment: which integrations are switched on (never their values), the
// database's health, and the workflows that refresh the data and build the apps.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { requireStaff, clerkConfigured, ownerEmails } from "@/lib/backoffice/staff"
import { databaseHealth } from "@/lib/backoffice/data"
import { recentRuns, WORKFLOWS, workflowUrl, canDispatch, REPOSITORY } from "@/lib/backoffice/pipeline"
import { ok } from "@/lib/backoffice/http"

export async function GET(request: Request) {
  const { response } = await requireStaff(request, "system.view")
  if (response) return response
  const [database, ...workflows] = await Promise.all([
    databaseHealth(),
    ...WORKFLOWS.map(async (w) => ({ ...w, url: workflowUrl(w.file), ...(await recentRuns(w.file)) })),
  ])
  return ok({
    database,
    integrations: {
      accounts: clerkConfigured(),
      ownerEmails: ownerEmails().length,
      outdoorRouting: !!process.env.MAPBOX_ACCESS_TOKEN,
      signReading: !!process.env.ANTHROPIC_API_KEY,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
      dataRefreshFromHere: canDispatch(),
    },
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
      repository: REPOSITORY,
    },
    workflows,
  })
}
