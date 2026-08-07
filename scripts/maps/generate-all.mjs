import { pdfPageToSvg } from "./pdf2svg.mjs";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { readSheets } from "./sheets.mjs";

// [pdf file, page, venue-slug] — derived from data/mapped-sites.json, which
// build-venues.mjs reads too. These used to be two hand-kept arrays in two files.
export const MAPS = readSheets().map((s) => [s.file, s.page, s.slug]);

if (process.argv[1].endsWith("generate-all.mjs")) {
  const thumbOut = process.argv[2];
  for (const [file, page, slug] of MAPS) {
    const { svg, width, height } = await pdfPageToSvg(file, page);
    mkdirSync(`public/floorplans/${slug}`, { recursive: true });
    writeFileSync(`public/floorplans/${slug}/sitemap.svg`, svg);
    if (thumbOut) await sharp(Buffer.from(svg)).resize({ width: 900 }).png().toFile(`${thumbOut}/${slug}.png`);
    console.log(`${slug}: ${Math.round(width)}x${Math.round(height)}  ${(svg.length/1024).toFixed(0)}KB`);
  }
}
