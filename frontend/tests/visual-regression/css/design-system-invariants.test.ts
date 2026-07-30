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
 * The assertions that SHOULD fail on Tailwind 4 are the ones where appearance
 * genuinely changes, and they are marked as such:
 * - bare `ring` width 3px -> 1px
 * - preflight default border colour `gray-200` -> `currentColor`
 * - `outline-none` from a transparent visible outline -> `outline-style: none`
 */
import { beforeAll, describe, expect, it } from 'vitest'
import {
  APP_STYLESHEET_PATH,
  TAILWIND_VERSION,
  classNamesDefinedIn,
  compileFull,
  compileCss,
} from './helpers/tailwind-pipeline'
import type { CompileResult, EmittedRule } from './helpers/tailwind-pipeline'
import {
  canonicalColor,
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

/** Theme + preflight + plugin components + utilities, for effective values. */
let full: CompileResult
/** The app's own stylesheet, compiled with its own class names as content. */
let appStylesheet: CompileResult

beforeAll(async () => {
  full = await compileFull([...DESIGN_SYSTEM_CLASSES, ...FORMS_CLASSES])

  const styleCss = readTextFile(APP_STYLESHEET_PATH)
  appStylesheet = await compileCss(styleCss, classNamesDefinedIn(styleCss), APP_STYLESHEET_PATH)
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

describe('ring, border and outline defaults', () => {
  it('bare ring is 3px wide', () => {
    // EXPECTED TO FAIL ON TAILWIND 4: v4 changed the bare `ring` width to 1px.
    // Any focus ring in the app that relies on bare `ring` silently gets thinner,
    // which is a real appearance change and needs a decision, not a re-baseline.
    present(full, 'ring')
    expect(
      effectiveRingWidthPx(full, 'ring'),
      'Bare `ring` width changed. Tailwind 4 made it 1px; this design system was ' +
        'built on the 3px v3 default. Either pin it in the theme or switch the ' +
        'affected call sites to an explicit `ring-<n>`.'
    ).toBe(3)

    expect(effectiveRingWidthPx(full, 'ring-2')).toBe(2)
  })

  it('bare border is a 1px solid hairline', () => {
    present(full, 'border')
    expect(effectiveLengthPx(full, 'border', 'border-width')).toBe(1)

    // Where the style comes from differs by major and does not matter: v3 relies
    // on preflight's universal `border-style: solid`, v4 has the utility itself
    // set `border-style: var(--tw-border-style)`. What matters is that an element
    // with `border` ends up solid rather than invisible.
    const style =
      effectiveLonghand(full, 'border', 'border-style') ??
      universalEffectiveValue(full, 'border-style')
    expect(style).toBe('solid')
  })

  it('preflight still defaults the border colour to gray-200', () => {
    // EXPECTED TO FAIL ON TAILWIND 4: v4's preflight writes `border: 0 solid`,
    // whose omitted colour component resets border-color to `currentColor`. Every
    // `border` without an explicit colour then becomes a visible dark hairline -
    // a direct violation of the design system's "no hard 1px borders" rule.
    const declared = universalEffectiveValue(full, 'border-color')
    expect(declared, 'no universal border reset found in preflight').not.toBeNull()
    expect(
      canonicalColor(declared ?? ''),
      'The default border colour changed. Tailwind 4 resets it to currentColor, so ' +
        'every colourless `border` utility turns into a visible dark hairline. Set ' +
        '`--default-border-color` (or an explicit border colour) before merging.'
    ).toBe('rgb(229, 231, 235, 1)')
  })

  it('outline-none keeps a focusable outline box rather than removing the outline', () => {
    // EXPECTED TO FAIL ON TAILWIND 4: v3's `outline-none` emits
    // `outline: 2px solid transparent` - invisible but still occupying the outline
    // slot, which is what keeps forced-colours and high-contrast modes usable.
    // v4 renamed that behaviour to `outline-hidden` and made `outline-none` emit
    // `outline-style: none`, which removes the outline outright.
    present(full, 'outline-none')
    expect(
      effectiveLonghand(full, 'outline-none', 'outline-style'),
      '`outline-none` now removes the outline entirely. In Tailwind 4 the ' +
        'v3 behaviour is called `outline-hidden`; call sites that relied on a ' +
        'transparent-but-present outline for accessibility need updating.'
    ).not.toBe('none')
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

describe('@tailwindcss/forms plugin', () => {
  /**
   * The plugin's reset rule for a given `.form-*` class, located by behaviour
   * rather than by selector text.
   *
   * Tailwind 3 emits one grouped rule
   * (`.form-input,.form-textarea,.form-select,.form-multiselect`); Tailwind 4
   * emits a rule per class. Same styling either way, so the assertion asks per
   * class instead of matching the selector list.
   */
  function formsResetRule(className: string): EmittedRule | null {
    const candidates = full.rulesByClass.get(className) ?? []
    return (
      candidates.find(rule => rule.declarations.some(entry => entry === 'appearance: none')) ?? null
    )
  }

  it('still contributes its class-strategy rules', () => {
    for (const className of ['form-input', 'form-textarea', 'form-select', 'form-multiselect']) {
      expect(
        formsResetRule(className),
        `The @tailwindcss/forms reset for .${className} is gone. Either the plugin stopped ` +
          'loading (on Tailwind 4 it is reached through @config), or it stopped using ' +
          'addComponents for strategy: "class".'
      ).not.toBeNull()
    }
  })

  it('gives its inputs the expected reset geometry and colours', () => {
    const declarations = new Map<string, string>()
    for (const entry of formsResetRule('form-input')?.declarations ?? []) {
      const separator = entry.indexOf(':')
      declarations.set(entry.slice(0, separator).trim(), entry.slice(separator + 1).trim())
    }

    expect(canonicalColor(declarations.get('background-color') ?? '')).toBe('rgb(255, 255, 255, 1)')
    expect(canonicalColor(declarations.get('border-color') ?? '')).toBe('rgb(107, 114, 128, 1)')
    expect(declarations.get('border-width')).toBe('1px')
    expect(declarations.get('border-radius')).toBe('0px')
    expect(declarations.get('padding-top')).toBe('0.5rem')
    expect(declarations.get('padding-left')).toBe('0.75rem')
    expect(declarations.get('font-size')).toBe('1rem')
  })

  it('gives checkbox and radio their distinguishing radii', () => {
    expect(effectiveLengthPx(full, 'form-checkbox', 'border-radius')).toBe(0)
    expect(effectiveValue(full, 'form-radio', 'border-radius')).toBe('100%')
  })

  it('uses the class strategy, so it does not restyle bare form elements', () => {
    // `strategy: 'class'` is what keeps the plugin from fighting the app's own
    // `.form-*` component classes in src/style.css. Under the global strategy the
    // plugin emits a bare `[type='text'],[type='email'],...` selector list.
    // (Tailwind's own preflight contributes an unrelated `[type='search']` rule,
    // so the probe has to be narrower than "any [type= selector".)
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
