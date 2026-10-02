// The voice that reads directions aloud: a calm, unhurried female voice.
//
// Inside the apps it is the phone's own speech engine (through
// @capacitor-community/text-to-speech), because Android's in-app browser has
// no speech API at all and iOS's own voices sound far better than the web
// fallback. On the web it is the browser's Web Speech API. Either way the voice
// lives on the device, so it keeps talking in a basement with no signal.
//
// Neither platform says which voices are female, so voices are ranked by what
// they are known to be called: Apple's named voices (Serena, Kate, Martha…),
// Samsung's SMTf/SMTm codes, Google's per-voice codes, and the words "female"
// and "male" where an engine uses them. The best-quality English voice that
// is female wins; a voice of unknown gender is kept as a fallback, and a known
// male voice only if nothing else exists. Premium and enhanced voices beat
// compact ones, and a voice that needs the network loses to one that doesn't.

import { Capacitor } from "@capacitor/core"

export interface VoiceInfo {
  name: string
  voiceURI: string
  lang: string
  localService?: boolean
  default?: boolean
}

const FEMALE_NAMES = [
  // Apple
  "serena", "kate", "stephanie", "martha", "fiona", "moira", "karen", "catherine", "tessa", "samantha",
  "ava", "allison", "susan", "zoe", "nicky", "joelle", "veena", "isha", "victoria", "kathy", "flo", "sandy", "shelley",
  // Windows, Edge and Chrome on the web
  "hazel", "libby", "sonia", "maisie", "zira", "aria", "jenny", "michelle", "natasha", "clara", "emily",
]
const MALE_NAMES = [
  "daniel", "arthur", "oliver", "malcolm", "rishi", "gordon", "lee", "aaron", "fred", "tom", "alex", "evan",
  "nathan", "jamie", "george", "ryan", "thomas", "guy", "david", "mark", "james", "eddy", "reed", "rocko", "grandpa",
]
// Apple's novelty voices (Bubbles, Zarvox…) and the robotic Eloquence engine.
const NOVELTY = /com\.apple\.(speech\.synthesis|eloquence)|bubbles|zarvox|whisper|trinoids|wobble|cellos|bells|boing|organ|bahh|jester|superstar|albert|junior|ralph|grandma|good news|bad news/i
// Google's speech engine on Android names voices by code; these are female.
const GOOGLE_FEMALE = /-x-(gba|gbc|gbg|iob|iog|sfg|tpc|tpf|aua|auc|ahp|cxx)(-|$)/i
const GOOGLE_MALE = /-x-(gbb|gbd|rjs|iol|iom|tpd|aub|aud)(-|$)/i

function words(v: VoiceInfo): string {
  return `${v.name} ${v.voiceURI}`.toLowerCase()
}

function genderScore(v: VoiceInfo): number {
  const w = words(v)
  if (/\bfemale\b/.test(w) || /smtf\d/.test(w) || GOOGLE_FEMALE.test(w)) return 60
  if (/\bmale\b/.test(w) || /smtm\d/.test(w) || GOOGLE_MALE.test(w)) return -100
  const token = (name: string) => new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(w)
  if (FEMALE_NAMES.some(token)) return 50
  if (MALE_NAMES.some(token)) return -100
  return 0
}

function qualityScore(v: VoiceInfo): number {
  const w = words(v)
  let s = 0
  if (w.includes("premium")) s += 30
  else if (w.includes("enhanced") || w.includes("neural") || w.includes("natural")) s += 20
  if (v.localService === false || w.includes("-network")) s -= 15
  if (w.includes("-local")) s += 5
  if (v.default) s += 5
  return s
}

// The best voice for reading English directions, or null when there is no
// English voice at all (the engine then uses its default).
export function rankVoices(voices: VoiceInfo[], preferredLang = "en-GB"): VoiceInfo | null {
  const pref = preferredLang.toLowerCase().replace("_", "-")
  let best: VoiceInfo | null = null
  let bestScore = -Infinity
  for (const v of voices) {
    const lang = (v.lang || "").toLowerCase().replace("_", "-")
    if (!lang.startsWith("en")) continue
    if (NOVELTY.test(v.voiceURI) || NOVELTY.test(v.name)) continue
    const score = (lang === pref ? 40 : 20) + genderScore(v) + qualityScore(v)
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  return best
}

// Calm, not slow: a little under the engine's normal pace.
const RATE = 0.9
const PITCH = 1.0

function roundDistance(m: number): number {
  if (m < 10) return Math.max(1, Math.round(m))
  if (m < 100) return Math.round(m / 5) * 5
  return Math.round(m / 10) * 10
}

// The written step, said the way a person giving directions would say it.
export function spokenStep(instruction: string, distance: number, opts: { first?: boolean } = {}): string {
  const text = instruction
    .replace(/\s+—\s+(\w)/g, (_, c: string) => `. ${c.toUpperCase()}`)
    .replace(/^You have arrived at /i, "You've arrived at ")
  if (/^You've arrived/i.test(text)) return `${text}. Take care.`
  const far = distance > 0 ? `, for about ${roundDistance(distance)} metres` : ""
  return `${opts.first ? "Let's go. " : ""}${text}${far}.`
}

// ── Speaking ────────────────────────────────────────────────────────────────

let nativeVoiceIndex: number | null | undefined // undefined: not looked up yet
let webVoice: SpeechSynthesisVoice | null = null

export function speechAvailable(): boolean {
  if (typeof window === "undefined") return false
  return Capacitor.isNativePlatform() || "speechSynthesis" in window
}

async function nativeVoice(): Promise<number | null> {
  if (nativeVoiceIndex !== undefined) return nativeVoiceIndex
  try {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech")
    const { voices } = await TextToSpeech.getSupportedVoices()
    const best = rankVoices(voices as VoiceInfo[])
    nativeVoiceIndex = best ? voices.indexOf(best as never) : null
  } catch {
    nativeVoiceIndex = null
  }
  return nativeVoiceIndex
}

function pickWebVoice(): SpeechSynthesisVoice | null {
  if (webVoice) return webVoice
  const voices = window.speechSynthesis.getVoices()
  const best = rankVoices(voices)
  webVoice = (best as SpeechSynthesisVoice | null) ?? null
  return webVoice
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  // Browsers load their voice list after the page; choose once it arrives.
  window.speechSynthesis.addEventListener?.("voiceschanged", () => {
    webVoice = null
    pickWebVoice()
  })
}

export async function speak(text: string): Promise<void> {
  if (typeof window === "undefined") return
  try {
    if (Capacitor.isNativePlatform()) {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech")
      const voice = await nativeVoice()
      await TextToSpeech.speak({ text, lang: "en-GB", rate: RATE, pitch: PITCH, volume: 1, ...(voice !== null ? { voice } : {}) })
      return
    }
    if (!("speechSynthesis" in window)) return
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickWebVoice()
    if (v) u.voice = v
    u.lang = v?.lang ?? "en-GB"
    u.rate = RATE
    u.pitch = PITCH
    synth.speak(u)
  } catch {
    // An engine that lists itself but refuses to speak (no voices installed,
    // autoplay rules) simply stays silent; the written step is still there.
  }
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return
  try {
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor-community/text-to-speech").then(({ TextToSpeech }) => TextToSpeech.stop()).catch(() => {})
      return
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
  } catch {}
}
