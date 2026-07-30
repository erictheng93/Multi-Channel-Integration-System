/**
 * TIER 3 - Design-system invariants. VERSION-AGNOSTIC by construction.
 *
 * `css-snapshots.test.ts` catches everything within a major, but it catches it
 * as diff noise. This file states the token values the "Apple-Native Soft
 * Minimalism" system (`docs/UIUX-Design-System.md`) actually depends on, so a
 * reviewer reads intent instead of a diff.
 *
 * The assertions are written against EFFECTIVE values, not declaration text.
 * Tailwind 3 and Tailwind 4 spell identical rendering very differently:
 *
 *   bg-[#007AFF]      v3: --tw-bg-opacity: 1; background-color: rgb(0 122 255 / var(...))
 *                     v4: background-color: #007AFF
 *   bg-white/80       v3: rgb(255 255 255 / 0.8)
 *                     v4: color-mix(in srgb, #fff 80%, transparent)
 *   backdrop-blur-xl  v3: blur(24px)
 *                     v4: blur(var(--blur-xl))
 *
 * All three pairs render identically, so asserting the text would produce false
 * alarms on the v4 branch and train people to ignore this layer. Custom
 * properties are substituted and colours / lengths / durations canonicalised, so
 * these tests fail only when the rendered result would actually change.
 *
 * THE RULE: an invariant may fail only when THIS APPLICATION'S rendered result
 * would change. Not when the toolchain expresses the same result differently, and
 * not when the app stops using a utility. Both of those are noise, and noise is
 * how a suite dies.
 *
 * Applied one level further out than declaration text: where Tailwind 4 changed a
 * default that the app then compensates for in `src/style.css`, the assertion is
 * phrased against an element compiled through the real stylesheet, not against
 * what preflight or a utility emits in isolation. Tailwind 4 changed three
 * defaults here - default border colour, `outline-none` semantics, bare `ring`
 * width - and all three are asserted as "what does the app end up with", so they
 * pass on Tailwind 3 AND on the fixed Tailwind 4 branch, and fail if the
 * compensation is removed.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import {
  APP_STYLESHEET_PATH,
  TAILWIND_MAJOR,
  TAILWIND_VERSION,
  classNamesDefinedIn,
  compileFull,
  compileCss,
} from './helpers/tailwind-pipeline'
import type { CompileResult } from './helpers/tailwind-pipeline'
import {
  canonicalColor,
  canonicalLengthPx,
  canonicalShadow,
  effectiveColor,
  effectiveDeclarations,
  effectiveDurationMs,
  effectiveLengthPx,
  effectiveLonghand,
  effectiveRingWidthPx,
  effectiveShadow,
  effectiveValue,
  universalEffectiveValue,
} from './helpers/effective-style'
import { readTextFile } from './helpers/repo-files'
import { extractClassVocabulary } from './helpers/class-vocabulary'

/**
 * Design-system utilities compiled for this file. Listed explicitly rather than
 * harvested from the codebase: these must keep working whether or not a template
 * currently happens to use them.
 */
const DESIGN_SYSTEM_CLASSES = [
  // Shadow scale (custom `boxShadow` in tailwind.config.js).
  'shadow-sm',
  'shadow',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl',
  'shadow-inner',
  'shadow-none',
  'shadow-[0_4px_16px_rgba(0,0,0,0.04)]',
  // Radius scale (custom `borderRadius`).
  'rounded-none',
  'rounded-sm',
  'rounded',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-full',
  // Ring / border / outline defaults.
  'ring',
  'ring-2',
  'border',
  'outline-none',
  // Accent colours, as arbitrary values (how the app writes them).
  'bg-[#007AFF]',
  'bg-[#34C759]',
  'bg-[#FF9500]',
  'bg-[#FF3B30]',
  'bg-[#F2F2F7]',
  'text-[#1C1C1E]',
  'text-[#8E8E93]',
  // Named colour scales.
  'bg-gray-50',
  'bg-gray-200',
  'text-primary-600',
  'bg-line',
  'bg-facebook',
  // Frosted-glass navigation bar.
  'bg-white/80',
  'backdrop-blur-xl',
  // Motion.
  'duration-fast',
  'duration-normal',
  'duration-slow',
  'duration-200',
  'duration-300',
  'ease-out',
  'transition-all',
  // Type scale.
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-2xl',
  // Spacing scale.
  'p-4',
  'p-5',
  'gap-4',
]

const FORMS_CLASSES = [
  'form-input',
  'form-textarea',
  'form-select',
  'form-multiselect',
  'form-checkbox',
  'form-radio',
]

/**
 * The utility names that mean "reset the focus outline", newest first.
 *
 * Tailwind 4 split Tailwind 3's `outline-none` into `outline-hidden` (keeps a
 * forced-colours fallback) and `outline-none` (removes the outline outright).
 * Which one this app uses is a fact about the app, so it is looked up rather
 * than assumed.
 */
const OUTLINE_RESET_UTILITIES = ['outline-hidden', 'outline-none'] as const

/** Theme + preflight + plugin components + utilities, for effective values. */
let full: CompileResult
/** The app's own stylesheet, compiled with its own class names as content. */
let appStylesheet: CompileResult
/** Every class name this app references anywhere in source. */
let usedInSource: ReadonlySet<string>

beforeAll(async () => {
  full = await compileFull([...DESIGN_SYSTEM_CLASSES, ...FORMS_CLASSES, ...OUTLINE_RESET_UTILITIES])

  // `border` is added to the candidate list so this compile can answer "what does
  // an element with a colourless `border` end up with, given the real
  // stylesheet". It is a separate compile from the one `css-snapshots.test.ts`
  // baselines, so widening it here cannot churn a baseline.
  const styleCss = readTextFile(APP_STYLESHEET_PATH)
  appStylesheet = await compileCss(
    styleCss,
    [...classNamesDefinedIn(styleCss), 'border'],
    APP_STYLESHEET_PATH
  )

  const vocabulary = extractClassVocabulary()
  usedInSource = new Set([...vocabulary.attributeTokens, ...vocabulary.looseTokens])
}, 120_000)

/** Assert the utility exists at all, with a message that names the failure mode. */
function present(result: CompileResult, className: string): ReadonlyMap<string, string> {
  const declarations = effectiveDeclarations(result, className)
  expect(
    declarations,
    `Utility "${className}" emitted no CSS at all under Tailwind ${TAILWIND_VERSION}. ` +
      'Either it was renamed or removed, or the design token it reads no longer exists.'
  ).not.toBeNull()
  return declarations ?? new Map()
}

/**
 * True when the utility puts an outline back under `forced-colors: active`.
 *
 * Tailwind 4 nests that branch inside the utility's own rule, which is why
 * `analyse` keeps nested at-rules attached to their parent selector.
 */
function hasForcedColoursOutline(result: CompileResult, className: string): boolean {
  for (const rule of result.rulesByClass.get(className) ?? []) {
    const forced = rule.context.some(entry => entry.includes('forced-colors'))
    if (!forced) {
      continue
    }
    const sets = rule.declarations.some(entry => /^outline(-style|-width)?:/.test(entry))
    if (sets && !/^outline(-style)?: none$/.test(rule.declarations[0] ?? '')) {
      return true
    }
  }
  return false
}

describe('boxShadow scale', () => {
  it('keeps every custom shadow value', () => {
    // The scale is pinned in tailwind.config.js. `shadow-sm` is also a Tailwind 4
    // rename target (v4's own default scale renamed it to `shadow-xs`), so this
    // both proves the name survives and that the value did not shift.
    const shadow = (className: string): string | null => {
      present(full, className)
      return canonicalShadow(effectiveShadow(full, className) ?? '')
    }

    expect(shadow('shadow-sm')).toBe('0px 1px 2px 0px rgb(0, 0, 0, 0.05)')
    expect(shadow('shadow')).toBe(
      '0px 1px 3px 0px rgb(0, 0, 0, 0.1), 0px 1px 2px -1px rgb(0, 0, 0, 0.1)'
    )
    expect(shadow('shadow-md')).toBe(
      '0px 4px 6px -1px rgb(0, 0, 0, 0.1), 0px 2px 4px -2px rgb(0, 0, 0, 0.1)'
    )
    expect(shadow('shadow-lg')).toBe(
      '0px 10px 15px -3px rgb(0, 0, 0, 0.1), 0px 4px 6px -4px rgb(0, 0, 0, 0.1)'
    )
    expect(shadow('shadow-xl')).toBe(
      '0px 20px 25px -5px rgb(0, 0, 0, 0.1), 0px 8px 10px -6px rgb(0, 0, 0, 0.1)'
    )
    expect(shadow('shadow-2xl')).toBe('0px 25px 50px -12px rgb(0, 0, 0, 0.25)')
    expect(shadow('shadow-inner')).toBe('inset 0px 2px 4px 0px rgb(0, 0, 0, 0.05)')
    expect(shadow('shadow-none')).toBe('none')
  })

  it('emits the soft card shadow the design system specifies, as an arbitrary value', () => {
    // docs/UIUX-Design-System.md prescribes a 4px/16px soft card shadow. The app
    // writes it as an arbitrary value, so the arbitrary-value path itself is
    // part of the contract.
    const arbitrary = 'shadow-[0_4px_16px_rgba(0,0,0,0.04)]'
    present(full, arbitrary)
    expect(canonicalShadow(effectiveShadow(full, arbitrary) ?? '')).toBe(
      '0px 4px 16px rgb(0, 0, 0, 0.04)'
    )
  })
})

describe('borderRadius scale', () => {
  it('keeps every custom radius value, in pixels', () => {
    // Bare `rounded` is a Tailwind 4 rename target (v4's own scale renamed it to
    // `rounded-sm`); tailwind.config.js pins the value on both majors.
    const radius = (className: string): number | null => {
      present(full, className)
      return effectiveLengthPx(full, className, 'border-radius')
    }

    expect(radius('rounded-none')).toBe(0)
    expect(radius('rounded-sm')).toBe(2)
    expect(radius('rounded')).toBe(6)
    expect(radius('rounded-md')).toBe(6)
    expect(radius('rounded-lg')).toBe(8)
    expect(radius('rounded-xl')).toBe(12)
    expect(radius('rounded-2xl')).toBe(16)
    expect(radius('rounded-3xl')).toBe(24)
  })

  it('rounded-full is a capsule, not a large radius', () => {
    // Capsule buttons and tags are a hard rule of the design system.
    present(full, 'rounded-full')
    expect(effectiveLengthPx(full, 'rounded-full', 'border-radius')).toBe(9999)
  })
})

describe('ring, border and outline as the app actually renders them', () => {
  // These three assertions are deliberately phrased against what an element ends
  // up with GIVEN THIS APP'S FULL STYLESHEET, not against what a utility or
  // preflight emits in isolation. Tailwind 4 changed all three defaults; the app
  // compensates for two of them in `src/style.css` and consciously accepted the
  // third. An invariant that measured the toolchain instead of the app would be a
  // permanent false red on the Tailwind 4 branch, and noise is how a suite dies.

  it('an element with a colourless border ends up with the gray-200 hairline', () => {
    // The design system's "no hard 1px borders" rule depends on this. Tailwind 3
    // gets it from preflight; Tailwind 4's preflight resets border-color to
    // `currentColor` via the `border: 0 solid` shorthand, and `src/style.css`
    // restores it in `@layer base`. Compiling through the real stylesheet is what
    // lets one assertion cover both, and what makes it fail if the compensating
    // reset is ever deleted.
    present(appStylesheet, 'border')
    expect(effectiveLengthPx(appStylesheet, 'border', 'border-width')).toBe(1)

    // The `border` utility itself must not set a colour - otherwise this test
    // would be measuring the utility rather than the inherited default.
    expect(effectiveLonghand(appStylesheet, 'border', 'border-color')).toBeNull()

    const inherited = universalEffectiveValue(appStylesheet, 'border-color')
    expect(
      inherited,
      'src/style.css produces no universal border-color reset at all, so every ' +
        'colourless `border` falls back to the browser default (currentColor).'
    ).not.toBeNull()
    expect(
      canonicalColor(inherited ?? ''),
      'An element with a colourless `border` no longer renders the gray-200 hairline ' +
        'this design system is built on. Tailwind 4 resets border-color to ' +
        'currentColor, which turns every such border into a hard dark line; ' +
        'src/style.css carries a base-layer reset to restore it. Check that reset ' +
        'still exists before changing this expectation.'
    ).toBe('rgb(229, 231, 235, 1)')
  })

  it('an element with a colourless border ends up solid', () => {
    // Where the style comes from differs by major and does not matter: v3 relies
    // on preflight's universal `border-style: solid`, v4 has the utility itself
    // set `border-style: var(--tw-border-style)`. What matters is that an element
    // with `border` ends up solid rather than invisible.
    const style =
      effectiveLonghand(appStylesheet, 'border', 'border-style') ??
      universalEffectiveValue(appStylesheet, 'border-style')
    expect(style).toBe('solid')
  })

  it('the outline reset the app uses keeps an outline present under forced colours', () => {
    // The accessibility behaviour, asserted on whichever utility the app actually
    // uses rather than on a fixed utility name:
    //   v3 `outline-none`   -> `outline: 2px solid transparent` unconditionally
    //   v4 `outline-hidden` -> `outline-style: none`, plus a nested
    //                          `@media (forced-colors: active)` branch that puts a
    //                          transparent 2px outline back
    //   v4 `outline-none`   -> `outline-style: none` and NOTHING else. This is the
    //                          regression, and it is what this test catches.
    const utility = OUTLINE_RESET_UTILITIES.find(name => usedInSource.has(name))
    expect(
      utility,
      `The app uses none of ${OUTLINE_RESET_UTILITIES.join(' / ')}. If the focus-reset ` +
        'utility was renamed again, teach this test the new name.'
    ).toBeDefined()
    if (utility === undefined) {
      return
    }

    present(full, utility)
    const unconditional = effectiveLonghand(full, utility, 'outline-style')
    const forcedColours = hasForcedColoursOutline(full, utility)

    expect(
      unconditional !== 'none' || forcedColours,
      `\`${utility}\` leaves an element with no outline at all, including under ` +
        'forced-colours mode. Tailwind 3 kept a transparent 2px outline occupying ' +
        'the outline slot; Tailwind 4 splits that into `outline-hidden` (keeps a ' +
        'forced-colours fallback) and `outline-none` (removes it outright). Every ' +
        'call site in this app is a focus style, so the fallback is the point.'
    ).toBe(true)
  })

  it('the ring widths the app relies on are unchanged', () => {
    // `ring-2` / `focus:ring-2` is what the app uses, on both majors.
    present(full, 'ring-2')
    expect(effectiveRingWidthPx(full, 'ring-2')).toBe(2)
  })

  it('records the accepted bare-ring width change, and the premise it rests on', () => {
    // DECISION (accepted, not a bug): Tailwind 4 takes the bare `ring` width from
    // 3px to 1px. It was accepted because this app has ZERO bare-`ring` call
    // sites - it uses `ring-2` / `focus:ring-2` throughout - so pinning the old
    // width would be config for something unused.
    //
    // The premise is the load-bearing part, so it is asserted: if bare `ring`
    // ever appears in source, the 1px width becomes visible and the decision
    // needs revisiting.
    expect(
      usedInSource.has('ring'),
      'This app now uses bare `ring` somewhere. The bare-ring width change from ' +
        '3px (Tailwind 3) to 1px (Tailwind 4) was accepted on the grounds that ' +
        'there were no call sites, so that decision needs revisiting: either use ' +
        'an explicit `ring-<n>` or pin the width in the theme.'
    ).toBe(false)

    // Version-aware expected value, so this documents the change instead of
    // reading as an unresolved failure.
    present(full, 'ring')
    expect(effectiveRingWidthPx(full, 'ring')).toBe(TAILWIND_MAJOR >= 4 ? 1 : 3)
  })
})

describe('accent colours', () => {
  it('resolves the iOS system accent hexes', () => {
    const background = (className: string): string | null => {
      present(full, className)
      return effectiveColor(full, className, 'background-color')
    }

    expect(background('bg-[#007AFF]')).toBe('rgb(0, 122, 255, 1)')
    expect(background('bg-[#34C759]')).toBe('rgb(52, 199, 89, 1)')
    expect(background('bg-[#FF9500]')).toBe('rgb(255, 149, 0, 1)')
    expect(background('bg-[#FF3B30]')).toBe('rgb(255, 59, 48, 1)')
  })

  it('resolves the page background and text colours', () => {
    present(full, 'bg-[#F2F2F7]')
    expect(effectiveColor(full, 'bg-[#F2F2F7]', 'background-color')).toBe('rgb(242, 242, 247, 1)')

    present(full, 'text-[#1C1C1E]')
    expect(effectiveColor(full, 'text-[#1C1C1E]', 'color')).toBe('rgb(28, 28, 30, 1)')

    present(full, 'text-[#8E8E93]')
    expect(effectiveColor(full, 'text-[#8E8E93]', 'color')).toBe('rgb(142, 142, 147, 1)')
  })

  it('keeps the custom named colour scales', () => {
    const background = (className: string): string | null => {
      present(full, className)
      return effectiveColor(full, className, 'background-color')
    }

    expect(background('bg-gray-50')).toBe('rgb(249, 250, 251, 1)')
    expect(background('bg-gray-200')).toBe('rgb(229, 231, 235, 1)')
    expect(background('bg-line')).toBe('rgb(0, 195, 0, 1)')
    expect(background('bg-facebook')).toBe('rgb(24, 119, 242, 1)')

    present(full, 'text-primary-600')
    expect(effectiveColor(full, 'text-primary-600', 'color')).toBe('rgb(37, 99, 235, 1)')
  })
})

describe('frosted-glass navigation bar', () => {
  it('bg-white/80 keeps its alpha channel', () => {
    // v3 writes `rgb(255 255 255 / 0.8)`, v4 writes
    // `color-mix(in srgb, #fff 80%, transparent)`. Same pixel, different spelling.
    present(full, 'bg-white/80')
    expect(effectiveColor(full, 'bg-white/80', 'background-color')).toBe('rgb(255, 255, 255, 0.8)')
  })

  it('backdrop-blur-xl is a 24px blur and sets both the prefixed and standard property', () => {
    const declarations = present(full, 'backdrop-blur-xl')
    expect(effectiveValue(full, 'backdrop-blur-xl', '--tw-backdrop-blur')).toBe('blur(24px)')
    expect([...declarations.keys()]).toContain('-webkit-backdrop-filter')
    expect([...declarations.keys()]).toContain('backdrop-filter')
  })
})

describe('motion', () => {
  it('keeps the custom transition durations', () => {
    const duration = (className: string): number | null => {
      present(full, className)
      return effectiveDurationMs(full, className, 'transition-duration')
    }

    expect(duration('duration-fast')).toBe(150)
    expect(duration('duration-normal')).toBe(250)
    expect(duration('duration-slow')).toBe(350)
  })

  it('keeps the numeric durations the design system asks for (200-350ms)', () => {
    present(full, 'duration-200')
    expect(effectiveDurationMs(full, 'duration-200', 'transition-duration')).toBe(200)
    present(full, 'duration-300')
    expect(effectiveDurationMs(full, 'duration-300', 'transition-duration')).toBe(300)
  })

  it('ease-out is the standard ease-out curve', () => {
    present(full, 'ease-out')
    expect(effectiveValue(full, 'ease-out', 'transition-timing-function')).toBe(
      'cubic-bezier(0, 0, 0.2, 1)'
    )
  })

  it('transition-all keeps its default duration and curve', () => {
    present(full, 'transition-all')
    expect(effectiveValue(full, 'transition-all', 'transition-property')).toBe('all')
    expect(effectiveDurationMs(full, 'transition-all', 'transition-duration')).toBe(150)
    expect(effectiveValue(full, 'transition-all', 'transition-timing-function')).toBe(
      'cubic-bezier(0.4, 0, 0.2, 1)'
    )
  })
})

describe('type and spacing scales', () => {
  it('keeps the custom fontSize pairs (size plus line-height), in pixels', () => {
    const pair = (className: string): [number | null, number | null] => {
      present(full, className)
      return [
        effectiveLengthPx(full, className, 'font-size'),
        effectiveLengthPx(full, className, 'line-height'),
      ]
    }

    expect(pair('text-xs')).toEqual([12, 16])
    expect(pair('text-sm')).toEqual([14, 20])
    expect(pair('text-base')).toEqual([16, 24])
    expect(pair('text-lg')).toEqual([18, 28])
    expect(pair('text-2xl')).toEqual([24, 32])
  })

  it('keeps the custom spacing scale, in pixels', () => {
    present(full, 'p-4')
    expect(effectiveLengthPx(full, 'p-4', 'padding')).toBe(16)
    present(full, 'p-5')
    expect(effectiveLengthPx(full, 'p-5', 'padding')).toBe(20)
    present(full, 'gap-4')
    expect(effectiveLengthPx(full, 'gap-4', 'gap')).toBe(16)
  })
})

describe('form controls', () => {
  // @tailwindcss/forms was removed during the tailwindcss 4 migration. Under v4
  // its legacy-plugin output landed in `layer=utilities` while the app's own
  // rules sit in `layer=components`, and layer precedence is absolute, so the
  // plugin won every conflicting property across 167 call sites. src/style.css
  // is now the sole definition of the field surface. These assertions guard
  // that surface and the absence of any competitor.

  /**
   * The field-surface declarations for a `.form-*` class.
   *
   * These live on a grouped selector (`.form-input, .form-textarea,
   * .form-select`), and the shared per-utility accessors prefer a selector that
   * is exactly one class - correct for utilities, wrong for a component rule
   * written as a selector list. Pseudo-element rules are excluded because
   * `::placeholder` styles a different box, not this element.
   */
  function fieldSurface(className: string): Map<string, string> {
    const merged = new Map<string, string>()
    for (const rule of appStylesheet.rulesByClass.get(className) ?? []) {
      if (rule.context.length > 0 || rule.selector.includes('::') || rule.selector.includes(':')) {
        continue
      }
      for (const entry of rule.declarations) {
        const separator = entry.indexOf(':')
        merged.set(entry.slice(0, separator).trim(), entry.slice(separator + 1).trim())
      }
    }
    return merged
  }

  it('keeps the design-system field surface, not a plugin reset', () => {
    // The exact values the plugin used to override, and why it mattered: a
    // gray-500 hairline and square corners are design-system violations.
    // Border colour and radius are the load-bearing pair: the plugin's reset used
    // gray-500 and 0px against the design system's gray-300 and 6px, so either
    // alone is enough to detect it coming back. Padding and font-size are
    // deliberately not asserted here - v4 emits them as `padding-block` with a
    // calc(var(--spacing) * n) value where v3 emitted resolved longhands, so
    // pinning them would assert representation rather than rendering. The pixel
    // layer covers the resulting geometry.
    const surface = fieldSurface('form-input')
    expect(canonicalColor(surface.get('border-color') ?? '')).toBe('rgb(209, 213, 219, 1)')
    expect(canonicalLengthPx(surface.get('border-radius') ?? '')).toBe(6)
    expect(canonicalLengthPx(surface.get('border-width') ?? '')).toBe(1)
  })

  it('applies that same surface to textarea and select', () => {
    for (const className of ['form-textarea', 'form-select']) {
      const surface = fieldSurface(className)
      expect(
        canonicalColor(surface.get('border-color') ?? ''),
        `.${className} no longer shares the field surface. It used to reach it via ` +
          '`@apply form-input`, which tailwindcss 4 silently resolved to something else ' +
          'because @apply only resolves utilities, not @layer components classes.'
      ).toBe('rgb(209, 213, 219, 1)')
      expect(canonicalLengthPx(surface.get('border-radius') ?? '')).toBe(6)
    }
  })

  it('keeps appearance:none, which .form-select depends on for its arrow', () => {
    // .form-select draws its own chevron via background-image. Without this the
    // native arrow returns and every select in the app renders two.
    expect(
      fieldSurface('form-select').get('appearance'),
      '.form-select lost `appearance: none`. This was absorbed from ' +
        '@tailwindcss/forms when that plugin was dropped; without it every select ' +
        'renders both the native arrow and the background-image chevron.'
    ).toBe('none')
  })

  it('keeps disabled inputs visually distinct from enabled ones', () => {
    // Under v4 the plugin's unconditional `background-color: #fff` outranked the
    // app's `disabled:bg-gray-50`, so disabled inputs rendered as enabled - a
    // usability regression, not a cosmetic one.
    // v4 can split one `disabled:` variant group across several rules, so merge
    // them rather than trusting the first match.
    const disabled = appStylesheet.rules
      .filter(rule => rule.selector.includes('form-input') && rule.selector.includes(':disabled'))
      .flatMap(rule => rule.declarations)

    expect(
      disabled.length,
      'No :disabled rule for .form-input survives in the compiled stylesheet.'
    ).toBeGreaterThan(0)

    const background = disabled
      .map(entry => /^background-color:(.*)$/.exec(entry)?.[1])
      .find(value => value !== undefined)
    expect(
      canonicalColor(background ?? ''),
      'Disabled inputs no longer get their grey fill, so they look identical to ' +
        'enabled ones. That is what @tailwindcss/forms caused by outranking ' +
        "src/style.css's `disabled:bg-gray-50` on cascade layer."
    ).toBe('rgb(249, 250, 251, 1)')
  })

  it('has no competing definition of the field surface', () => {
    // The regression this whole block exists for: a second source of .form-input
    // styling. Re-adding @tailwindcss/forms (or any plugin using addComponents
    // for .form-*) would reintroduce it, and on v4 the competitor wins on layer
    // precedence no matter what specificity src/style.css uses.
    const competitors = (appStylesheet.rulesByClass.get('form-input') ?? []).filter(rule =>
      rule.declarations.some(entry => entry.startsWith('appearance:'))
    )
    expect(
      competitors.length,
      'More than one rule sets `appearance` on .form-input, which means something ' +
        'other than src/style.css is defining the field surface again.'
    ).toBeLessThanOrEqual(1)
  })

  it('does not restyle bare form elements', () => {
    // Nothing should be emitting a global `[type='text']` reset. The removed
    // plugin only avoided this because it ran with strategy: 'class'.
    const globalSelectors = full.rules
      .map(rule => rule.selector)
      .filter(selector => selector.includes("[type='text']") || selector.includes('[type="text"]'))

    expect(globalSelectors).toEqual([])
  })
})

describe('Apple-native button system in src/style.css', () => {
  it('.btn keeps the 12px radius, flat surface and 250ms ease-out transition', () => {
    const declarations = present(appStylesheet, 'btn')

    expect(effectiveLengthPx(appStylesheet, 'btn', 'border-radius')).toBe(12)
    expect(effectiveLonghand(appStylesheet, 'btn', 'border-style')).toBe('none')
    expect(declarations.get('transition')).toBe(
      'background-color 250ms ease-out, color 250ms ease-out, opacity 150ms ease-out'
    )
    // No glow: the resting state must not carry a box-shadow at all.
    expect([...declarations.keys()]).not.toContain('box-shadow')
  })

  it('keeps the flat iOS system colours for every button variant', () => {
    const background = (className: string): string | null => {
      present(appStylesheet, className)
      return effectiveColor(appStylesheet, className, 'background-color')
    }

    expect(background('btn-primary')).toBe('rgb(0, 122, 255, 1)')
    expect(background('btn-success')).toBe('rgb(52, 199, 89, 1)')
    expect(background('btn-warning')).toBe('rgb(255, 149, 0, 1)')
    expect(background('btn-danger')).toBe('rgb(255, 59, 48, 1)')
    expect(background('btn-secondary')).toBe('rgb(242, 242, 247, 1)')

    expect(effectiveColor(appStylesheet, 'btn-secondary', 'color')).toBe('rgb(28, 28, 30, 1)')
    expect(effectiveColor(appStylesheet, 'btn-ghost', 'color')).toBe('rgb(0, 122, 255, 1)')
  })

  it('resolves @apply inside src/style.css component classes', () => {
    // `.card` is written entirely with @apply. If @apply stopped resolving, this
    // rule would come back empty while the build stayed green.
    present(appStylesheet, 'card')
    expect(effectiveLengthPx(appStylesheet, 'card', 'border-radius')).toBe(8)
    expect(effectiveColor(appStylesheet, 'card', 'background-color')).toBe('rgb(255, 255, 255, 1)')
    expect(canonicalShadow(effectiveShadow(appStylesheet, 'card') ?? '')).toBe(
      '0px 1px 2px 0px rgb(0, 0, 0, 0.05)'
    )
  })
})
