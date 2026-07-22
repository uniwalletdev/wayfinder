// PDF page -> SVG vector reconstruction, using pdfjs-dist's operator list.
//
// This box has no poppler/canvas, so we can't raster-render the trust sheets the
// way the older floor-plan SVGs were produced. Instead we walk the page's
// operator list and rebuild the vector artwork directly: every fill/stroke path
// (building outlines, roads, coloured zones) becomes an SVG <path>, and the text
// layer is overlaid as crisp <text> from getTextContent (clean unicode, upright).
//
// pdfjs v6 packs paths as constructPath[paintOp, [subpathStream], minMax] where
// each subpath stream is a flat cmd/coord sequence: 0=moveTo(x,y) 1=lineTo(x,y)
// 2=curveTo(6) 4=close. Verified across all target sheets (11,763 subpaths, 0
// bad parses) — see scripts/maps/probe-format.mjs.
//
// Usage: node scripts/maps/pdf2svg.mjs <pdf> <page> <out.svg>
import { getDocument, OPS, Util } from "pdfjs-dist/legacy/build/pdf.mjs"
import { readFileSync, writeFileSync } from "fs"

const CMD_COORDS = { 0: 2, 1: 2, 2: 6, 4: 0 }

// pdfjs hands colours back as "#rrggbb"; anything else (a pattern IR, its type
// name, or undefined) is not a paintable colour.
function isColor(v) {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)
}

function fmt(n) {
  // 1dp is sub-pixel at these page sizes and roughly halves the file vs 2dp.
  return Number(n.toFixed(1)).toString()
}

function pathData(subpaths, m) {
  // m: combined matrix (viewport · ctm) mapping local path space -> device px.
  const ap = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
  let d = ""
  for (const sp of subpaths) {
    const a = Array.isArray(sp) ? sp : Object.values(sp)
    let j = 0
    while (j < a.length) {
      const cmd = a[j]
      const n = CMD_COORDS[cmd]
      if (n === undefined) break
      const c = a.slice(j + 1, j + 1 + n)
      if (cmd === 0) { const [x, y] = ap(c[0], c[1]); d += `M${fmt(x)} ${fmt(y)}` }
      else if (cmd === 1) { const [x, y] = ap(c[0], c[1]); d += `L${fmt(x)} ${fmt(y)}` }
      else if (cmd === 2) {
        const [x1, y1] = ap(c[0], c[1]); const [x2, y2] = ap(c[2], c[3]); const [x3, y3] = ap(c[4], c[5])
        d += `C${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x3)} ${fmt(y3)}`
      } else if (cmd === 4) { d += "Z" }
      j += 1 + n
    }
  }
  return d
}

function scaleOf(m) {
  // Approx uniform scale of a matrix, for line widths.
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1
}

export async function pdfPageToSvg(file, pageNum) {
  const data = new Uint8Array(readFileSync(file))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const page = await doc.getPage(pageNum)
  const vp = page.getViewport({ scale: 1 })
  const W = vp.width, H = vp.height
  const ol = await page.getOperatorList()

  // Graphics state + stack.
  let gs = { ctm: vp.transform.slice(), fill: "#000000", stroke: "#000000", lw: 1, fillA: 1, strokeA: 1 }
  const stack = []
  const out = []

  // Transparency groups. The sheets draw their drop shadows as Form XObject
  // groups composited at a low `ca` (~0.15–0.3). pdfjs sets that alpha before
  // `beginGroup` and resets to 1 inside, so we capture the alpha at group start,
  // multiply it into everything drawn inside, and reset the inner state. Without
  // this the shadows render as opaque near-black blocks over the buildings.
  let groupAlpha = 1
  const groupStack = []

  const setGStateAlpha = (arr) => {
    for (const [k, v] of arr) {
      if (k === "ca") gs.fillA = v
      else if (k === "CA") gs.strokeA = v
    }
  }

  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i]
    const args = ol.argsArray[i]
    switch (fn) {
      case OPS.save: stack.push({ ...gs, ctm: gs.ctm.slice() }); break
      case OPS.restore: if (stack.length) gs = stack.pop(); break
      case OPS.transform: gs.ctm = Util.transform(gs.ctm, args); break
      case OPS.setFillRGBColor: gs.fill = args[0]; break
      case OPS.setStrokeRGBColor: gs.stroke = args[0]; break
      // Pattern/shading fills (gradients, tiling) come through as a pattern IR or
      // its type name ("TilingPattern"/"RadialAxial"), never a usable colour. We
      // can't reproduce the gradient, so fall back to the neutral building tone
      // the sheets use for their block faces rather than emitting an invalid
      // colour (which librsvg paints solid black). Only "#rrggbb" is a real colour.
      case OPS.setFillColorN: gs.fill = isColor(args[0]) ? args[0] : "#dbe3ef"; break
      case OPS.setStrokeColorN: gs.stroke = isColor(args[0]) ? args[0] : "#9aa6b8"; break
      case OPS.setLineWidth: gs.lw = args[0]; break
      case OPS.setFillAlpha: gs.fillA = args[0]; break
      case OPS.setStrokeAlpha: gs.strokeA = args[0]; break
      case OPS.setGState: setGStateAlpha(args[0] || []); break
      case OPS.beginGroup: {
        const a = gs.fillA
        groupStack.push(a)
        groupAlpha *= a
        gs.fillA = 1; gs.strokeA = 1
        break
      }
      case OPS.endGroup: {
        const a = groupStack.pop()
        if (a) groupAlpha /= a
        break
      }
      case OPS.constructPath: {
        const paint = args[0]
        const subpaths = args[1]
        const d = pathData(subpaths, gs.ctm)
        if (!d) break
        const doFill = paint === OPS.fill || paint === OPS.eoFill || paint === OPS.fillStroke ||
          paint === OPS.eoFillStroke || paint === OPS.closeFillStroke
        const doStroke = paint === OPS.stroke || paint === OPS.fillStroke ||
          paint === OPS.eoFillStroke || paint === OPS.closeFillStroke
        const eo = paint === OPS.eoFill || paint === OPS.eoFillStroke
        if (!doFill && !doStroke) break // endPath / clip-only
        const fa = groupAlpha * gs.fillA
        const sa = groupAlpha * gs.strokeA
        const attrs = [`d="${d}"`]
        attrs.push(doFill ? `fill="${gs.fill}"` : `fill="none"`)
        if (doFill && eo) attrs.push(`fill-rule="evenodd"`)
        if (doFill && fa < 1) attrs.push(`fill-opacity="${fmt(fa)}"`)
        if (doStroke) {
          attrs.push(`stroke="${gs.stroke}"`)
          attrs.push(`stroke-width="${fmt(Math.max(0.3, gs.lw * scaleOf(gs.ctm)))}"`)
          if (sa < 1) attrs.push(`stroke-opacity="${fmt(sa)}"`)
        }
        out.push(`<path ${attrs.join(" ")}/>`)
        break
      }
      default: break
    }
  }

  // Text overlay: clean unicode strings placed at device baselines, upright.
  const tc = await page.getTextContent()
  const texts = []
  for (const it of tc.items) {
    // Strip control chars (some sheets carry stray 0x03 etc. in the text layer,
    // which is invalid XML PCDATA and blows up the SVG parser).
    const str = it.str.replace(/[\u0000-\u001F\u007F]/g, "")
    if (!str.trim()) continue
    const t = Util.transform(vp.transform, it.transform)
    const x = t[4], y = t[5]
    const fs = Math.hypot(t[0], t[1]) || Math.hypot(t[2], t[3])
    if (fs < 0.5) continue
    const angle = Math.atan2(t[1], t[0]) * 180 / Math.PI
    const esc = str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const rot = Math.abs(angle) > 0.5 ? ` transform="rotate(${fmt(angle)} ${fmt(x)} ${fmt(y)})"` : ""
    // A thin white halo keeps labels legible whatever they sit on: invisible on
    // the white background, but readable where a label falls on a dark/coloured
    // block (the sheets print those in white, which we can't recover per-label).
    const halo = ` stroke-width="${fmt(Math.max(1, fs * 0.17))}"`
    texts.push(`<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(fs)}"${halo}${rot}>${esc}</text>`)
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(W)} ${fmt(H)}" font-family="Arial, Helvetica, sans-serif">`,
    `<rect x="0" y="0" width="${fmt(W)}" height="${fmt(H)}" fill="#ffffff"/>`,
    `<g stroke-linejoin="round" stroke-linecap="round">`,
    ...out,
    `</g>`,
    `<g fill="#1a1a1a" stroke="#ffffff" stroke-linejoin="round" paint-order="stroke">`,
    ...texts,
    `</g>`,
    `</svg>`,
  ].join("\n")
  return { svg, width: W, height: H, textItems: tc.items }
}

// CLI
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("pdf2svg.mjs")) {
  const [file, pageStr, outFile] = process.argv.slice(2)
  if (file && outFile) {
    const { svg, width, height } = await pdfPageToSvg(file, parseInt(pageStr || "1", 10))
    writeFileSync(outFile, svg)
    console.log(`wrote ${outFile}  (${Math.round(width)}x${Math.round(height)}, ${svg.length} bytes)`)
  }
}
