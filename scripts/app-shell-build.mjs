// Build the interface the Android and iOS apps carry inside them.
//
// The website is one Next.js project: pages, /api route handlers and the Clerk
// proxy. The apps cannot run a server, so they take a static export of the
// pages and call /api on a deployment instead. Next refuses to export a project
// that still contains Request-driven route handlers or a proxy file, so for the
// length of the build those two are moved out of src/ and put back afterwards,
// whatever happens. Nothing else about the source changes, and the web build
// (`next build` with no APP_SHELL) is untouched.
//
//   npm run mobile:build
//
// Output: out/, which capacitor.config.ts points at. The apps call the
// production site unless FINDWAY_API_URL names another deployment;
// FINDWAY_SITE_URL, if set, is the origin shared links are written on and
// defaults to the API URL.
import { existsSync, mkdirSync, renameSync, rmSync } from "fs"
import { spawnSync } from "child_process"
import { createRequire } from "module"

// The production site. A build with no FINDWAY_API_URL calls this, so
// `npm run mobile:build` works on a fresh checkout on any OS; set the variable
// to point a build at a preview or another deployment.
const DEFAULT_API_URL = "https://wayfinder-theta.vercel.app"

const explicitApiUrl = process.env.FINDWAY_API_URL?.trim()
const apiUrl = (explicitApiUrl || DEFAULT_API_URL).replace(/\/+$/, "")
if (!/^https:\/\/[^/\s]+/.test(apiUrl)) {
  console.error(`FINDWAY_API_URL must be an https origin, e.g. ${DEFAULT_API_URL}; got "${explicitApiUrl}"`)
  process.exit(1)
}
if (!explicitApiUrl) console.log(`FINDWAY_API_URL is not set; the apps will call ${DEFAULT_API_URL}`)
const siteUrl = process.env.FINDWAY_SITE_URL?.trim().replace(/\/+$/, "") || apiUrl

const HOLD = ".app-shell-excluded"
// The back office (and /coverage, which leads into it) and the hospitals'
// sign-up and account pages need a server and a signed-in person: web only,
// like the API.
const MOVES = [
  ["src/app/api", `${HOLD}/api`],
  ["src/proxy.ts", `${HOLD}/proxy.ts`],
  ["src/app/admin", `${HOLD}/admin`],
  ["src/app/coverage", `${HOLD}/coverage`],
  ["src/app/for-hospitals", `${HOLD}/for-hospitals`],
]
mkdirSync(HOLD, { recursive: true })

// A run that was killed mid-build leaves the files in the holding directory.
const restore = () => {
  for (const [src, held] of MOVES) if (existsSync(held) && !existsSync(src)) renameSync(held, src)
}
restore()
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    restore()
    process.exit(1)
  })
}

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next")
let status = 1
try {
  for (const [src, held] of MOVES) renameSync(src, held)
  rmSync("out", { recursive: true, force: true })
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      APP_SHELL: "1",
      NEXT_PUBLIC_APP_SHELL: "1",
      NEXT_PUBLIC_API_BASE: apiUrl,
      NEXT_PUBLIC_SITE_URL: siteUrl,
      // Sign-in stays on the web for now: the proxy Clerk needs is exactly
      // what an export cannot carry, so the provider is left unmounted.
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
    },
  })
  status = result.status ?? 1
} finally {
  restore()
}
if (status !== 0) process.exit(status)
if (!existsSync("out/index.html")) {
  console.error("next build finished but produced no out/index.html")
  process.exit(1)
}
console.log(`\nApp shell built in out/: calls ${apiUrl}/api, shares links on ${siteUrl}`)
