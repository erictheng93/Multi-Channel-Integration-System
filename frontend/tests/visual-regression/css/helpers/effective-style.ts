/**
 * Resolves what a utility EFFECTIVELY does, independent of how the CSS spells it.
 *
 * Why this exists: Tailwind 3 and Tailwind 4 express identical rendering very
 * differently. Asserting on declaration text therefore produces false alarms
 * across a major, which trains people to ignore the layer.
 *
 *   bg-[#007AFF]      v3: --tw-bg-opacity: 1; background-color: rgb(0 122 255 / var(--tw-bg-opacity, 1))
 *                     v4: background-color: #007AFF
 *   bg-white/80       v3: background-color: rgb(255 255 255 / 0.8)
 *                     v4: background-color: color-mix(in srgb, #fff 80%, transparent)
 *   backdrop-blur-xl  v3: --tw-backdrop-blur: blur(24px)
 *                     v4: --tw-backdrop-blur: blur(var(--blur-xl))   [--blur-xl: 24px]
 *   text-sm           v3: line-height: 1.25rem
 *                     v4: line-height: var(--tw-leading, 1.25rem)
 *
 * All four pairs render identically. This module substitutes custom properties
 * and canonicalises colours, lengths and durations so an invariant can assert
 * the rendered result and only fail when appearance would actually change.
 *
 * Deliberate limits, so nobody over-trusts it:
 * - `oklch()` / `oklab()` are not converted to sRGB (no colour-space maths here);
 *   they canonicalise to a normalised function string, so oklch-vs-hex
 *   comparisons report as a difference rather than silently passing.
 * - Cascade, specificity and inheritance are out of scope. This resolves ONE
 *   rule's declarations against the root/universal custom-property defaults.
 */
import type { CompileResult, EmittedRule } from './tailwind-pipeline'
import { isSingleClassSelector } from './tailwind-pipeline'

/** Custom-property name -> declared value. */
export type VariableScope = ReadonlyMap<string, string>

/** A custom property whose declared value means "fall back". */
const UNSET_VALUES = new Set(['initial', 'unset', '', ' '])

/**
 * Custom properties an arbitrary element inherits: everything declared on
 * `:root` / `:host`, on the universal selector, or as an `@property`
 * `initial-value`.
 *
 * Both majors put the `--tw-*` machinery defaults on the universal selector and
 * the theme tokens on the root, so one scope covers both.
 */
export function buildVariableScope(result: CompileResult): VariableScope {
  const scope = new Map<string, string>()

  for (const rule of result.rules) {
    if (isRootOrUniversal(rule.selector)) {
      for (const [property, value] of parseDeclarations(rule.declarations)) {
        if (property.startsWith('--')) {
          scope.set(property, value)
        }
      }
      continue
    }

    // `@property --tw-foo { initial-value: 0px }` - the registered default.
    const propertyName = /^@property (--[\w-]+)$/.exec(rule.selector)?.[1]
    if (propertyName !== undefined) {
      const initial = parseDeclarations(rule.declarations).get('initial-value')
      if (initial !== undefined && !scope.has(propertyName)) {
        scope.set(propertyName, initial)
      }
    }
  }

  return scope
}

function isRootOrUniversal(selector: string): boolean {
  return selector
    .split(',')
    .map(part => part.trim())
    .some(part => part === '*' || part.startsWith(':root') || part.startsWith(':host'))
}

/** `['color: red', ...]` -> `Map { 'color' => 'red' }`, later wins. */
function parseDeclarations(declarations: readonly string[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const declaration of declarations) {
    const separator = declaration.indexOf(':')
    if (separator < 0) {
      continue
    }
    out.set(
      declaration.slice(0, separator).trim(),
      declaration
        .slice(separator + 1)
        .replace(/\s*!important$/, '')
        .trim()
    )
  }
  return out
}

/**
 * Substitute every `var(--name, fallback)` in `value`.
 *
 * `own` (the same rule's own custom properties) wins over `scope` (root and
 * universal defaults), matching how the cascade would see it on that element.
 */
export function resolveVars(value: string, own: VariableScope, scope: VariableScope): string {
  let current = value

  for (let pass = 0; pass < 12; pass += 1) {
    const next = substituteOnce(current, own, scope)
    if (next === current) {
      return current
    }
    current = next
  }

  return current
}

function substituteOnce(value: string, own: VariableScope, scope: VariableScope): string {
  const start = value.indexOf('var(')
  if (start < 0) {
    return value
  }

  const end = matchingParen(value, start + 'var('.length - 1)
  if (end < 0) {
    return value
  }

  const args = value.slice(start + 'var('.length, end)
  const comma = topLevelComma(args)
  const name = (comma < 0 ? args : args.slice(0, comma)).trim()
  const fallback = comma < 0 ? undefined : args.slice(comma + 1).trim()

  const declared = own.get(name) ?? scope.get(name)
  const usable = declared !== undefined && !UNSET_VALUES.has(declared.trim())
  const replacement = usable ? declared : (fallback ?? '')

  return `${value.slice(0, start)}${replacement}${value.slice(end + 1)}`
}

/** Index of the `)` matching the `(` at `openIndex`. */
function matchingParen(value: string, openIndex: number): number {
  let depth = 0
  for (let index = openIndex; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

/** Index of the first comma at paren depth 0, or -1. */
function topLevelComma(value: string): number {
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth -= 1
    } else if (char === ',' && depth === 0) {
      return index
    }
  }
  return -1
}

// ---------------------------------------------------------------------------
// Per-utility accessors
// ---------------------------------------------------------------------------

/** The rule a utility produced without any variant or media condition. */
function plainRule(result: CompileResult, className: string): EmittedRule | null {
  const candidates = result.rulesByClass.get(className)
  if (candidates === undefined) {
    return null
  }
  return (
    candidates.find(
      rule => rule.context.length === 0 && isSingleClassSelector(rule.selector, className)
    ) ??
    candidates.find(rule => rule.context.length === 0) ??
    candidates[0] ??
    null
  )
}

/**
 * Every property a utility effectively sets, with custom properties substituted.
 *
 * Returns `null` when the utility emitted nothing - the silent-drop condition.
 */
export function effectiveDeclarations(
  result: CompileResult,
  className: string
): ReadonlyMap<string, string> | null {
  const rule = plainRule(result, className)
  if (rule === null) {
    return null
  }

  const own = parseDeclarations(rule.declarations)
  const scope = buildVariableScope(result)
  const out = new Map<string, string>()

  for (const [property, value] of own) {
    out.set(property, collapse(resolveVars(value, own, scope)))
  }

  return out
}

/** One effective property value, or `null` if the utility or property is absent. */
export function effectiveValue(
  result: CompileResult,
  className: string,
  property: string
): string | null {
  const declarations = effectiveDeclarations(result, className)
  if (declarations === null) {
    return null
  }
  return declarations.get(property) ?? null
}

/**
 * One effective property value, consulting `border` / `outline` shorthands.
 *
 * Tailwind 3 writes `outline: 2px solid transparent` for `outline-none` while
 * Tailwind 4 writes `outline-style: none` - the same longhand, reached two ways,
 * with genuinely different rendering. Asking for the longhand makes that
 * comparable.
 */
export function effectiveLonghand(
  result: CompileResult,
  className: string,
  property: string
): string | null {
  const declarations = effectiveDeclarations(result, className)
  if (declarations === null) {
    return null
  }

  const direct = declarations.get(property)
  if (direct !== undefined) {
    return direct
  }

  for (const [declaredProperty, value] of declarations) {
    const expanded = expandBoxShorthand(declaredProperty, value)[property]
    if (expanded !== undefined) {
      return expanded
    }
  }

  return null
}

/** One effective property value canonicalised as `rgb(r, g, b, a)`. */
export function effectiveColor(
  result: CompileResult,
  className: string,
  property: string
): string | null {
  const value = effectiveValue(result, className, property)
  return value === null ? null : canonicalColor(value)
}

/** One effective property value canonicalised to pixels. */
export function effectiveLengthPx(
  result: CompileResult,
  className: string,
  property: string
): number | null {
  const value = effectiveValue(result, className, property)
  return value === null ? null : canonicalLengthPx(value)
}

/** One effective property value canonicalised to milliseconds. */
export function effectiveDurationMs(
  result: CompileResult,
  className: string,
  property: string
): number | null {
  const value = effectiveValue(result, className, property)
  return value === null ? null : canonicalDurationMs(value)
}

/**
 * The box-shadow a `shadow-*` utility contributes, with `--tw-shadow-color` and
 * friends resolved. Both majors funnel it through `--tw-shadow`.
 */
export function effectiveShadow(result: CompileResult, className: string): string | null {
  return effectiveValue(result, className, '--tw-shadow')
}

/**
 * Ring width in pixels.
 *
 * Both majors build `--tw-ring-shadow` as
 * `<inset> 0 0 0 calc(<width> + var(--tw-ring-offset-width)) <color>`, so the
 * first length inside the `calc()` is the ring width. Tailwind 4 changed the
 * bare `ring` width from 3px to 1px, which this reports as a number.
 */
export function effectiveRingWidthPx(result: CompileResult, className: string): number | null {
  const shadow = effectiveValue(result, className, '--tw-ring-shadow')
  if (shadow === null) {
    return null
  }

  const calcStart = shadow.indexOf('calc(')
  if (calcStart >= 0) {
    const end = matchingParen(shadow, calcStart + 'calc('.length - 1)
    const inner = end < 0 ? shadow.slice(calcStart) : shadow.slice(calcStart + 5, end)
    for (const token of inner.split(/\s*\+\s*/)) {
      const px = canonicalLengthPx(token.trim())
      if (px !== null && px > 0) {
        return px
      }
    }
    return 0
  }

  // No calc(): fall back to the fourth length in the shadow list.
  const lengths = shadow
    .split(/\s+/)
    .map(token => canonicalLengthPx(token))
    .filter((px): px is number => px !== null)
  return lengths[3] ?? null
}

/**
 * The effective value of `property` for an arbitrary element, from the universal
 * reset rules only (Tailwind's preflight).
 *
 * `border` shorthands are expanded, because Tailwind 4's preflight writes
 * `border: 0 solid` where Tailwind 3 wrote an explicit `border-color`. Per the
 * CSS shorthand rules, omitting the colour resets it to `currentColor` - a real
 * appearance change that a text comparison would report as mere reshuffling.
 */
export function universalEffectiveValue(result: CompileResult, property: string): string | null {
  const scope = buildVariableScope(result)
  let found: string | null = null

  for (const rule of result.rules) {
    if (rule.context.length > 0 || !mentionsUniversal(rule.selector)) {
      continue
    }

    for (const [declaredProperty, value] of parseDeclarations(rule.declarations)) {
      const resolved = collapse(resolveVars(value, new Map(), scope))

      if (declaredProperty === property) {
        found = resolved
        continue
      }

      const expanded = expandBoxShorthand(declaredProperty, resolved)[property]
      if (expanded !== undefined) {
        found = expanded
      }
    }
  }

  return found
}

function mentionsUniversal(selector: string): boolean {
  return selector
    .split(',')
    .map(part => part.trim())
    .some(part => part === '*')
}

/**
 * Expand `border` / `outline: <width> <style> <color>` into their longhands,
 * filling omitted components with their initial values as the CSS shorthand
 * rules require.
 *
 * This is why Tailwind 4's preflight `border: 0 solid` is a real change and not
 * a reshuffle: omitting the colour resets `border-color` to `currentColor`,
 * whereas Tailwind 3 wrote `border-color: #e5e7eb` explicitly.
 */
function expandBoxShorthand(property: string, value: string): Record<string, string> {
  if (property !== 'border' && property !== 'outline') {
    return {}
  }

  const tokens = value.split(/\s+/).filter(token => token.length > 0)
  const styles = new Set([
    'none',
    'hidden',
    'dotted',
    'dashed',
    'solid',
    'double',
    'groove',
    'ridge',
    'inset',
    'outset',
  ])

  let width = 'medium'
  let style = 'none'
  let color = 'currentcolor'

  for (const token of tokens) {
    if (styles.has(token)) {
      style = token
    } else if (canonicalLengthPx(token) !== null || /^(thin|medium|thick)$/.test(token)) {
      width = token
    } else {
      color = token
    }
  }

  return {
    [`${property}-width`]: width,
    [`${property}-style`]: style,
    [`${property}-color`]: color,
  }
}

/**
 * Canonicalise a `box-shadow` value so the two majors are comparable.
 *
 * Lengths become explicit pixels and colours become canonical `rgb()`, which
 * removes exactly the differences that are representation-only (Tailwind 4 wraps
 * the colour in `var(--tw-shadow-color, ...)`) while preserving any real change
 * to offset, blur, spread or colour.
 */
export function canonicalShadow(value: string): string | null {
  const input = collapse(value)
  if (input.length === 0) {
    return null
  }
  if (input === 'none' || /^0 0 #0+$/.test(input)) {
    return 'none'
  }

  const layers: string[] = []
  let depth = 0
  let current = ''

  for (const char of input) {
    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth -= 1
    }
    if (char === ',' && depth === 0) {
      layers.push(current)
      current = ''
      continue
    }
    current += char
  }
  layers.push(current)

  return layers.map(layer => canonicalShadowLayer(layer)).join(', ')
}

function canonicalShadowLayer(layer: string): string {
  const parts: string[] = []
  let depth = 0
  let current = ''

  for (const char of collapse(layer)) {
    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth -= 1
    }
    if (char === ' ' && depth === 0) {
      if (current.length > 0) {
        parts.push(current)
      }
      current = ''
      continue
    }
    current += char
  }
  if (current.length > 0) {
    parts.push(current)
  }

  return parts
    .map(part => {
      if (part === 'inset') {
        return part
      }
      const px = canonicalLengthPx(part)
      if (px !== null) {
        return `${px}px`
      }
      return canonicalColor(part) ?? part
    })
    .join(' ')
}

// ---------------------------------------------------------------------------
// Canonicalisers
// ---------------------------------------------------------------------------

const NAMED_COLORS: Record<string, [number, number, number, number]> = {
  transparent: [0, 0, 0, 0],
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
  red: [255, 0, 0, 1],
}

/**
 * Canonicalise a colour to `rgb(r, g, b, a)`.
 *
 * Understands hex (3/4/6/8 digit), `rgb()` / `rgba()` in both comma and space
 * syntax, the named colours this design system uses, and the
 * `color-mix(in <space>, <color> <p>%, transparent)` form Tailwind 4 emits for
 * opacity modifiers. `currentcolor` passes through as itself. Anything else
 * (notably `oklch()`) is normalised but not converted, so it will not silently
 * compare equal to an sRGB colour.
 */
export function canonicalColor(value: string): string | null {
  const input = collapse(value).toLowerCase()

  if (input.length === 0) {
    return null
  }

  if (input === 'currentcolor' || input === 'inherit') {
    return input
  }

  const named = NAMED_COLORS[input]
  if (named !== undefined) {
    return formatRgb(named)
  }

  const hex = parseHex(input)
  if (hex !== null) {
    return formatRgb(hex)
  }

  const rgb = parseRgbFunction(input)
  if (rgb !== null) {
    return formatRgb(rgb)
  }

  const mixed = parseColorMix(input)
  if (mixed !== null) {
    return formatRgb(mixed)
  }

  // Unconvertible (oklch, gradients, ...). Normalised so it compares stably but
  // never equals an sRGB canonical form.
  return input.replace(/\s*,\s*/g, ', ')
}

function parseHex(input: string): [number, number, number, number] | null {
  const match = /^#([0-9a-f]{3,8})$/.exec(input)
  const digits = match?.[1]
  if (digits === undefined) {
    return null
  }

  const expand = (pair: string): number => Number.parseInt(pair, 16)

  if (digits.length === 3 || digits.length === 4) {
    const [r, g, b, a] = [...digits].map(char => expand(`${char}${char}`))
    return [r ?? 0, g ?? 0, b ?? 0, a === undefined ? 1 : a / 255]
  }

  if (digits.length === 6 || digits.length === 8) {
    const parts: number[] = []
    for (let index = 0; index < digits.length; index += 2) {
      parts.push(expand(digits.slice(index, index + 2)))
    }
    const [r, g, b, a] = parts
    return [r ?? 0, g ?? 0, b ?? 0, a === undefined ? 1 : a / 255]
  }

  return null
}

function parseRgbFunction(input: string): [number, number, number, number] | null {
  const match = /^rgba?\((.*)\)$/.exec(input)
  const body = match?.[1]
  if (body === undefined) {
    return null
  }

  const slash = body.indexOf('/')
  const head = slash < 0 ? body : body.slice(0, slash)
  const alphaText = slash < 0 ? undefined : body.slice(slash + 1)

  const parts = head
    .split(/[\s,]+/)
    .map(token => token.trim())
    .filter(token => token.length > 0)

  if (parts.length < 3) {
    return null
  }

  const channels = parts.slice(0, 3).map(parseChannel)
  if (channels.some(channel => channel === null)) {
    return null
  }

  const alphaSource = alphaText ?? parts[3]
  const alpha = alphaSource === undefined ? 1 : parseAlpha(alphaSource)
  if (alpha === null) {
    return null
  }

  const [r, g, b] = channels as number[]
  return [r ?? 0, g ?? 0, b ?? 0, alpha]
}

function parseColorMix(input: string): [number, number, number, number] | null {
  const match = /^color-mix\(in [\w-]+, (.+) ([\d.]+)%, transparent\)$/.exec(input)
  const colorText = match?.[1]
  const percentText = match?.[2]
  if (colorText === undefined || percentText === undefined) {
    return null
  }

  const base = canonicalColor(colorText)
  if (base === null || !base.startsWith('rgb(')) {
    return null
  }

  const parsed = parseRgbFunction(base)
  if (parsed === null) {
    return null
  }

  const fraction = Number.parseFloat(percentText) / 100
  return [parsed[0], parsed[1], parsed[2], parsed[3] * fraction]
}

function parseChannel(token: string): number | null {
  if (token.endsWith('%')) {
    const percent = Number.parseFloat(token)
    return Number.isFinite(percent) ? Math.round((percent / 100) * 255) : null
  }
  const number = Number.parseFloat(token)
  return Number.isFinite(number) ? Math.round(number) : null
}

function parseAlpha(token: string): number | null {
  const trimmed = token.trim()
  if (trimmed.endsWith('%')) {
    const percent = Number.parseFloat(trimmed)
    return Number.isFinite(percent) ? percent / 100 : null
  }
  const number = Number.parseFloat(trimmed)
  return Number.isFinite(number) ? number : null
}

function formatRgb([r, g, b, a]: [number, number, number, number]): string {
  return `rgb(${r}, ${g}, ${b}, ${Number.parseFloat(a.toFixed(4))})`
}

/** Canonicalise a CSS length to pixels, assuming a 16px root font size. */
export function canonicalLengthPx(value: string): number | null {
  const input = collapse(value).toLowerCase()

  if (input === '0') {
    return 0
  }

  const match = /^(-?[\d.]+)(px|rem|em)$/.exec(input)
  const number = match?.[1]
  const unit = match?.[2]
  if (number === undefined || unit === undefined) {
    return null
  }

  const parsed = Number.parseFloat(number)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return unit === 'px' ? parsed : parsed * 16
}

/** Canonicalise a CSS time to milliseconds. */
export function canonicalDurationMs(value: string): number | null {
  const input = collapse(value).toLowerCase()
  const match = /^(-?[\d.]+)(ms|s)$/.exec(input)
  const number = match?.[1]
  const unit = match?.[2]
  if (number === undefined || unit === undefined) {
    return null
  }

  const parsed = Number.parseFloat(number)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return unit === 'ms' ? parsed : parsed * 1000
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
