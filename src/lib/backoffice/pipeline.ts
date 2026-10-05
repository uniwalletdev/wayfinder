import "server-only"

// The GitHub Actions workflows that keep Findway's data and apps up to date,
// read from GitHub's API for the System page. The repository is public, so
// reading needs no token; GITHUB_DISPATCH_TOKEN (a fine-grained token with
// Actions: read and write on this repository) additionally lets an admin start
// a data refresh from the back office.

export const REPOSITORY =
  process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : process.env.GITHUB_REPOSITORY || "uniwalletdev/wayfinder"

export const WORKFLOWS = [
  { file: "world-data.yml", name: "World hospital data" },
  { file: "mobile.yml", name: "Mobile apps" },
  { file: "ci.yml", name: "CI" },
] as const

export interface WorkflowRun {
  number: number
  status: string
  conclusion: string | null
  event: string
  branch: string
  title: string
  createdAt: string
  updatedAt: string
  url: string
}

const token = () => process.env.GITHUB_DISPATCH_TOKEN?.trim() || ""
export const canDispatch = () => token().length > 0

const headers = (auth: boolean): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "findway-backoffice",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(auth && token() ? { Authorization: `Bearer ${token()}` } : {}),
})

// GitHub allows 60 unauthenticated requests an hour per address, shared on a
// serverless host, so answers are kept for two minutes per instance.
const cache = new Map<string, { at: number; runs: WorkflowRun[] }>()
const TTL_MS = 120_000

export async function recentRuns(file: string, n = 5): Promise<{ runs: WorkflowRun[]; error?: string }> {
  const hit = cache.get(file)
  if (hit && Date.now() - hit.at < TTL_MS) return { runs: hit.runs }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/${file}/runs?per_page=${n}`, {
      headers: headers(true),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { runs: hit?.runs ?? [], error: `GitHub answered ${res.status}` }
    const data = (await res.json()) as { workflow_runs?: Record<string, unknown>[] }
    const runs = (data.workflow_runs ?? []).map((r) => ({
      number: Number(r.run_number),
      status: String(r.status),
      conclusion: (r.conclusion as string | null) ?? null,
      event: String(r.event),
      branch: String(r.head_branch),
      title: String(r.display_title ?? r.name ?? ""),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      url: String(r.html_url),
    }))
    cache.set(file, { at: Date.now(), runs })
    return { runs }
  } catch (err) {
    return { runs: hit?.runs ?? [], error: err instanceof Error ? err.message.slice(0, 120) : "unreachable" }
  }
}

// "ALL", or ISO codes separated by commas.
export function parseCountries(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim().toUpperCase()
  if (s === "ALL") return s
  const codes = s.split(/[\s,]+/).filter(Boolean)
  if (!codes.length || codes.length > 60 || !codes.every((c) => /^[A-Z]{2}$/.test(c))) return null
  return [...new Set(codes)].join(",")
}

export async function startDataRefresh(countries: string): Promise<{ ok: boolean; error?: string }> {
  if (!canDispatch()) return { ok: false, error: "not_configured" }
  const res = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/world-data.yml/dispatches`, {
    method: "POST",
    headers: { ...headers(true), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { countries } }),
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 204) {
    cache.delete("world-data.yml")
    return { ok: true }
  }
  return { ok: false, error: `GitHub answered ${res.status}` }
}

export function workflowUrl(file: string): string {
  return `https://github.com/${REPOSITORY}/actions/workflows/${file}`
}
