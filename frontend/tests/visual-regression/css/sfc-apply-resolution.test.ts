/**
 * `@apply` inside a Vue SFC `<style>` block must keep producing declarations.
 *
 * This is the "@reference trap": in Tailwind 4 each `<style>` block is its own
 * compilation unit with no access to the project theme unless it opens with
 * `@reference`. Without it, `@apply text-sm` either throws or resolves to
 * nothing depending on the exact setup - and a `<style scoped>` block that
 * silently emits an empty rule is invisible to every other gate.
 *
 * Two things are asserted per file:
 * 1. compiling the block does not throw (an unresolvable `@apply` is an error)
 * 2. it produces real declarations, and every rule that contained an `@apply`
 *    ends up non-empty
 */
import { beforeAll, describe, expect, it } from 'vitest'
import postcss from 'postcss'
import type { Container } from 'postcss'
import { compileCss } from './helpers/tailwind-pipeline'
import { findSfcsUsingApply } from './helpers/sfc-styles'
import type { SfcStyleSource } from './helpers/sfc-styles'
import { fromRepoRelative } from './helpers/repo-files'

/**
 * The SFCs known to depend on `@apply` at baseline time.
 *
 * Kept as a literal list so that a component quietly losing (or gaining) its
 * `@apply` usage is visible in review, and so this file cannot silently degrade
 * into asserting nothing.
 */
const EXPECTED_SFCS = [
  'src/components/conversation-list/CacheStatusIndicator.vue',
  'src/components/conversation-list/ConversationFilters.vue',
  'src/components/conversation/QuickAssignActions.vue',
  'src/components/conversation/TypingIndicator.vue',
  'src/components/team/TeamCard.vue',
  'src/components/team/TeamMemberCard.vue',
  'src/components/team/qr-section/TeamQRSection.vue',
  'src/components/ui/SkeletonLoader.vue',
  'src/views/ConversationList.vue',
]

let discovered: SfcStyleSource[]

beforeAll(() => {
  discovered = findSfcsUsingApply()
})

describe('SFC @apply discovery', () => {
  it('finds exactly the SFCs whose <style> blocks use @apply', () => {
    // Deliberately narrow: `@apply="handler"` is a valid Vue event binding and
    // src/views/ActivityLog.vue plus src/views/NotificationList.vue both use it.
    // Only `<style>` block contents count.
    expect(discovered.map(entry => entry.file)).toEqual(EXPECTED_SFCS)
  })

  it('accounts for every @apply call site', () => {
    const total = discovered.reduce((sum, entry) => sum + entry.applyCount, 0)
    expect(total).toBeGreaterThan(150)
  })
})

describe('SFC @apply resolution', () => {
  for (const file of EXPECTED_SFCS) {
    it(`${file} emits real declarations for its @apply rules`, async () => {
      const source = discovered.find(entry => entry.file === file)
      expect(source, `${file} no longer has an @apply-using <style> block`).toBeDefined()
      if (source === undefined) {
        return
      }

      // `from` is the real SFC path: Tailwind 4 resolves the `@reference
      // "../../style.css"` that the Tailwind 4 branch adds to these blocks
      // relative to it, and without that the block cannot see the theme at all.
      const compiled = await compileCss(source.css, [], fromRepoRelative(file))

      const declarationCount = compiled.rules.reduce(
        (sum, rule) => sum + rule.declarations.length,
        0
      )
      expect(
        declarationCount,
        `${file} compiled to zero declarations. @apply is no longer resolving in SFC ` +
          '<style> blocks - the component still renders, just unstyled.'
      ).toBeGreaterThan(0)

      const emptied = rulesThatLostTheirApply(source.css, compiled.css)
      expect(
        emptied,
        emptied.length === 0
          ? ''
          : [
              `${file}: ${emptied.length} rule(s) contained @apply but compiled to nothing:`,
              ...emptied.map(selector => `  - ${selector}`),
            ].join('\n')
      ).toEqual([])
    })
  }
})

/**
 * Selectors that had an `@apply` in the source but gained no declaration in the
 * output.
 *
 * Compares against the raw compiled CSS rather than the flattened rule list,
 * because a rule that compiled to nothing is exactly the case the flattened list
 * drops on purpose.
 *
 * Coverage is prefix-based, not equality-based, and nesting-aware. Some
 * utilities legitimately expand into a descendant selector, and the two majors
 * express that differently:
 *
 *   `@apply space-y-1` on `.skeleton-loader`
 *     v3: `.skeleton-loader > :not([hidden]) ~ :not([hidden]) { ... }`
 *     v4: `.skeleton-loader { :where(& > :not(:last-child)) { ... } }`
 *
 * Both leave `.skeleton-loader` itself with no declarations, and both are a
 * resolved `@apply`, not a lost one. Nested selectors are therefore flattened by
 * substituting `&` before coverage is checked.
 */
function rulesThatLostTheirApply(sourceCss: string, compiledCss: string): string[] {
  const applied = new Set<string>()
  postcss.parse(sourceCss).walkRules(rule => {
    const hasApply = rule.nodes?.some(node => node.type === 'atrule' && node.name === 'apply')
    if (hasApply === true) {
      for (const part of selectorParts(rule.selector)) {
        applied.add(part)
      }
    }
  })

  const emitted = new Map<string, number>()
  for (const [selector, count] of flattenedRules(compiledCss)) {
    for (const part of selectorParts(selector)) {
      emitted.set(part, (emitted.get(part) ?? 0) + count)
    }
  }

  const covered = [...emitted.entries()].filter(([, count]) => count > 0).map(([part]) => part)

  return [...applied].filter(part => !covered.some(entry => covers(entry, part))).sort()
}

/** Flatten nested rules into `[resolvedSelector, ownDeclarationCount]` pairs. */
function flattenedRules(css: string): Array<[string, number]> {
  const out: Array<[string, number]> = []

  const walk = (container: Container, parent: string): void => {
    for (const node of container.nodes ?? []) {
      if (node.type === 'atrule') {
        walk(node, parent)
        continue
      }
      if (node.type !== 'rule') {
        continue
      }

      const resolved = resolveNestedSelector(node.selector, parent)
      const count = node.nodes?.filter(child => child.type === 'decl').length ?? 0
      out.push([resolved, count])
      walk(node, resolved)
    }
  }

  walk(postcss.parse(css), '')
  return out
}

/** Substitute `&` (or imply a descendant combinator) against `parent`. */
function resolveNestedSelector(selector: string, parent: string): string {
  if (parent.length === 0) {
    return selector
  }
  return selectorParts(selector)
    .map(part => (part.includes('&') ? part.split('&').join(parent) : `${parent} ${part}`))
    .join(', ')
}

/** Split a selector list and normalise each part's whitespace. */
function selectorParts(selector: string): string[] {
  return selector
    .split(',')
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(part => part.length > 0)
}

/**
 * True when `emitted` is `source` itself or a selector derived from it.
 *
 * `source` has to appear as a whole compound selector, not as a substring, so
 * `.card` is not considered covered by `.card-header`. It may appear anywhere -
 * Tailwind 4 wraps expanded child selectors in `:where(...)`, giving
 * `:where(.skeleton-loader > :not(:last-child))` for an `@apply space-y-1` on
 * `.skeleton-loader`.
 */
function covers(emitted: string, source: string): boolean {
  if (emitted === source) {
    return true
  }

  const boundary = new Set([' ', '(', ')', '>', '+', '~', ',', ':', '[', ']'])

  for (let index = emitted.indexOf(source); index >= 0; index = emitted.indexOf(source, index + 1)) {
    const before = index === 0 ? ' ' : emitted.charAt(index - 1)
    const afterIndex = index + source.length
    const after = afterIndex >= emitted.length ? ' ' : emitted.charAt(afterIndex)

    if (boundary.has(before) && boundary.has(after)) {
      return true
    }
  }

  return false
}
