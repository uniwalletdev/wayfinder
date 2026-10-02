// Which voice reads the directions, and how a step is said aloud.
import { register } from "node:module"
register(new URL("./ts-hooks.mjs", import.meta.url))
const { rankVoices, spokenStep } = await import("../../src/lib/voice.ts")

let pass = 0, fail = 0
const ok = (cond, label) => {
  if (cond) pass++
  else fail++
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`)
}
const v = (name, voiceURI, lang = "en-GB", extra = {}) => ({ name, voiceURI, lang, localService: true, ...extra })

console.log("iPhone voices")
const ios = [
  v("Daniel", "com.apple.voice.compact.en-GB.Daniel"),
  v("Kate", "com.apple.voice.compact.en-GB.Kate"),
  v("Serena", "com.apple.voice.enhanced.en-GB.Serena"),
  v("Samantha", "com.apple.voice.compact.en-US.Samantha", "en-US"),
  v("Bubbles", "com.apple.speech.synthesis.voice.Bubbles", "en-US"),
  v("Shelley", "com.apple.eloquence.en-GB.Shelley"),
  v("Amélie", "com.apple.voice.compact.fr-CA.Amelie", "fr-CA"),
]
ok(rankVoices(ios)?.name === "Serena", "an enhanced British female voice beats compact ones")
ok(rankVoices(ios.filter((x) => x.name !== "Serena"))?.name === "Kate", "a British female voice beats a male one")
ok(rankVoices([v("Daniel", "com.apple.voice.compact.en-GB.Daniel"), v("Samantha", "com.apple.voice.compact.en-US.Samantha", "en-US")])?.name === "Samantha", "an American female voice beats a British male one")
ok(rankVoices([v("Bubbles", "com.apple.speech.synthesis.voice.Bubbles", "en-US"), v("Shelley", "com.apple.eloquence.en-GB.Shelley")]) === null, "novelty and robotic voices are never chosen")
ok(rankVoices([v("Amélie", "com.apple.voice.compact.fr-CA.Amelie", "fr-CA")]) === null, "no English voice means the engine default")

console.log("Android voices")
const google = [
  v("en-gb-x-gbb-local", "en-gb-x-gbb-local", "en-GB"),
  v("en-gb-x-gbd-network", "en-gb-x-gbd-network", "en-GB", { localService: false }),
  v("en-gb-x-gba-network", "en-gb-x-gba-network", "en-GB", { localService: false }),
  v("en-gb-x-gbc-local", "en-gb-x-gbc-local", "en-GB"),
]
ok(rankVoices(google)?.name === "en-gb-x-gbc-local", "Google: a female voice that works offline wins")
ok(rankVoices(google.filter((x) => !x.name.includes("gbc")))?.name === "en-gb-x-gba-network", "Google: a female network voice beats male ones")
const samsung = [v("en-GB-SMTm00", "en-GB-SMTm00"), v("en-GB-SMTf00", "en-GB-SMTf00")]
ok(rankVoices(samsung)?.name === "en-GB-SMTf00", "Samsung: SMTf is female, SMTm male")
ok(rankVoices([v("Google UK English Male", "Google UK English Male"), v("Google UK English Female", "Google UK English Female")])?.name === "Google UK English Female", "web: the voice named Female")
ok(rankVoices([v("en-gb-x-rjs-local", "en-gb-x-rjs-local")])?.name === "en-gb-x-rjs-local", "a male voice is still used when it is the only English one")

console.log("How a step is said")
ok(spokenStep("Head south-east toward Kangaroo Ward", 74, { first: true }) === "Let's go. Head south-east toward Kangaroo Ward, for about 75 metres.", "first step: a gentle start and a rounded distance")
ok(spokenStep("Turn left", 7) === "Turn left, for about 7 metres.", "short distances are exact")
ok(spokenStep("Head north toward X-Ray — follow the corridor signs", 133) === "Head north toward X-Ray. Follow the corridor signs, for about 130 metres.", "a dash becomes a pause")
ok(spokenStep("You have arrived at Kangaroo Ward", 0) === "You've arrived at Kangaroo Ward. Take care.", "arrival is warm")

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
