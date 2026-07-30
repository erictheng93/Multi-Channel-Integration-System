/**
 * Extracts the CSS class vocabulary actually used by the app.
 *
 * Two confidence tiers are produced, because they are used for different things:
 *
 * - `attributeTokens` (high confidence): tokens that are unambiguously class
 *   names - the contents of `class="..."`, the string literals inside
 *   `:class="..."` / `v-bind:class="..."`, and the bodies of `@apply` rules
 *   found inside `<style>` blocks and `.css` files. If one of these stops
 *   emitting CSS, either it is an app-owned class or a utility just vanished.
 *
 * - `looseTokens` (low confidence): whitespace-separated words harvested from
 *   every string literal in `src/**\/*.ts`. Class names live in there (icon
 *   components, composables that build class strings), but so does every other
 *   string in the codebase. These are only ever used to *widen* the set of
 *   candidates handed to Tailwind; anything Tailwind does not recognise is
 *   discarded rather than recorded, so unrelated strings cannot pollute the
 *   baseline.
 *
 * Deliberately NOT reused: Tailwind's own `defaultExtractor`. It is a private
 * implementation detail whose behaviour changes between majors, and the whole
 * point of this layer is to be an independent observer of the pipeline.
 */
import { FRONTEND_ROOT, compareAscii, fromRepoRelative, listFiles, readTextFile } from './repo-files'
import { resolve } from 'node:path'

export interface ClassVocabulary {
  /** Tokens that are definitely class names, sorted. */
  readonly attributeTokens: readonly string[]
  /** Low-confidence candidates harvested from `.ts` string literals, sorted. */
  readonly looseTokens: readonly string[]
  /** Repo-relative list of every file that was scanned, sorted. */
  readonly scannedFiles: readonly string[]
}

/** `class="..."`, `:class="..."`, `v-bind:class="..."` - value read to the matching quote. */
const CLASS_ATTRIBUTE_RE = /(?::|v-bind:)?\bclass\s*=\s*(["'])([\s\S]*?)\1/g

/** `<style ...> ... </style>` block bodies. */
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi

/** `@apply a b c;` or `@apply a b c }` - body only. */
const APPLY_RE = /@apply\s+([^;{}]+)/g

/** Single-quoted, double-quoted and backtick string literal bodies. */
const STRING_LITERAL_RE =
  /'((?:[^'\\\n]|\\[\s\S])*)'|"((?:[^"\\\n]|\\[\s\S])*)"|`((?:[^`\\]|\\[\s\S])*)`/g

/** `${...}` interpolation holes inside a template literal. */
const INTERPOLATION_RE = /\$\{[^}]*\}/g

/**
 * Extract the class vocabulary from `frontend/`.
 *
 * Sources (fixed, so the result cannot drift with an argument change):
 * `index.html`, `src/**\/*.vue`, `src/**\/*.ts`, `src/**\/*.css`.
 */
export function extractClassVocabulary(): ClassVocabulary {
  const attribute = new Set<string>()
  const loose = new Set<string>()
  const scanned: string[] = []

  const indexHtml = resolve(FRONTEND_ROOT, 'index.html')
  scanned.push('index.html')
  collectFromMarkup(readTextFile(indexHtml), attribute)

  const srcDir = resolve(FRONTEND_ROOT, 'src')

  for (const relativePath of listFiles(srcDir, ['.vue'])) {
    scanned.push(relativePath)
    const source = readTextFile(fromRepoRelative(relativePath))
    collectFromMarkup(source, attribute)
    for (const styleBlock of matchAll(source, STYLE_BLOCK_RE, 1)) {
      collectFromApply(styleBlock, attribute)
    }
  }

  for (const relativePath of listFiles(srcDir, ['.css'])) {
    scanned.push(relativePath)
    collectFromApply(readTextFile(fromRepoRelative(relativePath)), attribute)
  }

  for (const relativePath of listFiles(srcDir, ['.ts'])) {
    scanned.push(relativePath)
    collectFromStringLiterals(readTextFile(fromRepoRelative(relativePath)), loose)
  }

  // A token found in a class attribute is never "loose".
  for (const token of attribute) {
    loose.delete(token)
  }

  return {
    attributeTokens: [...attribute].sort(compareAscii),
    looseTokens: [...loose].sort(compareAscii),
    scannedFiles: scanned.sort(compareAscii),
  }
}

/** Collect from `class` / `:class` attributes in HTML or a Vue template. */
function collectFromMarkup(source: string, sink: Set<string>): void {
  CLASS_ATTRIBUTE_RE.lastIndex = 0
  let match: RegExpExecArray | null = CLASS_ATTRIBUTE_RE.exec(source)

  while (match !== null) {
    const raw = match[0]
    const value = match[2] ?? ''
    const isBinding = raw.startsWith(':') || raw.startsWith('v-bind:')

    if (isBinding) {
      // The value is a JS expression; only its string literals are class names.
      collectFromStringLiterals(value, sink)
    } else {
      addTokens(value, sink)
    }

    match = CLASS_ATTRIBUTE_RE.exec(source)
  }
}

/** Collect from `@apply` bodies. Only call this on CSS, never on a template. */
function collectFromApply(css: string, sink: Set<string>): void {
  for (const body of matchAll(css, APPLY_RE, 1)) {
    addTokens(body.replace(/!important\s*$/, ''), sink)
  }
}

/** Collect whitespace-separated words out of every string literal. */
function collectFromStringLiterals(source: string, sink: Set<string>): void {
  STRING_LITERAL_RE.lastIndex = 0
  let match: RegExpExecArray | null = STRING_LITERAL_RE.exec(source)

  while (match !== null) {
    const single = match[1]
    const double = match[2]
    const template = match[3]

    if (typeof single === 'string') {
      addTokens(single, sink)
    } else if (typeof double === 'string') {
      addTokens(double, sink)
    } else if (typeof template === 'string') {
      // Drop tokens that touch an interpolation hole: `w-${size}` is not a
      // class, and recording `w-` would be noise.
      for (const segment of template.split(INTERPOLATION_RE)) {
        addTokens(segment, sink)
      }
    }

    match = STRING_LITERAL_RE.exec(source)
  }
}

/** Split on whitespace and add every plausible class token. */
function addTokens(value: string, sink: Set<string>): void {
  for (const token of value.split(/\s+/)) {
    if (isPlausibleClassToken(token)) {
      sink.add(token)
    }
  }
}

/**
 * Cheap sanity filter. Anything that survives is only ever handed to Tailwind
 * as a candidate, so this errs on the permissive side - Tailwind arbitrary
 * values legitimately contain brackets, slashes, parentheses and dots.
 */
function isPlausibleClassToken(token: string): boolean {
  if (token.length === 0 || token.length > 120) {
    return false
  }
  // Must start like an identifier, a negative utility, or an important modifier.
  if (!/^[a-zA-Z0-9!_-]/.test(token)) {
    return false
  }
  // Reject anything containing characters that cannot survive in markup or that
  // mark the token as prose / code rather than a class name.
  return !/[<>{}();"'`=\\]/.test(token) || /\[[^\]]*\]/.test(token)
}

/** Collect capture group `group` of every match of `re` in `source`. */
function matchAll(source: string, re: RegExp, group: number): string[] {
  re.lastIndex = 0
  const out: string[] = []
  let match: RegExpExecArray | null = re.exec(source)
  while (match !== null) {
    const captured = match[group]
    if (typeof captured === 'string') {
      out.push(captured)
    }
    match = re.exec(source)
  }
  return out
}
