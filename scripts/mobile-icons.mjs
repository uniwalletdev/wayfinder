// Render the app icon set from mobile/assets/icon.svg.
//
// The web manifest has always pointed at /icon-192.png and /icon-512.png, and
// neither existed — so "Add to Home Screen" fell back to a screenshot and the
// PWA was never installable. The same master feeds the Android and iOS
// projects, so the phone, the home screen and the store listing agree.
//
// Run: node scripts/mobile-icons.mjs   (after `npx cap add android|ios`)
import sharp from "sharp"
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs"
import { dirname } from "path"

const MASTER = "mobile/assets/icon.svg"
const FOREGROUND = "mobile/assets/icon-foreground.svg"

async function png(src, size, out, { round = false } = {}) {
  mkdirSync(dirname(out), { recursive: true })
  let img = sharp(src, { density: 300 }).resize(size, size)
  if (round) {
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`)
    img = img.composite([{ input: mask, blend: "dest-in" }])
  }
  await img.png().toFile(out)
}

// Web / PWA
await png(MASTER, 192, "public/icon-192.png")
await png(MASTER, 512, "public/icon-512.png")
await png(MASTER, 180, "public/apple-touch-icon.png")

// Android launcher icons, per density. The adaptive icon (API 26+) is a flat
// brand-colour background under the foreground mark; older launchers get the
// full square and round bitmaps.
const ANDROID_RES = "android/app/src/main/res"
if (existsSync(ANDROID_RES)) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  for (const [d, k] of Object.entries(densities)) {
    await png(MASTER, 48 * k, `${ANDROID_RES}/mipmap-${d}/ic_launcher.png`)
    await png(MASTER, 48 * k, `${ANDROID_RES}/mipmap-${d}/ic_launcher_round.png`, { round: true })
    await png(FOREGROUND, 108 * k, `${ANDROID_RES}/mipmap-${d}/ic_launcher_foreground.png`)
  }
  writeFileSync(
    `${ANDROID_RES}/values/ic_launcher_background.xml`,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0A5DC2</color>\n</resources>\n'
  )
}

// iOS: a single 1024 px universal icon (Xcode 14+ derives the rest).
const IOS_ICON = "ios/App/App/Assets.xcassets/AppIcon.appiconset"
if (existsSync(IOS_ICON)) {
  await sharp(MASTER, { density: 300 }).resize(1024, 1024).flatten({ background: "#0A5DC2" }).png().toFile(`${IOS_ICON}/AppIcon-512@2x.png`)
}

// Splash screens. Capacitor ships its own logo in every one of these; replace
// them at their existing sizes with the mark centred on the hero ink colour, so
// the hand-off from launch to the dark landing page does not flash.
async function splash(out) {
  const meta = await sharp(out).metadata()
  const { width, height } = meta
  const mark = Math.round(Math.min(width, height) * 0.22)
  const icon = await sharp(MASTER, { density: 300 }).resize(mark, mark)
    .composite([{ input: Buffer.from(`<svg width="${mark}" height="${mark}"><rect width="${mark}" height="${mark}" rx="${mark * 0.23}"/></svg>`), blend: "dest-in" }])
    .png().toBuffer()
  const buf = await sharp({ create: { width, height, channels: 4, background: "#0A1626" } })
    .composite([{ input: icon, gravity: "centre" }]).png().toBuffer()
  writeFileSync(out, buf)
}
if (existsSync(ANDROID_RES)) {
  for (const d of readdirSync(ANDROID_RES).filter((d) => d.startsWith("drawable"))) {
    const f = `${ANDROID_RES}/${d}/splash.png`
    if (existsSync(f)) await splash(f)
  }
}
const IOS_SPLASH = "ios/App/App/Assets.xcassets/Splash.imageset"
if (existsSync(IOS_SPLASH)) {
  for (const f of readdirSync(IOS_SPLASH).filter((f) => f.endsWith(".png"))) await splash(`${IOS_SPLASH}/${f}`)
}

console.log("icons written")
