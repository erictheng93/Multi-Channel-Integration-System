#!/usr/bin/env bun
/**
 * Page Root Sizing Guard
 *
 * `.page-content` (AppLayout) is a flex COLUMN. A flex item with `max-width` and
 * `margin: 0 auto` but no `width` does not stretch: it is sized to its content, so the
 * page is narrower than it may be and, as soon as the content is wide (a long select
 * option, a raw float), it grows past the screen. This was found on seven pages
 * (#67, the websocket monitor, the page-root audit); each needed `width: 100%`.
 *
 * Rule: the root element of every routed component whose class sets `max-width` together
 * with auto margins must also set `width`.
 *
 * Static on purpose: it needs no browser and no login, so it covers admin-only pages that
 * the least-privilege e2e account cannot reach.
 *
 * Exits 0 on clean, 1 on violations.
 *
 * Usage:
 *   bun scripts/check-page-roots.ts
 */
import { readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const SRC = join(ROOT, 'src')

/** Every `() => import('@/...vue')` in the router: all routed components, nested ones included. */
async function routedComponents(): Promise<string[]> {
  const router = await readFile(join(SRC, 'router', 'index.ts'), 'utf8')
  const found = new Set<string>()
  for (const m of router.matchAll(/import\(\s*['"]@\/([^'"]+\.vue)['"]\s*\)/g)) {
    found.add(join(SRC, m[1]))
  }
  return [...found]
}

/** Class of the component's root element; looks through an <AppLayout> wrapper. */
function rootClass(source: string): string | null {
  const tpl = source.match(/<template>([\s\S]*?)<\/template>\s*(?:<script|<style|$)/)
  if (!tpl) { return null }
  const html = tpl[1].replace(/<!--[\s\S]*?-->/g, '')
  const tags = [...html.matchAll(/<([A-Za-z][\w-]*)\b([^>]*)>/g)]
  for (const t of tags) {
    if (/^(AppLayout|app-layout|ErrorBoundary|error-boundary)$/.test(t[1])) { continue }
    const cls = t[2].match(/(?:^|\s)class="([^"]+)"/)
    return cls ? cls[1].trim().split(/\s+/)[0] : null
  }
  return null
}

/** Declaration blocks of top-level rules only (media queries and other at-rules are skipped). */
function topLevelRules(css: string): Array<{ selector: string; body: string; index: number }> {
  const out: Array<{ selector: string; body: string; index: number }> = []
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length))
  let depth = 0
  let selStart = 0
  let bodyStart = 0
  let selector = ''
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '{') {
      if (depth === 0) { selector = clean.slice(selStart, i).trim(); bodyStart = i + 1 }
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        if (!selector.startsWith('@')) { out.push({ selector, body: clean.slice(bodyStart, i), index: selStart }) }
        selStart = i + 1
      }
    }
  }
  return out
}

const hasProp = (body: string, prop: string): boolean =>
  new RegExp(`(?:^|[;{\\s])${prop}\\s*:`, 'i').test(body)

const autoMargins = (body: string): boolean =>
  /(?:^|[;{\s])margin\s*:[^;]*\bauto\b/i.test(body) || /(?:^|[;{\s])margin-(?:left|right|inline(?:-start|-end)?)\s*:\s*auto/i.test(body)

let violations = 0
for (const file of await routedComponents()) {
  let source: string
  try { source = await readFile(file, 'utf8') } catch { continue }
  const cls = rootClass(source)
  if (!cls) { continue }

  for (const style of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const rule of topLevelRules(style[1])) {
      const selectors = rule.selector.split(',').map((s) => s.trim())
      if (!selectors.includes(`.${cls}`)) { continue }
      if (hasProp(rule.body, 'max-width') && autoMargins(rule.body) && !hasProp(rule.body, 'width')) {
        const line = source.slice(0, source.indexOf(style[1]) + rule.index).split('\n').length
        violations++
        console.error(
          `${relative(ROOT, file).replace(/\\/g, '/')}:${line}  .${cls} sets max-width with auto margins but no width: ` +
            'inside the flex-column page container it shrink-wraps its content (add width: 100%)'
        )
      }
    }
  }
}

if (violations) {
  console.error(`\n${violations} page root(s) would shrink-wrap. See scripts/check-page-roots.ts.`)
  process.exit(1)
}
console.log('page roots: ok')
