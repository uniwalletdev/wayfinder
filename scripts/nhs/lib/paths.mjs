// Shared paths and JSON/manifest I/O for the ingestion pipeline.
//
// Paths resolve from this file's own location rather than process.cwd(), so a
// stage behaves the same whether it's run as `node scripts/nhs/fetch-ods.mjs`
// from the repo root or invoked from a workflow step in another directory. (The
// older scripts/maps generators assume the repo root — this is the fix, not a
// deviation.)
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
export const DATA_DIR = join(REPO_ROOT, "data")
export const RAW_DIR = join(DATA_DIR, "raw")
export const MANIFEST = join(DATA_DIR, "manifest.json")

export const dataPath = (...parts) => join(DATA_DIR, ...parts)
export const repoPath = (...parts) => join(REPO_ROOT, ...parts)

export function ensureDir(path) {
  mkdirSync(path, { recursive: true })
  return path
}

export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err.message}`)
  }
}

// Stable key ordering and a trailing newline: these files are committed, and the
// whole point of committing them is that the diff is reviewable. An unstable key
// order would make every refresh look like a total rewrite.
export function writeJson(path, value) {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n")
  return path
}

// The manifest records where each artefact came from and what it hashed to, so
// a reviewer looking at a 2,500-row data diff can tell whether the upstream
// actually changed or the pipeline did.
export function updateManifest(key, entry) {
  const manifest = readJson(MANIFEST, {})
  manifest[key] = { ...entry, fetchedAt: new Date().toISOString() }
  writeJson(MANIFEST, manifest)
  return manifest
}

// Consistent stage logging — the workflow log is the only place a failure is
// visible, so stages announce what they did rather than succeeding silently.
export function log(stage, message) {
  console.log(`[${stage}] ${message}`)
}
