import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The data pipeline. eslint-config-next only covers the app, so nothing was
  // checking these at all — a rename left `overlap` undefined in
  // draft-sheets.mjs and it reached a user's machine, because the tests exercise
  // the matching functions directly and never run the stage end to end.
  //
  // no-undef is the whole point. TypeScript catches this in src/; these are
  // plain .mjs with no type checking, so a linter is the only thing that will.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    // Only no-undef. Unused variables are already reported by the TypeScript
    // plugin config above, which applies to every file; enabling the base rule
    // too just prints each one twice.
    rules: { "no-undef": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
