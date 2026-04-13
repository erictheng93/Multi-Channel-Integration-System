#!/usr/bin/env bun
/**
 * ============================================================================
 * Scoped .btn Redefinition Guard
 * ============================================================================
 *
 * Flags Vue components that redefine the global `.btn` button classes inside
 * their scoped `<style>` blocks. These redefinitions conflict with the
 * Apple-native button system defined in `src/style.css` and cause the
 * "flash of wrong styles" issue (scoped loads first, global loads second).
 *
 * Rule: Do NOT redefine `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`,
 * `.btn-success`, `.btn-warning`, `.btn-ghost`, `.btn-sm`, or `.btn-lg` inside
 * component `<style>` blocks. These must only be defined once in the global
 * `src/style.css` file.
 *
 * Custom button classes (e.g., `.btn-close`, `.btn-icon`) are allowed.
 * Contextual/layout overrides like `.modal-footer .btn { margin: ... }` are
 * allowed because they compose rather than redefine.
 *
 * Exits 0 on clean, 1 on violations.
 *
 * Usage:
 *   bun scripts/check-scoped-btn.ts              # Scan all .vue files
 *   bun scripts/check-scoped-btn.ts path/to/file # Scan specific files
 * ============================================================================
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

// Forbidden standalone selectors (global button system classes)
const RESERVED_CLASSES = [
  'btn',
  'btn-primary',
  'btn-secondary',
  'btn-success',
  'btn-warning',
  'btn-danger',
  'btn-ghost',
  'btn-sm',
  'btn-lg',
] as const

interface Violation {
  file: string
  line: number
  selector: string
  snippet: string
}

function extractStyleBlocks(source: string): { content: string; startLine: number }[] {
  const blocks: { content: string; startLine: number }[] = []
  const regex = /<style[^>]*>([\s\S]*?)<\/style>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(source)) !== null) {
    const before = source.slice(0, match.index)
    const startLine = before.split('\n').length
    blocks.push({ content: match[1], startLine })
  }
  return blocks
}

/**
 * Track CSS brace nesting to determine if a rule is inside an at-rule block
 * (@media, @supports, @container). Rules inside these are responsive/feature
 * overrides and are allowed — only top-level redefinitions are violations.
 */
function scanFile(filePath: string, source: string): Violation[] {
  const violations: Violation[] = []
  const blocks = extractStyleBlocks(source)

  for (const block of blocks) {
    const lines = block.content.split('\n')
    // Track stack of open contexts: 'at-rule' or 'rule'
    const contextStack: ('at-rule' | 'rule')[] = []
    // Buffer the current selector being assembled across lines
    let pendingSelectorText = ''

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]
      // Remove comments from the line for parsing (simple inline strip)
      const line = rawLine.replace(/\/\*.*?\*\//g, '')
      const trimmed = line.trim()

      if (trimmed.length === 0 || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue
      }

      // Walk character by character to track brace nesting accurately
      for (let c = 0; c < line.length; c++) {
        const ch = line[c]
        if (ch === '{') {
          // Determine whether this opens an at-rule or a regular rule
          const selector = pendingSelectorText.trim()
          if (selector.startsWith('@media') || selector.startsWith('@supports') || selector.startsWith('@container')) {
            contextStack.push('at-rule')
          } else {
            contextStack.push('rule')
            // Only check for violations at TOP LEVEL (no at-rule ancestor)
            const insideAtRule = contextStack.slice(0, -1).some((c2) => c2 === 'at-rule')
            if (!insideAtRule) {
              const violation = checkSelectorForViolation(selector)
              if (violation !== null) {
                violations.push({
                  file: filePath,
                  line: block.startLine + i,
                  selector: violation,
                  snippet: trimmed,
                })
              }
            }
          }
          pendingSelectorText = ''
        } else if (ch === '}') {
          contextStack.pop()
          pendingSelectorText = ''
        } else {
          pendingSelectorText += ch
        }
      }
      // Newline — preserve accumulating selector across lines with a space
      if (pendingSelectorText.length > 0 && !pendingSelectorText.endsWith(' ')) {
        pendingSelectorText += ' '
      }
    }
  }

  return violations
}

/**
 * Given an already-assembled selector string (without the trailing `{`),
 * return the reserved class name if it is a standalone violation.
 */
function checkSelectorForViolation(selectorText: string): string | null {
  const selectors = selectorText.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  for (const selector of selectors) {
    const parts = selector.split(/\s+/)
    // Descendant combinator — allowed
    if (parts.length > 1) {continue}
    const lastPart = parts[0]
    // Compound selector (e.g., `.foo.btn`) — allowed
    const classMatches = lastPart.match(/\.[a-zA-Z_][a-zA-Z0-9_-]*/g) ?? []
    if (classMatches.length !== 1) {continue}
    const classOnly = classMatches[0].slice(1)
    if ((RESERVED_CLASSES as readonly string[]).includes(classOnly)) {
      return classOnly
    }
  }
  return null
}

async function walkVueFiles(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.vite' ||
        entry.name === 'coverage'
      ) {
        continue
      }
      await walkVueFiles(full, out)
    } else if (entry.name.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const root = resolve(import.meta.dir, '..')
  const srcDir = join(root, 'src')

  let files: string[]
  if (args.length > 0) {
    files = args.map((a) => resolve(a))
  } else {
    files = await walkVueFiles(srcDir)
  }

  const allViolations: Violation[] = []
  for (const file of files) {
    if (!file.endsWith('.vue')) {continue}
    const source = await readFile(file, 'utf-8')
    const violations = scanFile(file, source)
    allViolations.push(...violations)
  }

  if (allViolations.length === 0) {
    console.log(`Scoped .btn guard: OK (${files.length} files scanned)`)
    process.exit(0)
  }

  console.error('Scoped .btn guard: FAILED')
  console.error('')
  console.error(
    'The following Vue components redefine global button classes inside their <style> blocks.'
  )
  console.error(
    'Remove these redefinitions — the global button system lives in src/style.css.'
  )
  console.error('')

  const byFile = new Map<string, Violation[]>()
  for (const v of allViolations) {
    const existing = byFile.get(v.file) ?? []
    existing.push(v)
    byFile.set(v.file, existing)
  }

  for (const [file, violations] of byFile) {
    const rel = relative(process.cwd(), file)
    console.error(`  ${rel}`)
    for (const v of violations) {
      console.error(`    line ${v.line}: .${v.selector}`)
      console.error(`      ${v.snippet}`)
    }
    console.error('')
  }

  console.error(`Total violations: ${allViolations.length}`)
  console.error('')
  console.error('See docs/UIUX-Design-System.md and src/style.css for the canonical button system.')
  process.exit(1)
}

main().catch((err) => {
  console.error('check-scoped-btn.ts crashed:', err)
  process.exit(2)
})
