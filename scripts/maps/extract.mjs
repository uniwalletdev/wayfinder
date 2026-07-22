// Turn a sheet's text layer into grouped, filtered candidate waypoints.
//
// getTextContent hands back fragments — a multi-line label like "Oncology
// building" arrives as two stacked items. On these sheets real multi-line labels
// are centre-stacked vertically, while horizontal fragmentation is almost all
// streets/boilerplate we discard, so we stack vertically-aligned fragments into
// one label and never merge horizontally (that only ever fused unrelated
// neighbours). Then we drop everything that isn't a wayfinding destination.
// Positions are normalised to the page so they line up with the rebuilt SVG.
import { getDocument, Util } from "pdfjs-dist/legacy/build/pdf.mjs"
import { readFileSync } from "fs"

const CTRL = /[\u0000-\u001F\u007F]/g

// Some sheets set wide letter-spacing on street/title labels, so each glyph
// arrives as its own token ("M i n d e l soh n C r e s c e n t"). Collapse runs
// of single characters back into words so the street filter can see them.
function despace(s) {
  return s.replace(/\b([A-Za-z])(?: ([A-Za-z]))+\b/g, (m) => m.replace(/ /g, "")).replace(/\s+/g, " ").trim()
}
// Fraction of whitespace tokens that are a single character — high means the
// label is decorative letter-spaced text (a street/title), not a destination.
function singleCharRatio(s) {
  const toks = s.split(/\s+/)
  return toks.filter((t) => t.length === 1).length / toks.length
}

// Words that mark a label as NOT a destination. The second form (no word
// boundary before the suffix) catches letter-spaced streets that despace glued
// together, e.g. "HintleshamAvenue", "nCrescent", "hnWay".
const STREET = /\b(road|street|lane|way|avenue|drive|close|crescent|place|gardens|walk|grove|terrace|boulevard|mews|court only|park rd)\b/i
const STREET_GLUED = /(?:avenue|crescent|street|boulevard|drive)$/i
const NOISE = [
  /^please remember/i, /^site map$/i, /^key$/i, /copyright/i, /accessable/i,
  /nhs foundation trust/i, /university hospitals/i, /college healthcare/i, /^www\./i, /@/,
  /\b0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b/, /^update/i, /^correct at/i, /^tel[: ]/i,
  /^part of/i, /^for more/i, /vaccination/i, /what3words/i, /google maps/i,
  /^car park code/i, /^blue badge/i, /^zones? [a-z] to/i, /drop off points/i,
  /shopping centre$/i, /metro station/i, /^stop [a-z]{1,2}$/i, /please make sure/i,
  /magistrates court/i, /primary school/i, /^national rail/i, /^access (to|for)/i,
  /free shuttle/i, /running from/i, /when visiting/i, /post ?code/i, /sat nav/i,
  /^(ground|first|second|third|lower ground) floor$/i, /^floor \d/i, /^level \d/i,
  /^visitors? car park$/i, /^staff car park$/i, /^public car park$/i,
  // Map-key items, transport and directional notes that aren't destinations.
  /^shuttle$/i, /^taxi$/i, /^trust$/i, /^bus (route|stop)/i, /^no access/i,
  /^vehicle (access|entrance|exit)/i, /^construction zone$/i, /^practice$/i,
  /^(unit|patient|entrance|centre|hospital|building)$/i, /^ev charging/i,
  /^(accessible|visitor|disabled) parking$/i, /^pedestrian (crossing|tunnel)$/i,
  // Street abbreviations ("Enford St.", "Seymour Pl.").
  /\b(st|rd|ave|pl|ln|dr|cres|sq|gdns)\.$/i,
]
// Map furniture: zone letters, compass points, entrance numbers, floor codes.
const isFurniture = (s) =>
  /^[a-z]$/i.test(s) || /^[nsew]{1,3}$/i.test(s) || /^\d{1,3}[a-z]?$/i.test(s) ||
  /^gf$|^lg$|^[bg]\d?$/i.test(s) || /^(north|south|east|west)$/i.test(s) ||
  /^zones? [a-z]/i.test(s) || /^block [a-z]$/i.test(s) ||
  /^(cp|cv|tcp|mscp|mp)\s?\d+[a-z]?$/i.test(s) // car-park zone codes (CP2, TCP01…)

function wtype(name) {
  const n = name.toLowerCase()
  if (/\b(a&e|emergency dep|urgent (care|treatment)|utc)\b/.test(n)) return "department"
  if (/entrance|drop.?off|main door/.test(n)) return "exit"
  if (/pharmac/.test(n)) return "pharmacy"
  if (/restaurant|caf[eé]|dining|canteen|tea (bar|room)|coffee/.test(n)) return "canteen"
  if (/reception|info(rmation)? desk|main entrance/.test(n)) return "reception"
  if (/toilet|\bwc\b/.test(n)) return "toilet"
  if (/\bwards?\b/.test(n) && !/day unit|research/.test(n)) return "ward"
  if (/\blifts?\b/.test(n)) return "lift"
  if (/car park|parking/.test(n)) return "other"
  if (/clinic|imaging|x-ray|radiolog|theatre|outpatient|department|centre|center|unit|suite|medicine|radiotherapy|phlebotomy|patholog|therap|laborator|oncolog|maternit|neonat|surger|ophthal|audiolog|endoscopy|dialysis|renal|cardio|physio|building|wing|house|block|ward|lounge|hospital/.test(n)) return "department"
  return "other"
}

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
    // Trim stray leading/trailing punctuation left by split legend rows
    // ("Neonatal intensive Care -" -> "Neonatal intensive Care").
    const s = despace(l.text).replace(/^[\s\-/·|]+|[\s\-/·|]+$/g, "").trim()
    if (s.length < 3 || s.length > 58) continue
    if (/^[a-z]/.test(s)) continue // broken fragment (real labels start upper/number)
    if ((s.match(/\(/g)?.length || 0) !== (s.match(/\)/g)?.length || 0)) continue // truncated
    if (isFurniture(s)) continue
    if (STREET.test(s) || STREET_GLUED.test(s)) continue
    if (NOISE.some((re) => re.test(s))) continue
    if (!/[a-z]/i.test(s)) continue
    if (singleCharRatio(s) > 0.4) continue // residual letter-spaced decoration
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    keep.push({ text: s, nx: l.cx / W, ny: l.cy / H, type: wtype(s) })
  }
  return { labels: keep, W, H }
}

if (process.argv[1].endsWith("extract.mjs")) {
  const { labels } = await extractLabels(process.argv[2], parseInt(process.argv[3] || "1", 10))
  console.log(`${labels.length} candidate waypoints:`)
  for (const l of labels.sort((a, b) => a.ny - b.ny)) {
    console.log(`  [${l.nx.toFixed(3)},${l.ny.toFixed(3)}] (${l.type}) ${l.text}`)
  }
}
