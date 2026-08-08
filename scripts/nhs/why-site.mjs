// Show what draft-sheets can actually see when it matches a sheet to a hospital.
//
// Rejections name a hospital the trust supposedly doesn't have — "Princess Anne
// Hospital" is not a site of RHM — while build-sites cheerfully prints that same
// hospital somewhere in its output. Both can be true at once, for three separate
// reasons, and the reject line cannot tell them apart:
//
//   1. looksLikeHospital dropped it. That test is /\b(hospital|infirmary)\b/,
//      and the Nuffield Orthopaedic CENTRE is a hospital whose name never says
//      so. Invisible to the matcher, present in the register.
//   2. ODS files it under a different trust. Pilgrim and Lincoln County are
//      United Lincolnshire hospitals; if the register puts them elsewhere, a
//      sheet crawled from the ULHT website has no way to reach them.
//   3. The name really is spelled differently — Gloucester Royal, not
//      Gloucestershire Royal.
//
// Run: node scripts/nhs/why-site.mjs RTH
//      node scripts/nhs/why-site.mjs --name "Princess Anne"
import { looksLikeHospital } from "./lib/ods.mjs"
import { dataPath, readJson, log } from "./lib/paths.mjs"

const STAGE = "why-site"
const args = process.argv.slice(2)
const nameFlag = args.indexOf("--name")
const wantedName = nameFlag >= 0 ? args[nameFlag + 1] : null
const trustCode = args.find((a) => !a.startsWith("--") && a !== wantedName)?.toUpperCase()

const sitesDoc = readJson(dataPath("nhs-sites.json"))
if (!sitesDoc) {
  console.error(`[${STAGE}] missing data/nhs-sites.json — run: npm run nhs:build`)
  process.exit(1)
}

if (!trustCode && !wantedName) {
  console.error(`[${STAGE}] usage: node scripts/nhs/why-site.mjs <TRUSTCODE>`)
  console.error(`[${STAGE}]        node scripts/nhs/why-site.mjs --name "Princess Anne"`)
  process.exit(1)
}

// Which trust files a hospital, wherever it lives. This is the question the
// reject line cannot answer: the sheet knows its own trust, and if ODS disagrees
// the match is unwinnable no matter how the matcher is tuned.
if (wantedName) {
  const needle = wantedName.toLowerCase()
  const hits = sitesDoc.sites.filter((s) => String(s.name).toLowerCase().includes(needle))
  log(STAGE, `"${wantedName}" — ${hits.length} site(s) in the register`)
  for (const s of hits) {
    log(STAGE, `  ${s.trustCode ?? "(no trust)"}  ${s.name}${looksLikeHospital(s.name) ? "" : "   <- looksLikeHospital says no"}`)
  }
  if (!hits.length) log(STAGE, "  nothing — the register really does not carry that name")
}

if (trustCode) {
  const sites = sitesDoc.sites.filter((s) => s.trustCode === trustCode)
  if (!sites.length) {
    log(STAGE, `${trustCode} has no sites at all — check the code`)
  } else {
    const visible = sites.filter((s) => looksLikeHospital(s.name))
    const hidden = sites.filter((s) => !looksLikeHospital(s.name))
    log(STAGE, `${trustCode}: ${sites.length} site(s), ${visible.length} visible to the name matcher`)
    log(STAGE, "")
    log(STAGE, `what draft-sheets matches against (${visible.length}):`)
    for (const s of visible) log(STAGE, `  ${s.name}`)
    // The interesting half. A hospital in here can never win a name match, no
    // matter how well the sheet names it.
    log(STAGE, "")
    log(STAGE, `dropped by looksLikeHospital — no "hospital" or "infirmary" in the name (${hidden.length}):`)
    for (const s of hidden.slice(0, 40)) log(STAGE, `  ${s.name}`)
    if (hidden.length > 40) log(STAGE, `  ... and ${hidden.length - 40} more`)
  }
}
