/**
 * TIER 2 - byte-identical compiled-CSS snapshots. SAME-MAJOR ONLY.
 *
 * Within one Tailwind major these are the sharpest tool in the layer: they catch
 * "same class name, different value" changes that no name-based check can see -
 * a shadow value edited in `tailwind.config.js`, a colour scale shifted, an
 * `@apply` that resolved to something different than it used to.
 *
 * Across a major they are worthless. Tailwind 4 renders the same design through
 * real cascade layers, theme custom properties, `color-mix()` opacity and
 * registered `@property` defaults, so effectively every line differs while
 * nothing looks different. Comparing anyway would bury the two or three real
 * findings under thousands of lines of noise, so these tests skip with an
 * explicit reason when the baseline's recorded major does not match the
 * installed one. What still runs across the boundary is
 * `silent-drop.test.ts` and `design-system-invariants.test.ts`.
 *
 * Two separate snapshots, compiled with different content lists so they cannot
 * churn each other:
 * - `utility-vocabulary.css` - the utilities the app's own class vocabulary
 *   produces. Changes when templates change.
 * - `app-stylesheet.css` - preflight, the `@tailwindcss/forms` rules and every
 *   `@apply`-derived rule in `src/style.css`. Changes when the design system
 *   changes.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { extractClassVocabulary } from './helpers/class-vocabulary'
import {
  APP_STYLESHEET_PATH,
  classNamesDefinedIn,
  compileCss,
  compileUtilities,
  serialiseRules,
} from './helpers/tailwind-pipeline'
import {
  REFRESH_HINT,
  baselineIsComparable,
  baselineText,
  incomparableReason,
} from './helpers/baseline'
import { readTextFile } from './helpers/repo-files'

const VOCABULARY_CSS = 'utility-vocabulary.css'
const APP_STYLESHEET_CSS = 'app-stylesheet.css'

let utilityCss: string
let appStylesheetCss: string

beforeAll(async () => {
  const vocabulary = extractClassVocabulary()
  const utilities = await compileUtilities([
    ...vocabulary.attributeTokens,
    ...vocabulary.looseTokens,
  ])
  utilityCss = serialiseRules(utilities.rules)

  // The content list is the stylesheet's OWN class names, not the template
  // globs: this snapshot is about what `src/style.css` and the plugins
  // contribute, not about which utilities templates happen to reference today.
  // The class names have to be fed back in because Tailwind treats
  // `@layer components` / `@layer utilities` rules as candidates and purges the
  // ones no content mentions.
  const styleCss = readTextFile(APP_STYLESHEET_PATH)
  const stylesheet = await compileCss(styleCss, classNamesDefinedIn(styleCss), APP_STYLESHEET_PATH)
  appStylesheetCss = serialiseRules(stylesheet.rules)
}, 120_000)

describe('compiled CSS snapshots', () => {
  it('utility declarations match the committed baseline', ctx => {
    if (!baselineIsComparable(VOCABULARY_CSS)) {
      ctx.skip(incomparableReason(VOCABULARY_CSS))
      return
    }

    const expected = baselineText(VOCABULARY_CSS, utilityCss)
    expect(
      expected.length,
      `Baseline ${VOCABULARY_CSS} is missing or empty. ${REFRESH_HINT}`
    ).toBeGreaterThan(0)

    expectSameStylesheet(utilityCss, expected, VOCABULARY_CSS)
  })

  it('app stylesheet (preflight, forms plugin, @apply output) matches the committed baseline', ctx => {
    if (!baselineIsComparable(APP_STYLESHEET_CSS)) {
      ctx.skip(incomparableReason(APP_STYLESHEET_CSS))
      return
    }

    const expected = baselineText(APP_STYLESHEET_CSS, appStylesheetCss)
    expect(
      expected.length,
      `Baseline ${APP_STYLESHEET_CSS} is missing or empty. ${REFRESH_HINT}`
    ).toBeGreaterThan(0)

    expectSameStylesheet(appStylesheetCss, expected, APP_STYLESHEET_CSS)
  })
})

/**
 * Compare two serialised stylesheets. On mismatch the failure message lists the
 * first differing lines, which is far more useful than a diff of a
 * tens-of-thousands-of-characters string.
 */
function expectSameStylesheet(actual: string, expected: string, name: string): void {
  if (actual === expected) {
    expect(actual).toBe(expected)
    return
  }

  const actualLines = new Set(actual.split('\n'))
  const expectedLines = new Set(expected.split('\n'))
  const removed = [...expectedLines].filter(line => !actualLines.has(line))
  const added = [...actualLines].filter(line => !expectedLines.has(line))

  const report = [
    `Compiled CSS drifted from baseline ${name}.`,
    REFRESH_HINT,
    '',
    `Lines only in the baseline (lost or changed), showing up to 40 of ${removed.length}:`,
    ...removed.slice(0, 40).map(line => `  - ${line}`),
    '',
    `Lines only in the current output (new or changed), showing up to 40 of ${added.length}:`,
    ...added.slice(0, 40).map(line => `  + ${line}`),
  ].join('\n')

  expect(actual, report).toBe(expected)
}
