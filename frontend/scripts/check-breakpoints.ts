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
const ALLOWED = new Set<number>([...SCALE, ...SCALE.map((n) => n + 1)])

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
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const lines = (await readFile(file, 'utf8')).split('\n')
  lines.forEach((line, i) => {
    if (!line.includes('@media')) {return}
    for (const m of line.matchAll(MEDIA_WIDTH)) {
      const px = Math.round(parseFloat(m[2]) * (m[3] === 'px' ? 1 : 16))
      if (!ALLOWED.has(px)) {
        violations++
        console.error(`${rel}:${i + 1}  ${m[1]}-width ${px}px is not in the scale [${SCALE.join(', ')}]`)
      }
    }
  })
}

if (violations) {
  console.error(`\n${violations} off-scale breakpoint(s). Use values from src/config/breakpoints.ts.`)
  process.exit(1)
}
console.log('breakpoints: ok')
