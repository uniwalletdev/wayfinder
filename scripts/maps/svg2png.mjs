import sharp from "sharp";
import { readFileSync } from "fs";
const [svgFile, pngFile, width] = process.argv.slice(2);
const svg = readFileSync(svgFile);
await sharp(svg, { density: 96 }).resize({ width: parseInt(width||"1400",10) }).png().toFile(pngFile);
console.log("wrote", pngFile);
