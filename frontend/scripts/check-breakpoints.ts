#!/usr/bin/env bun
/**
 * Breakpoint Scale Guard
 *
 * Every `@media (min|max-width: N)` must use a value from the scale in
 * `src/config/breakpoints.ts` (or scale + 1px, the complementary `min-width`
 * idiom). Without this, each component picks its own number and the layout
 * switches at a dozen unrelated widths.
 *
 * Exits 0 on clean, 1 on violations.
 *
 * Usage:
 *   bun scripts/check-breakpoints.ts              # scan src/
 *   bun scripts/check-breakpoints.ts path/to/file # scan specific files
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { BREAKPOINTS } from '../src/config/breakpoints'

const ROOT = resolve(import.meta.dir, '..')
const SRC = join(ROOT, 'src')

const SCALE = Object.values(BREAKPOINTS) as number[]
const ALLOWED = new Set<number>(SCALE)
const MIN_COMPLEMENTS = new Set<number>(SCALE.map((n) => n + 1))

const MEDIA_QUERY = /@media\b([^{};]*)\{/gi
const MEDIA_WIDTH = /\(\s*(min|max)-width\s*:\s*([0-9.]+)(px|rem|em)\s*\)/g

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') {continue}
      out.push(...(await walk(full)))
    } else if (/\.(vue|css)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const args = process.argv.slice(2)
const files = args.length ? args.map((a) => resolve(a)) : await walk(SRC)

let violations = 0
interface WidthCondition {
  /** 'min' = lower bound, 'max' = upper bound, 'eq' = exact width. */
  kind: 'min' | 'max' | 'eq'
  px: number
  index: number
}

const toPx = (value: string, unit: string): number =>
  Math.round(parseFloat(value) * (unit === 'px' ? 1 : 16))

/** Every width condition of one media prelude: legacy `(min-width: N)` and range syntax `(width <= N)`. */
function widthConditions(prelude: string): WidthCondition[] {
  const out: WidthCondition[] = []
  for (const m of prelude.matchAll(MEDIA_WIDTH)) {
    out.push({ kind: m[1] as 'min' | 'max', px: toPx(m[2], m[3]), index: m.index ?? 0 })
  }
  // Media Queries Level 4: `(width <= 700px)`, `(700px <= width)`, `(400px <= width <= 700px)`.
  for (const group of prelude.matchAll(/\(([^()]*)\)/g)) {
    const parts = group[1].split(/(<=|>=|<|>|=)/).map((s) => s.trim())
    if (!parts.includes('width')) { continue }
    for (let i = 1; i < parts.length; i += 2) {
      const [left, op, right] = [parts[i - 1], parts[i], parts[i + 1]]
      const length = (left === 'width' ? right : left)?.match(/^([0-9.]+)(px|rem|em)$/)
      if (!length || (left !== 'width' && right !== 'width')) { continue }
      // `width > N` and `N < width` both bound the width from below.
      const lower = left === 'width' ? op.startsWith('>') : op.startsWith('<')
      out.push({
        kind: op === '=' ? 'eq' : lower ? 'min' : 'max',
        px: toPx(length[1], length[2]),
        index: (group.index ?? 0),
      })
    }
  }
  return out
}

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  // Preserve offsets and newlines for diagnostics while ignoring commented-out queries.
  const source = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\r\n]/g, ' ')
  )
  for (const query of source.matchAll(MEDIA_QUERY)) {
    for (const cond of widthConditions(query[1])) {
      if (!ALLOWED.has(cond.px) && !(cond.kind === 'min' && MIN_COMPLEMENTS.has(cond.px))) {
        violations++
        const offset = (query.index ?? 0) + query[0].indexOf(query[1]) + cond.index
        const line = source.slice(0, offset).split('\n').length
        console.error(`${rel}:${line}  ${cond.kind}-width ${cond.px}px is not in the scale [${SCALE.join(', ')}]`)
      }
    }
  }
}

if (violations) {
  console.error(`\n${violations} off-scale breakpoint(s). Use values from src/config/breakpoints.ts.`)
  process.exit(1)
}
console.log('breakpoints: ok')
