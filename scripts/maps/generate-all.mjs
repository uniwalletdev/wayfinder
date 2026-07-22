import { pdfPageToSvg } from "./pdf2svg.mjs";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";

// [pdf file, page, venue-slug]
export const MAPS = [
  ["map/Charing Cross.pdf", 1, "charing-cross"],
  ["map/Hammersmith Hospital location map.pdf", 1, "hammersmith"],
  ["map/Queen Charlottes and Chelsea Hospital location map.pdf", 1, "qcch"],
  ["map/Western Eye Hospital location map.pdf", 1, "western-eye"],
  ["map/Clinical-Genetics-BWH-site-map.pdf", 1, "bwh"],
  ["map/map-qehb.pdf", 1, "qehb"],
  ["map/NMGHMap_Flat_UpdateDec2023_External-VB-Block-Naviagation-V2_.pdf", 1, "nmgh"],
  ["map/ORC-map-with-directory-Feb-25.pdf", 1, "oxford-road"],
  ["map/Trafford-General-Hospital-map.pdf", 1, "trafford"],
  ["map/wythenshawe-hospital-sitemap-updated-logo.pdf", 1, "wythenshawe"],
];

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
