// Render a map SVG with its venue's waypoints drawn as pins, to verify placement.
import { pdfPageToSvg } from "./pdf2svg.mjs";
import sharp from "sharp";
import { readFileSync } from "fs";
const [file, page, venuePath, out] = process.argv.slice(2);
const { svg, width:W, height:H } = await pdfPageToSvg(file, +page);
const src = readFileSync(venuePath, "utf8");
// pull bounds + waypoint coords
const b = src.match(/bounds: \[\[([-\d.]+), ([-\d.]+)\], \[([-\d.]+), ([-\d.]+)\]\]/);
const [ , latS, lngW, latN, lngE ] = b.map(Number);
const wps = [...src.matchAll(/name: "([^"]+)", type: "[^"]+", coordinates: \{ lat: ([-\d.]+), lng: ([-\d.]+) \}/g)];
const pins = wps.map(m=>{
  const lat=+m[2], lng=+m[3];
  const x = (lng - lngW)/(lngE - lngW) * W;
  const y = (latN - lat)/(latN - latS) * H;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#e11" fill-opacity="0.85" stroke="#fff" stroke-width="1.5"/>`;
}).join("");
const merged = svg.replace("</svg>", `<g>${pins}</g></svg>`);
await sharp(Buffer.from(merged)).resize({width:1500}).png().toFile(out);
console.log(`overlay ${wps.length} pins -> ${out}`);
