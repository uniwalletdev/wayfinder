// Checks the publish filter (src/lib/moderation.ts): slurs and strong
// profanity in a place or point name are refused, in the disguises people
// use, while the real hospital, department and place names that contain
// them as letters go through.
//
// Run: node scripts/lib-test/moderation.test.mjs
import { register } from "node:module"
import { fileURLToPath } from "node:url"

register(new URL("./ts-hooks.mjs", import.meta.url), import.meta.url)

const SRC = new URL("../../src/lib/", import.meta.url)
const { isObjectionable } = await import(fileURLToPath(new URL("moderation.ts", SRC)))
const { group, check, report } = await import("../nhs/test/harness.mjs")

group("refused")
for (const name of [
  "Fuck this ward",
  "SHIT HOLE",
  "shithole clinic",
  "Ward of bastards",
  "sh1t",
  "f u c k",
  "s.h.i.t",
  "fuuuuck",
  "Fück",
  "$lut",
  "porn room",
  "XXX",
]) {
  check(JSON.stringify(name), isObjectionable(name))
}
check("any of several texts", isObjectionable("Main Reception", "a twat"))

group("allowed")
for (const name of [
  "Scunthorpe General Hospital",
  "Penistone Health Centre",
  "Cockermouth Community Hospital",
  "Sexual Health Clinic",
  "Rape Crisis Centre",
  "Cock Lane Clinic",
  "Shitterton Surgery",
  "Twatt Surgery, Orkney",
  "Bitche Hôpital",
  "Middlesex University Hospital",
  "Pakistan High Commission",
  "Spicer Ward",
  "Assessment Unit",
  "Ward 10, Level 5",
  "A & E",
  "Niger State General Hospital",
  "Great Ormond Street Hospital",
  "Kangaroo Ward",
]) {
  check(JSON.stringify(name), !isObjectionable(name))
}
check("empty and missing texts", !isObjectionable("", null, undefined))

report()
