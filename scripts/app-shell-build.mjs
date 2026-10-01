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
//   FINDWAY_API_URL=https://your-deployment node scripts/app-shell-build.mjs
//
// Output: out/, which capacitor.config.ts points at. FINDWAY_SITE_URL, if set,
// is the origin shared links are written on; it defaults to the API URL.
import { existsSync, mkdirSync, renameSync, rmSync } from "fs"
import { spawnSync } from "child_process"
import { createRequire } from "module"

const apiUrl = process.env.FINDWAY_API_URL?.trim().replace(/\/+$/, "")
if (!apiUrl || !/^https:\/\/[^/\s]+/.test(apiUrl)) {
  console.error(
    "FINDWAY_API_URL must be the https origin the apps should call, e.g. FINDWAY_API_URL=https://wayfinder-theta.vercel.app"
  )
  process.exit(1)
}
const siteUrl = process.env.FINDWAY_SITE_URL?.trim().replace(/\/+$/, "") || apiUrl

const HOLD = ".app-shell-excluded"
const MOVES = [
  ["src/app/api", `${HOLD}/api`],
  ["src/proxy.ts", `${HOLD}/proxy.ts`],
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
