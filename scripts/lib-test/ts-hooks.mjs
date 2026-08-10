// Module hooks that let the plain-node tests under scripts/ import the app's
// TypeScript modules in src/lib directly, so a test exercises the real shipped
// function instead of a transcribed copy that can silently drift from it.
//
// Two things are needed, and Node's built-in type stripping supplies neither:
//
//   * TypeScript's extensionless relative imports ("./types") are not valid
//     ESM specifiers, so `resolve` appends the extension.
//   * `import { Waypoint, FloorNaming } from "./types"` names types, not
//     values. Stripping alone leaves the import standing, and types.ts has no
//     runtime exports to satisfy it. `load` therefore transpiles through
//     TypeScript itself (already a devDependency), which elides imports left
//     unused in value positions.
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import ts from "typescript"

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    for (const ext of [".ts", ".tsx"]) {
      const candidate = new URL(specifier + ext, context.parentURL)
      if (existsSync(fileURLToPath(candidate))) return nextResolve(specifier + ext, context)
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (!/\.tsx?$/.test(url)) return nextLoad(url, context)
  const path = fileURLToPath(url)
  const { outputText } = ts.transpileModule(await readFile(path, "utf8"), {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  return { format: "module", source: outputText, shortCircuit: true }
}
