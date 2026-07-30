/**
 * Filesystem helpers for the compiled-CSS regression layer.
 *
 * Everything here is deterministic on purpose:
 * - directory listings are sorted with a fixed comparator
 * - paths are reported repo-relative with forward slashes (no absolute paths,
 *   no drive letters) so baselines are byte-identical across machines
 * - file contents are LF-normalised
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url))

/** Absolute path to `frontend/`. */
export const FRONTEND_ROOT = resolve(HELPERS_DIR, '..', '..', '..', '..')

/** Absolute path to `frontend/tests/visual-regression/css/`. */
export const CSS_LAYER_DIR = resolve(HELPERS_DIR, '..')

/** Absolute path to the committed baseline directory. */
export const BASELINE_DIR = resolve(CSS_LAYER_DIR, 'baseline')

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', '.vite', '.git'])

/** Normalise a path to a repo-relative, forward-slash form. */
export function toRepoRelative(absolutePath: string): string {
  return relative(FRONTEND_ROOT, absolutePath).split('\\').join('/')
}

/** Resolve a repo-relative path against `frontend/`. */
export function fromRepoRelative(relativePath: string): string {
  return resolve(FRONTEND_ROOT, relativePath)
}

/** Read a text file and normalise CRLF/CR to LF. */
export function readTextFile(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf8').replace(/\r\n?/g, '\n')
}

/** True when the path exists. */
export function pathExists(absolutePath: string): boolean {
  try {
    statSync(absolutePath)
    return true
  } catch {
    return false
  }
}

/**
 * Recursively list files under `absoluteDir` whose name ends with one of
 * `extensions`. Returns repo-relative paths sorted with a locale-independent
 * comparator.
 */
export function listFiles(absoluteDir: string, extensions: readonly string[]): string[] {
  const found: string[] = []

  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true })
    const names = entries.map(entry => entry.name).sort(compareAscii)

    for (const name of names) {
      if (SKIP_DIRECTORIES.has(name)) {
        continue
      }
      const child = join(dir, name)
      if (statSync(child).isDirectory()) {
        walk(child)
        continue
      }
      if (extensions.some(extension => name.endsWith(extension))) {
        found.push(toRepoRelative(child))
      }
    }
  }

  walk(absoluteDir)
  return found.sort(compareAscii)
}

/** Byte-order comparator; avoids locale-dependent `Array#sort` defaults. */
export function compareAscii(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  return a < b ? -1 : 1
}
