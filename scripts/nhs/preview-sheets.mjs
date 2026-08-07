// Render each auto-generated sheet to a small raster image for review.
//
// Nothing in the pipeline can tell whether a sheet is *well placed* — that
// judgement needs someone looking at the map. The rest of the data is committed
// so it can be reviewed in a diff; these previews exist so the sheets can be too.
//
// JPEG rather than PNG, and modest width, because these are committed: a few
// dozen full-size PNG site plans would add tens of megabytes to the repo for
// images whose only job is to be glanced at.
//
// Run: node scripts/nhs/preview-sheets.mjs
import { existsSync, readFileSync } from "fs"
import sharp from "sharp"
import { dataPath, repoPath, readJson, writeJson, ensureDir, log } from "./lib/paths.mjs"
import { join } from "path"

const STAGE = "preview-sheets"
const WIDTH = 1100
const QUALITY = 78

const sheetsDoc = readJson(dataPath("mapped-sites.json"))
if (!sheetsDoc) {
  console.error(`[${STAGE}] missing data/mapped-sites.json`)
  process.exit(1)
}

const outDir = ensureDir(dataPath("previews"))
const auto = sheetsDoc.sheets.filter((s) => s.auto)
const index = []

for (const sheet of auto) {
  const svgPath = repoPath("public", "floorplans", sheet.slug, "sitemap.svg")
  if (!existsSync(svgPath)) {
    log(STAGE, `  skipping ${sheet.slug} — no rendered sheet yet (run generate-all.mjs)`)
    continue
  }
  try {
    await sharp(readFileSync(svgPath))
      .resize({ width: WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toFile(join(outDir, `${sheet.slug}.jpg`))
    index.push({
      slug: sheet.slug,
      name: sheet.name,
      preview: `data/previews/${sheet.slug}.jpg`,
      center: sheet.center,
      spanM: sheet.spanM,
      spanSource: sheet.auto.spanSource,
      labels: sheet.auto.labels,
      sourceUrl: sheet.auto.sourceUrl,
    })
    log(STAGE, `  ${sheet.slug}.jpg`)
  } catch (err) {
    log(STAGE, `  FAILED ${sheet.slug}: ${err.message}`)
  }
}

// A manifest so a reviewer (or a later pass) can go straight to the sheets whose
// scale was guessed rather than measured — those are the ones most likely wrong.
writeJson(dataPath("previews", "index.json"), {
  generatedAt: new Date().toISOString(),
  description:
    "Rendered previews of auto-generated sheet venues. Check that each is the right hospital at a plausible scale; " +
    "correct spanM (and the plan crop, to exclude a sheet's directory table or key) in data/mapped-sites.json, " +
    "then re-run build-venues.mjs. Entries with spanSource 'default' had no OpenStreetMap footprint to measure and " +
    "are the likeliest to be mis-scaled.",
  count: index.length,
  needsScaleCheck: index.filter((i) => i.spanSource === "default").length,
  sheets: index,
})

log(STAGE, `${index.length} preview(s) written to data/previews/`)
log(STAGE, `${index.filter((i) => i.spanSource === "default").length} used a default scale and need checking first`)
