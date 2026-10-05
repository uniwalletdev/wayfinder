// Checks the back office's same-site rule for changes (src/lib/backoffice/
// origin.ts): the Origin must name the host the browser asked for — behind a
// proxy, the forwarded one — and without an Origin only the browser's own
// Sec-Fetch-Site: same-origin will do.
//
// Run: node scripts/lib-test/backoffice-origin.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { sameOrigin } = await import(fileURLToPath(new URL("backoffice/origin.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

const h = (o) => new Headers(o)

group("sameOrigin")
{
  check("same host", sameOrigin(h({ host: "findway.example", origin: "https://findway.example" })))
  check("case does not matter", sameOrigin(h({ host: "Findway.Example", origin: "https://findway.example" })))
  check("ports must match", sameOrigin(h({ host: "localhost:3000", origin: "http://localhost:3000" })) && !sameOrigin(h({ host: "localhost:3000", origin: "http://localhost:4000" })))
  check("behind a proxy, the forwarded host counts", sameOrigin(h({ host: "localhost:3000", "x-forwarded-host": "findway.example", origin: "https://findway.example" })))
  check("the first of several forwarded hosts", sameOrigin(h({ host: "10.0.0.2", "x-forwarded-host": "findway.example, edge.internal", origin: "https://findway.example" })))
  check("another site is refused", !sameOrigin(h({ host: "findway.example", origin: "https://evil.example" })))
  check("a look-alike is refused", !sameOrigin(h({ host: "findway.example", origin: "https://findway.example.evil.io" })))
  check("a garbage Origin is refused", !sameOrigin(h({ host: "findway.example", origin: "null" })))
  check("no Origin, but the browser says same-origin", sameOrigin(h({ host: "findway.example", "sec-fetch-site": "same-origin" })))
  check("no Origin and cross-site is refused", !sameOrigin(h({ host: "findway.example", "sec-fetch-site": "cross-site" })))
  check("no Origin and no Sec-Fetch-Site is refused", !sameOrigin(h({ host: "findway.example" })))
  check("no host at all is refused", !sameOrigin(h({ origin: "https://findway.example" })))
}

report()
