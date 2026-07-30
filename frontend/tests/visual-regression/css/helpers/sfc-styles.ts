/**
 * Locates Vue SFC `<style>` blocks that depend on `@apply`.
 *
 * Note the `<style>` scoping: `@apply="handler"` is a perfectly valid Vue
 * event binding (`v-on:apply`) and two views in this repo use it. Searching the
 * whole SFC for `@apply` therefore produces false positives - only the contents
 * of `<style>` blocks count.
 */
import { resolve } from 'node:path'
import { FRONTEND_ROOT, fromRepoRelative, listFiles, readTextFile } from './repo-files'

export interface SfcStyleSource {
  /** Repo-relative path, forward slashes. */
  readonly file: string
  /** Concatenated `<style>` block bodies for that file. */
  readonly css: string
  /** Number of `@apply` rules found. */
  readonly applyCount: number
}

const STYLE_BLOCK_RE = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi
const APPLY_RE = /@apply\s+[^;{}]+/g

/**
 * Every SFC under `src/` whose `<style>` blocks use `@apply`, sorted by path.
 *
 * Only plain CSS blocks are returned; a `lang="scss"`/`lang="sass"` block is
 * skipped because Tailwind is not the tool that would resolve it.
 */
export function findSfcsUsingApply(): SfcStyleSource[] {
  const out: SfcStyleSource[] = []

  for (const file of listFiles(resolve(FRONTEND_ROOT, 'src'), ['.vue'])) {
    const source = readTextFile(fromRepoRelative(file))
    const parts: string[] = []

    STYLE_BLOCK_RE.lastIndex = 0
    let match: RegExpExecArray | null = STYLE_BLOCK_RE.exec(source)

    while (match !== null) {
      const attributes = match[1] ?? ''
      const body = match[2] ?? ''
      const lang = /\blang\s*=\s*["']([^"']+)["']/.exec(attributes)?.[1] ?? 'css'

      if (lang === 'css' || lang === 'postcss') {
        parts.push(body)
      }

      match = STYLE_BLOCK_RE.exec(source)
    }

    const css = parts.join('\n')
    const applyCount = css.match(APPLY_RE)?.length ?? 0

    if (applyCount > 0) {
      out.push({ file, css, applyCount })
    }
  }

  return out
}
