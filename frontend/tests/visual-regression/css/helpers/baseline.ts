/**
 * Reading and refreshing the committed baselines.
 *
 * Every baseline records the Tailwind major it was captured under, in the file
 * itself, because that decides how much of it is meaningful:
 *
 * - the guarded utility list is version-AGNOSTIC. "This class still emits CSS"
 *   holds across a major, and is the assertion worth carrying over the boundary.
 * - the compiled-CSS snapshots are same-major ONLY. Tailwind 4 expresses
 *   identical rendering through real cascade layers, theme custom properties and
 *   `color-mix()`, so a cross-major byte comparison is thousands of lines of
 *   noise. Tests gate on `baselineIsComparable` and skip with a visible reason.
 *
 * Set `UPDATE_CSS_BASELINE=1` (or run the update script) to rewrite the
 * baselines from the current pipeline instead of comparing against them. That is
 * refused when the installed major differs from the recorded one, so a major
 * upgrade cannot quietly bless away a dropped utility; pass
 * `UPDATE_CSS_BASELINE_MAJOR=<n>` to do it deliberately.
 *
 * Everything is written LF-only so the files are byte-identical on every OS.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BASELINE_DIR, pathExists, readTextFile } from './repo-files'
import { TAILWIND_MAJOR, TAILWIND_VERSION } from './tailwind-pipeline'

/** True when the run should rewrite baselines rather than assert against them. */
export const UPDATE_BASELINES = process.env.UPDATE_CSS_BASELINE === '1'

/** Marker key recorded in every baseline. */
const MAJOR_KEY = 'tailwind-major'

/** Absolute path of a baseline file. */
export function baselinePath(name: string): string {
  return resolve(BASELINE_DIR, name)
}

/**
 * The Tailwind major a committed baseline was captured under, or `null` when the
 * file is missing or carries no marker.
 */
export function baselineMajor(name: string): number | null {
  const path = baselinePath(name)
  if (!pathExists(path)) {
    return null
  }

  const match = new RegExp(`${MAJOR_KEY}:\\s*(\\d+)`).exec(readTextFile(path))
  const digits = match?.[1]
  return digits === undefined ? null : Number.parseInt(digits, 10)
}

/**
 * True when the committed baseline can be compared byte-for-byte against the
 * current pipeline output.
 *
 * Always true in update mode, otherwise a baseline that has no marker yet could
 * never acquire one: the gate would skip the test before it wrote anything.
 */
export function baselineIsComparable(name: string): boolean {
  return UPDATE_BASELINES || baselineMajor(name) === TAILWIND_MAJOR
}

/** Reason to show when a snapshot comparison is skipped. */
export function incomparableReason(name: string): string {
  const recorded = baselineMajor(name)
  return (
    `SKIPPED: baseline ${name} was captured under Tailwind ${recorded ?? 'unknown'} but the ` +
    `installed version is ${TAILWIND_VERSION}. Byte-identical CSS snapshots are same-major ` +
    'only: Tailwind 4 expresses identical rendering through cascade layers, theme custom ' +
    'properties and color-mix(), so a cross-major diff is thousands of lines of noise. The ' +
    'silent-drop detector and the design-system invariants DO run across majors and are the ' +
    'checks that matter here.'
  )
}

/** Guard so an update run cannot silently re-baseline across a major. */
function assertUpdateAllowed(name: string): void {
  const recorded = baselineMajor(name)
  const allowed = process.env.UPDATE_CSS_BASELINE_MAJOR

  if (recorded === null || recorded === TAILWIND_MAJOR) {
    return
  }

  if (allowed !== undefined && Number.parseInt(allowed, 10) === TAILWIND_MAJOR) {
    return
  }

  throw new Error(
    `Refusing to rewrite ${name}: it was captured under Tailwind ${recorded} and the ` +
      `installed version is ${TAILWIND_VERSION}. Re-baselining across a major would ` +
      'discard the evidence of what the upgrade changed, including any utility that ' +
      `stopped emitting CSS. Set UPDATE_CSS_BASELINE_MAJOR=${TAILWIND_MAJOR} to do it on purpose.`
  )
}

/**
 * Return the text a test should compare against.
 *
 * In update mode the baseline is rewritten with `actual` and the written body is
 * returned, so the assertion in the test trivially passes. In normal mode the
 * committed file is returned with its marker line stripped (empty string when it
 * does not exist, so the assertion fails with a readable diff rather than an
 * exception).
 */
export function baselineText(name: string, actual: string): string {
  const path = baselinePath(name)

  if (UPDATE_BASELINES) {
    assertUpdateAllowed(name)
    mkdirSync(BASELINE_DIR, { recursive: true })
    const body = normalise(actual)
    writeFileSync(path, `/* ${MAJOR_KEY}: ${TAILWIND_MAJOR} */\n${body}`, 'utf8')
    return body
  }

  if (!pathExists(path)) {
    return ''
  }

  return readTextFile(path).replace(new RegExp(`^/\\* ${MAJOR_KEY}: \\d+ \\*/\\n`), '')
}

/**
 * Same contract as `baselineText`, for a newline-separated list. `#` comment
 * lines and blank lines are stripped on read and re-added on write.
 */
export function baselineList(
  name: string,
  actual: readonly string[],
  header: readonly string[] = []
): string[] {
  const path = baselinePath(name)

  if (UPDATE_BASELINES) {
    assertUpdateAllowed(name)
    mkdirSync(BASELINE_DIR, { recursive: true })
    const comments = [`${MAJOR_KEY}: ${TAILWIND_MAJOR}`, '', ...header].map(line =>
      line.length > 0 ? `# ${line}` : '#'
    )
    writeFileSync(path, normalise([...comments, ...actual].join('\n')), 'utf8')
    return [...actual]
  }

  if (!pathExists(path)) {
    return []
  }

  return readTextFile(path)
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
}

function normalise(content: string): string {
  const lf = content.replace(/\r\n?/g, '\n')
  return lf.endsWith('\n') ? lf : `${lf}\n`
}

/** Standard hint appended to every baseline-mismatch failure message. */
export const REFRESH_HINT =
  'If this change is intended, refresh the baselines with: ' +
  'bun tests/visual-regression/css/scripts/update-baseline.ts'
