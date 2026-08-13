// Turn a sheet's text layer into grouped, filtered candidate waypoints.
//
// getTextContent hands back fragments — a multi-line label like "Oncology
// building" arrives as two stacked items. On these sheets real multi-line labels
// are centre-stacked vertically, while horizontal fragmentation is almost all
// streets/boilerplate we discard, so we stack vertically-aligned fragments into
// one label and never merge horizontally (that only ever fused unrelated
// neighbours). Then we drop everything that isn't a wayfinding destination.
// Positions are normalised to the page so they line up with the rebuilt SVG.
//
// The naming and filtering rules live in ./lib/labels.mjs so they can be unit
// tested — this module can only be imported with pdfjs and a real PDF present,
// which is why the rules went untested long enough to ship a font-decoding
// failure as a waypoint name.
import { getDocument, Util } from "pdfjs-dist/legacy/build/pdf.mjs"
import { readFileSync } from "fs"
import { cleanLabel } from "./lib/labels.mjs"

const CTRL = /[\u0000-\u001F\u007F]/g

export async function extractLabels(file, pageNum) {
  const data = new Uint8Array(readFileSync(file))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const page = await doc.getPage(pageNum)
  const vp = page.getViewport({ scale: 1 })
  const W = vp.width, H = vp.height
  const tc = await page.getTextContent()

  const frags = []
  for (const it of tc.items) {
    const str = it.str.replace(CTRL, "").trim()
    if (!str) continue
    const t = Util.transform(vp.transform, it.transform)
    const fs = Math.hypot(t[0], t[1]) || Math.hypot(t[2], t[3])
    if (fs < 4) continue // ignore micro text (legend footnotes)
    // `ord` preserves PDF content order, which is the sheet's reading order —
    // the only reliable line order for rotated/isometric building labels, where
    // sorting by y/x reverses the words.
    frags.push({ text: str, cx: t[4] + (it.width || 0) / 2, y: t[5], fs, ord: frags.length })
  }

  // Stack vertically-adjacent fragments whose x-centres line up into one label.
  frags.sort((a, b) => (a.y - b.y) || (a.cx - b.cx))
  const used = new Array(frags.length).fill(false)
  const labels = []
  for (let i = 0; i < frags.length; i++) {
    if (used[i]) continue
    const grp = [frags[i]]; used[i] = true
    let changed = true
    while (changed) {
      changed = false
      const g = grp[grp.length - 1]
      for (let j = 0; j < frags.length; j++) {
        if (used[j]) continue
        const dy = frags[j].y - g.y
        if (dy > 0 && dy < g.fs * 1.45 && Math.abs(frags[j].cx - g.cx) < g.fs * 2.5 && Math.abs(frags[j].fs - g.fs) < 2) {
          grp.push(frags[j]); used[j] = true; changed = true; break
        }
      }
    }
    grp.sort((a, b) => a.ord - b.ord) // join in the sheet's reading order
    const text = grp.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim()
    const cx = grp.reduce((s, l) => s + l.cx, 0) / grp.length
    const cy = (grp[0].y + grp[grp.length - 1].y) / 2 - grp[0].fs * 0.35
    labels.push({ text, cx, cy, fs: grp[0].fs })
  }

  // Filter to destinations.
  const keep = []
  const seen = new Set()
  for (const l of labels) {
    const clean = cleanLabel(l.text)
    if (!clean) continue
    const key = clean.text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    keep.push({
      text: clean.text,
      nx: l.cx / W,
      ny: l.cy / H,
      type: clean.type,
      // Set when the sheet wrote the storey into the label itself, e.g.
      // "Allebone (Second Floor)" on a single-sheet ward directory.
      floorFromLabel: clean.floorFromLabel,
      storeyLabel: clean.storeyLabel,
    })
  }
  return { labels: keep, W, H }
}

if (process.argv[1]?.endsWith("extract.mjs")) {
  const { labels } = await extractLabels(process.argv[2], parseInt(process.argv[3] || "1", 10))
  console.log(`${labels.length} candidate waypoints:`)
  for (const l of labels.sort((a, b) => a.ny - b.ny)) {
    console.log(`  [${l.nx.toFixed(3)},${l.ny.toFixed(3)}] (${l.type}) ${l.text}`)
  }
}
