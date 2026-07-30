/**
 * TIER 1 - the silent-drop detector. VERSION-AGNOSTIC: this must run and pass on
 * every Tailwind major.
 *
 * The regression class this exists for: a utility that a template references
 * stops producing CSS, and nothing else in the toolchain notices. `vue-tsc`,
 * ESLint, Vitest and `vite build` are all green when a `class="..."` attribute
 * names a utility Tailwind no longer knows - the attribute is just a string.
 * Tailwind 4 renames or repurposes several v3 utilities (`flex-shrink-*` ->
 * `shrink-*`, `outline-none` -> `outline-hidden`, `shadow-sm` -> `shadow-xs`,
 * bare `rounded` -> `rounded-sm`), so this failure mode is not hypothetical.
 *
 * "Still emits at least one declaration" is a claim that means the same thing
 * under v3 and v4, which is exactly why it is the assertion carried across the
 * upgrade boundary. Byte-identical CSS comparison is not; that lives in
 * `css-snapshots.test.ts` and is gated to a single major.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { extractClassVocabulary } from './helpers/class-vocabulary'
import type { ClassVocabulary } from './helpers/class-vocabulary'
import {
  TAILWIND_MAJOR,
  TAILWIND_VERSION,
  compileUtilities,
  isExpressibleAsInlineSource,
} from './helpers/tailwind-pipeline'
import type { CompileResult } from './helpers/tailwind-pipeline'
import {
  REFRESH_HINT,
  baselineIsComparable,
  baselineList,
  baselineMajor,
  incomparableReason,
} from './helpers/baseline'
import { compareAscii } from './helpers/repo-files'

export const VOCABULARY_LIST = 'utility-vocabulary.txt'

const VOCABULARY_LIST_HEADER = [
  'Utilities used by this app that Tailwind compiled to CSS at baseline time.',
  '',
  'Every entry here MUST still emit at least one declaration, on EVERY Tailwind',
  'major. An entry that stops emitting is a silently broken class attribute: the',
  'markup still says the class, the build still succeeds, and the styling is',
  'simply gone.',
  '',
  'This list is deliberately NOT regenerated when the Tailwind major changes -',
  'that would discard the evidence of what the upgrade broke.',
  '',
  REFRESH_HINT,
]

let vocabulary: ClassVocabulary
let compiled: CompileResult
/** Vocabulary tokens that Tailwind currently turns into CSS. */
let recognized: string[]
/** The committed guarded list. */
let guarded: string[]

beforeAll(async () => {
  vocabulary = extractClassVocabulary()
  compiled = await compileUtilities([...vocabulary.attributeTokens, ...vocabulary.looseTokens])

  recognized = [...vocabulary.attributeTokens, ...vocabulary.looseTokens]
    .filter(token => compiled.emittedClassNames.has(token))
    .sort(compareAscii)

  guarded = baselineList(VOCABULARY_LIST, recognized, VOCABULARY_LIST_HEADER)
}, 120_000)

describe('class vocabulary extraction', () => {
  it('scans the whole frontend source tree', () => {
    // Guards against the extractor silently going blind (a changed glob, a
    // moved directory): if this drops to a handful of files, every other
    // assertion in this file becomes vacuous.
    expect(vocabulary.scannedFiles.length).toBeGreaterThan(500)
    expect(vocabulary.scannedFiles).toContain('index.html')
    expect(vocabulary.scannedFiles).toContain('src/style.css')
    expect(vocabulary.attributeTokens.length).toBeGreaterThan(2000)
  })

  it('produces a deterministic, sorted, de-duplicated vocabulary', () => {
    const again = extractClassVocabulary()
    expect(again.attributeTokens).toEqual(vocabulary.attributeTokens)
    expect(again.looseTokens).toEqual(vocabulary.looseTokens)

    expect([...vocabulary.attributeTokens].sort(compareAscii)).toEqual(vocabulary.attributeTokens)
    expect(new Set(vocabulary.attributeTokens).size).toBe(vocabulary.attributeTokens.length)
  })
})

describe('silent-drop detector', () => {
  it('has a populated baseline to guard', () => {
    expect(
      guarded.length,
      `Baseline ${VOCABULARY_LIST} is missing or empty. ${REFRESH_HINT}`
    ).toBeGreaterThan(400)
  })

  it('every guarded utility can actually be handed to the compiler', () => {
    // The Tailwind 4 path carries candidates in `@source inline("...")`, which
    // cannot express a token containing a double quote, a brace, a backslash or
    // whitespace. Those are skipped when compiling, so this asserts no GUARDED
    // utility is among them - otherwise a real class could look "dropped" purely
    // because the harness could not feed it in.
    const inexpressible = guarded.filter(className => !isExpressibleAsInlineSource(className))

    expect(
      inexpressible,
      `${inexpressible.length} guarded utility class(es) cannot be expressed as a Tailwind 4 ` +
        '@source inline() candidate, so the silent-drop detector cannot see them. Extend the ' +
        'harness before trusting this run.'
    ).toEqual([])
  })

  it('every utility in the committed vocabulary still emits CSS', () => {
    const dropped = guarded.filter(className => !compiled.emittedClassNames.has(className))
    const capturedUnder = baselineMajor(VOCABULARY_LIST)
    const crossMajor = capturedUnder !== null && capturedUnder !== TAILWIND_MAJOR

    const report =
      dropped.length === 0
        ? ''
        : [
            `${dropped.length} utility class(es) used by this app no longer emit any CSS ` +
              `under Tailwind ${TAILWIND_VERSION}.`,
            'These are silent failures: the class attributes still exist, the build',
            'still succeeds, and the styling is simply gone.',
            crossMajor
              ? `The baseline was captured under Tailwind ${capturedUnder}, so each of these ` +
                'is a migration task - find the replacement utility and update the markup.'
              : 'Nothing about the Tailwind version changed, so this is a local regression.',
            '',
            ...dropped.map(className => `  - ${className}`),
          ].join('\n')

    expect(dropped, report).toEqual([])
  })

  it('reports vocabulary that grew since the baseline was taken', ctx => {
    // Baseline freshness is a same-major concern. Across a major, "recognized
    // now but not in the baseline" is mostly the new major understanding tokens
    // the old one ignored, which says nothing about this app.
    if (!baselineIsComparable(VOCABULARY_LIST)) {
      ctx.skip(incomparableReason(VOCABULARY_LIST))
      return
    }

    // Not a regression, but an unguarded gap: newly used utilities are only
    // protected by the assertion above once they are in the committed list.
    const added = recognized.filter(className => !guarded.includes(className))

    const report =
      added.length === 0
        ? ''
        : [
            `${added.length} newly used utility class(es) are not covered by the baseline yet.`,
            REFRESH_HINT,
            '',
            ...added.map(className => `  + ${className}`),
          ].join('\n')

    expect(added, report).toEqual([])
  })
})
