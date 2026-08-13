import { pdfPageToSvg } from "./pdf2svg.mjs";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { readSheets } from "./sheets.mjs";

// [pdf file, page, venue-slug, image basename] — derived from
// data/mapped-sites.json, which build-venues.mjs reads too. These used to be two
// hand-kept arrays in two files.
//
// One row per FLOOR, not per sheet: a venue with nine levels needs nine SVGs.
// readSheets gives single-floor sheets a synthesised floor, so this loop does
// not care which kind it is looking at.
export const MAPS = readSheets().flatMap((s) => s.floors.map((f) => [f.file, f.page, s.slug, f.image]));

if (process.argv[1].endsWith("generate-all.mjs")) {
  const thumbOut = process.argv[2];
  if (thumbOut) mkdirSync(thumbOut, { recursive: true });
  for (const [file, page, slug, image] of MAPS) {
    // No paper: the plan is a layer over the basemap, not a sheet laid on top
    // of it. See pdfPageToSvg's note on pageBackground.
    const { svg, width, height } = await pdfPageToSvg(file, page);
    mkdirSync(`public/floorplans/${slug}`, { recursive: true });
    writeFileSync(`public/floorplans/${slug}/${image}.svg`, svg);
    // One thumbnail per venue, from whichever floor comes first — the preview
    // exists to check placement, and every floor shares one anchor. Flattened
    // onto white, because a review thumbnail on a transparent background is
    // a page of floating labels.
    const thumb = () => sharp(Buffer.from(svg)).flatten({ background: "#ffffff" }).resize({ width: 900 }).png();
    if (thumbOut && image === "sitemap") await thumb().toFile(`${thumbOut}/${slug}.png`);
    else if (thumbOut) await thumb().toFile(`${thumbOut}/${slug}-${image}.png`);
    console.log(`${slug}/${image}: ${Math.round(width)}x${Math.round(height)}  ${(svg.length/1024).toFixed(0)}KB`);
  }
}
