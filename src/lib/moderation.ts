// The first line of moderation for what people publish (App Store guideline
// 1.2 asks for a way to filter objectionable material before it is posted):
// a place or point whose name carries a slur or strong profanity is refused
// by the API before anyone else can see it. Reports and the back office catch
// what a word list cannot.
//
// Pure, so it is unit-tested (scripts/lib-test/moderation.test.mjs). The list
// is deliberately short and matched as whole words only: hospital names are
// full of innocent near-misses — Scunthorpe, Penistone, Cockermouth, the
// Sexual Health Clinic, a Rape Crisis Centre — and refusing a real department
// is worse than missing a rude word a report will catch anyway.

// Each entry is one whole word with the endings it takes, as a regular
// expression over plain a-z.
const TERMS = [
  "fuck(s|ed|er|ers|ing|in|face|wit|witted|head|heads)?",
  "motherfuck(er|ers|ing)?",
  "shit(s|ty|e|head|heads|hole|holes)?",
  "bullshit",
  "cunts?",
  "twats?",
  "wank(s|er|ers|ing)?",
  "bollocks",
  "piss(ed|er|ing)?",
  "whores?",
  "sluts?",
  "bitch(es|y)?",
  "bastards?",
  "dickheads?",
  "(arse|ass)holes?",
  "retard(s|ed)?",
  "nigg(a|as|az|er|ers)",
  "faggots?",
  "kikes?",
  "spics?",
  "chinks?",
  "pakis?",
  "wogs?",
  "trann(y|ies)",
  "porn(o|s)?",
  "xxx",
]

const PATTERN = new RegExp(`^(?:${TERMS.join("|")})$`)

// Digits and symbols that stand in for letters ("sh1t", "$lut").
const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t" }

function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0-9!@$]/g, (c) => LEET[c] ?? c)
}

// The words of a text, plus each run of single letters joined up, so
// "f u c k" and "s.h.i.t" are read as the words they spell.
function words(text: string): string[] {
  const tokens = normalise(text).split(/[^a-z]+/).filter(Boolean)
  const out = [...tokens]
  let run = ""
  for (const t of [...tokens, ""]) {
    if (t.length === 1) {
      run += t
      continue
    }
    if (run.length > 1) out.push(run)
    run = ""
  }
  return out
}

// A letter stretched for emphasis ("fuuuuck") is read with the run cut back
// to one and to two letters, which covers both "fuck" and "nigger". A doubled
// letter is left alone, so the Orkney village of Twatt is not "twat".
function variants(word: string): string[] {
  if (!/(.)\1\1/.test(word)) return [word]
  return [word, word.replace(/(.)\1{2,}/g, "$1"), word.replace(/(.)\1{2,}/g, "$1$1")]
}

// True when any of the texts carries a listed word.
export function isObjectionable(...texts: (string | null | undefined)[]): boolean {
  for (const text of texts) {
    if (!text) continue
    for (const w of words(text)) {
      for (const v of variants(w)) if (PATTERN.test(v)) return true
    }
  }
  return false
}
