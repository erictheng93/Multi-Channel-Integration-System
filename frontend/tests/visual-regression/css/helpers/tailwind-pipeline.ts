/**
 * The compile harness: runs the app's REAL CSS toolchain over content we choose,
 * and turns the emitted CSS into deterministic, diffable data.
 *
 * VERSION AWARENESS
 * -----------------
 * Tailwind 3 and Tailwind 4 have completely different entry points, and this
 * layer exists specifically to be run across that boundary. Nothing
 * version-specific may be imported statically, because a static
 * `import 'tailwindcss/loadConfig'` throws at module-eval time under v4 and a
 * static `import '@tailwindcss/postcss'` throws under v3 - either way the whole
 * suite dies at collection and detects nothing.
 *
 *   v3: `tailwindcss` is the PostCSS plugin; the config is passed to it as an
 *       object loaded via `tailwindcss/loadConfig`; layers come from
 *       `@tailwind base/components/utilities`; candidates come from `content`.
 *   v4: `@tailwindcss/postcss` is the PostCSS plugin; there is no `loadConfig`
 *       and the config is reached from inside the CSS via `@config`; layers come
 *       from `@import "tailwindcss"`; candidates come from `@source inline(...)`.
 *
 * On autoprefixer: v3's `postcss.config.js` runs `tailwindcss` then
 * `autoprefixer`; this harness runs Tailwind only, because autoprefixer's output
 * is a function of the resolved browserslist and the `caniuse-lite` data version
 * and would churn the baselines on unrelated dependency bumps.
 * `postcss-pipeline.test.ts` asserts the real plugin list for the installed
 * major, so a change to the real pipeline fails loudly instead of silently
 * invalidating the harness.
 */
import postcss from 'postcss'
import type { AcceptedPlugin, AtRule, ChildNode, Container, Declaration, Rule } from 'postcss'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { FRONTEND_ROOT, compareAscii, readTextFile } from './repo-files'

const requireFromHere = createRequire(import.meta.url)

/** Absolute path to the app's Tailwind config. */
export const TAILWIND_CONFIG_PATH = resolve(FRONTEND_ROOT, 'tailwind.config.js')

/** Absolute path to the app's global stylesheet. */
export const APP_STYLESHEET_PATH = resolve(FRONTEND_ROOT, 'src', 'style.css')

/**
 * Synthetic `from` path for compiles that are not tied to a real file. It sits
 * at the frontend root so relative `@config` / `@import` resolution behaves the
 * way it does for the app's own stylesheets. The file never has to exist.
 */
const HARNESS_CSS_PATH = resolve(FRONTEND_ROOT, '__css-regression-harness.css')

/** Installed Tailwind version string, for failure messages. */
export const TAILWIND_VERSION: string = readInstalledTailwindVersion()

/** Installed Tailwind major, read straight off the installed package. */
export const TAILWIND_MAJOR: number = readInstalledTailwindMajor()

function readInstalledTailwindVersion(): string {
  const manifest = resolve(FRONTEND_ROOT, 'node_modules', 'tailwindcss', 'package.json')
  const parsed = JSON.parse(readTextFile(manifest)) as { version?: unknown }
  if (typeof parsed.version !== 'string') {
    throw new Error(`Could not read a version from ${manifest}`)
  }
  return parsed.version
}

function readInstalledTailwindMajor(): number {
  const major = Number.parseInt(TAILWIND_VERSION.split('.')[0] ?? '', 10)
  if (!Number.isInteger(major)) {
    throw new Error(`Could not determine a major version from "${TAILWIND_VERSION}"`)
  }
  return major
}

/** A single emitted CSS rule, flattened. */
export interface EmittedRule {
  /** At-rule context (outermost first), e.g. `['@media (min-width: 768px)']`. */
  readonly context: readonly string[]
  /** Whitespace-normalised selector, or the at-rule params for `@font-face`. */
  readonly selector: string
  /** `prop: value` strings in source order, `!important` included. */
  readonly declarations: readonly string[]
}

export interface CompileResult {
  /** Raw CSS as emitted by Tailwind. */
  readonly css: string
  /** Flattened rules, unsorted (source order). */
  readonly rules: readonly EmittedRule[]
  /** Every class name that appears in a selector of a rule that has declarations. */
  readonly emittedClassNames: ReadonlySet<string>
  /** Class name -> every rule whose selector mentions it. */
  readonly rulesByClass: ReadonlyMap<string, readonly EmittedRule[]>
}

type TailwindConfigLike = Record<string, unknown>

// ---------------------------------------------------------------------------
// Version-specific plugin / config loading
// ---------------------------------------------------------------------------

type PluginFactory = (_options: unknown) => AcceptedPlugin

let cachedFactory: PluginFactory | null = null
let cachedConfig: TailwindConfigLike | null = null

/**
 * Load a package by a specifier that is only valid for one Tailwind major.
 *
 * Resolution goes through `createRequire` rather than a static `import`, for two
 * reasons: the bundler never sees the specifier, so a package that is not
 * installed for the current major fails only if it is actually reached rather
 * than at transform or collection time; and Node's resolver is used directly, so
 * behaviour does not depend on Vite's externalisation heuristics. Both Tailwind
 * majors ship CommonJS entry points; the dynamic `import` is a fallback in case
 * that ever changes.
 */
async function loadPackage(specifier: string): Promise<Record<string, unknown>> {
  try {
    return requireFromHere(specifier) as Record<string, unknown>
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (code === 'ERR_REQUIRE_ESM') {
      return (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>
    }
    throw error
  }
}

function defaultExport(module: Record<string, unknown>): unknown {
  return 'default' in module ? module.default : module
}

async function pluginFactory(): Promise<PluginFactory> {
  if (cachedFactory !== null) {
    return cachedFactory
  }

  const specifier = TAILWIND_MAJOR >= 4 ? '@tailwindcss/postcss' : 'tailwindcss'
  const factory = defaultExport(await loadPackage(specifier))

  if (typeof factory !== 'function') {
    throw new Error(`"${specifier}" did not export a callable PostCSS plugin factory`)
  }

  cachedFactory = factory as PluginFactory
  return cachedFactory
}

/**
 * Load `tailwind.config.js` the way Tailwind 3 does.
 *
 * Through Tailwind's own jiti-based `loadConfig`, which is what the real v3
 * build uses and the only loader that provides a working `require` inside this
 * ESM config file.
 *
 * Not available on v4: there the config is reached through the `@config`
 * directive inside the CSS, exactly as `src/style.css` does on the Tailwind 4
 * branch. Callers that need config values on both majors read the file
 * textually instead.
 */
export async function loadAppTailwindConfig(): Promise<TailwindConfigLike> {
  if (TAILWIND_MAJOR >= 4) {
    throw new Error(
      `Tailwind ${TAILWIND_VERSION} has no "tailwindcss/loadConfig"; the config is reached ` +
        'through the @config directive in the CSS. Read tailwind.config.js textually instead.'
    )
  }

  if (cachedConfig === null) {
    const load = defaultExport(await loadPackage('tailwindcss/loadConfig'))
    if (typeof load !== 'function') {
      throw new Error('"tailwindcss/loadConfig" did not export a callable loader')
    }
    cachedConfig = (load as (_path: string) => TailwindConfigLike)(TAILWIND_CONFIG_PATH)
  }

  return cachedConfig
}

// ---------------------------------------------------------------------------
// Compiling
// ---------------------------------------------------------------------------

interface CompileOptions {
  /** Candidate class names to make available to the compiler. */
  readonly candidates?: readonly string[]
  /** `from` path handed to PostCSS; drives relative `@config` / `@reference`. */
  readonly from?: string
}

/** Run PostCSS with the version-appropriate Tailwind plugin over `input`. */
async function run(input: string, options: CompileOptions): Promise<string> {
  const factory = await pluginFactory()
  const candidates = options.candidates ?? []
  const from = options.from ?? HARNESS_CSS_PATH

  let source = input
  let pluginOptions: unknown

  if (TAILWIND_MAJOR >= 4) {
    source = withInlineSources(input, candidates)
    pluginOptions = { base: FRONTEND_ROOT }
  } else {
    pluginOptions = {
      ...(await loadAppTailwindConfig()),
      content: [{ raw: candidates.join(' '), extension: 'html' }],
    }
  }

  const result = await postcss([factory(pluginOptions)]).process(source, { from })
  return result.css.replace(/\r\n?/g, '\n')
}

/**
 * True when a candidate can be carried in a Tailwind 4 `@source inline("...")`.
 *
 * The directive is delimited by double quotes and applies brace expansion to its
 * argument, so a candidate containing `"`, `{`, `}`, a backslash or whitespace
 * would be mangled or would terminate the string. Nothing that fails this test
 * can be a real Tailwind class - these are fragments the low-confidence `.ts`
 * string-literal scan picks up, such as `input[type="text"]`. Single quotes are
 * fine, which matters because `content-['']` is a genuine utility this app uses.
 *
 * `silent-drop.test.ts` asserts that every guarded utility passes this test, so a
 * real class can never be dropped here without a loud failure.
 */
export function isExpressibleAsInlineSource(candidate: string): boolean {
  return !/["{}\\\s]/.test(candidate)
}

/**
 * Append a Tailwind 4 `@source inline(...)` directive carrying the candidates.
 *
 * Inexpressible fragments are skipped rather than fatal: aborting the whole
 * compile because a `.ts` file contains the string `input[type="text"]` would
 * take the silent-drop detector offline on v4, which is precisely the version it
 * matters most on.
 */
function withInlineSources(input: string, candidates: readonly string[]): string {
  const expressible = candidates.filter(isExpressibleAsInlineSource)
  if (expressible.length === 0) {
    return input
  }

  return `${input}\n@source inline("${expressible.join(' ')}");\n`
}

/**
 * CSS that pulls in the utilities layer, for the installed major.
 *
 * The Tailwind 4 form MUST also import the theme layer. In v4 a candidate is
 * only valid if the design system knows the token it names, so without the theme
 * `bg-white`, `font-bold`, `ease-out`, `leading-normal` and every colour utility
 * generate nothing - which the silent-drop detector would report as 126 dropped
 * classes that are in fact perfectly fine. Preflight is deliberately left out so
 * this stays "just the utilities".
 */
function utilitiesEntry(): string {
  return TAILWIND_MAJOR >= 4
    ? '@import "tailwindcss/theme" layer(theme);\n' +
        '@import "tailwindcss/utilities" layer(utilities) source(none);\n' +
        '@config "./tailwind.config.js";\n'
    : '@tailwind utilities;\n'
}

/** CSS that pulls in theme + preflight + components + utilities. */
function fullEntry(): string {
  return TAILWIND_MAJOR >= 4
    ? '@import "tailwindcss" source(none);\n@config "./tailwind.config.js";\n'
    : '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n'
}

/**
 * Compile an explicit list of class candidates into the utilities layer only.
 *
 * This is what the silent-drop detector and the utility snapshot use: nothing
 * but the utilities those candidates produced.
 */
export async function compileUtilities(candidates: readonly string[]): Promise<CompileResult> {
  return analyse(await run(utilitiesEntry(), { candidates }))
}

/**
 * Compile theme, preflight, plugin components and utilities together.
 *
 * Needed for effective-value assertions: under Tailwind 4 a utility's real value
 * usually lives in a `var(--theme-token)` that only exists when the theme layer
 * is present, and the `--tw-*` defaults only exist when preflight is present.
 */
export async function compileFull(candidates: readonly string[]): Promise<CompileResult> {
  return analyse(await run(fullEntry(), { candidates }))
}

/**
 * Compile an arbitrary CSS string through Tailwind, exactly as the build would.
 *
 * `from` matters: Tailwind 4 resolves `@reference "../../style.css"` (which the
 * Tailwind 4 branch adds to every `@apply`-using SFC) relative to it. Pass the
 * real file path whenever the input came from a real file.
 */
export async function compileCss(
  input: string,
  candidates: readonly string[] = [],
  from?: string
): Promise<CompileResult> {
  return analyse(await run(input, from === undefined ? { candidates } : { candidates, from }))
}

/**
 * Class names that a stylesheet's own selectors define.
 *
 * Needed because Tailwind treats rules inside `@layer components` /
 * `@layer utilities` as candidates and purges the ones the content scan does
 * not see. To snapshot `src/style.css` on its own terms we hand its own class
 * names back to it as content.
 */
export function classNamesDefinedIn(css: string): string[] {
  const found = new Set<string>()
  postcss.parse(css).walkRules(rule => {
    for (const className of classNamesInSelector(normaliseWhitespace(rule.selector))) {
      found.add(className)
    }
  })
  return [...found].sort(compareAscii)
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Flatten a stylesheet into rules and collect the class names it defines.
 *
 * Nesting-aware, which Tailwind 4 requires. It emits things like
 *
 *   .outline-hidden {
 *     outline-style: none;
 *     @media (forced-colors: active) { outline: 2px solid transparent; }
 *     &:focus-visible { outline-width: 2px; }
 *   }
 *
 * where Tailwind 3 emitted flat rules. Both the nested at-rule and the nested
 * `&` rule have to stay attached to `.outline-hidden`, otherwise a conditional
 * branch silently detaches from the class it belongs to and no assertion can
 * reach it.
 */
export function analyse(css: string): CompileResult {
  const root = postcss.parse(css)
  const rules: EmittedRule[] = []
  const emittedClassNames = new Set<string>()
  const rulesByClass = new Map<string, EmittedRule[]>()

  const record = (entry: EmittedRule): void => {
    rules.push(entry)
    for (const className of classNamesInSelector(entry.selector)) {
      emittedClassNames.add(className)
      const bucket = rulesByClass.get(className)
      if (bucket === undefined) {
        rulesByClass.set(className, [entry])
      } else {
        bucket.push(entry)
      }
    }
  }

  const visit = (
    container: Container<ChildNode>,
    context: readonly string[],
    parentSelector: string
  ): void => {
    for (const node of container.nodes ?? []) {
      if (node.type === 'rule') {
        const rule = node as Rule
        const selector = resolveNesting(normaliseWhitespace(rule.selector), parentSelector)
        const declarations = ownDeclarations(rule)

        if (declarations.length > 0) {
          record({ context, selector, declarations })
        }
        visit(rule as unknown as Container<ChildNode>, context, selector)
        continue
      }

      if (node.type === 'atrule') {
        const atRule = node as AtRule
        const signature = normaliseWhitespace(
          atRule.params.length > 0 ? `@${atRule.name} ${atRule.params}` : `@${atRule.name}`
        )
        const declarations = ownDeclarations(atRule)

        if (declarations.length > 0) {
          if (parentSelector.length > 0) {
            // A conditional branch nested inside a rule: keep it attached to the
            // selector it qualifies, with the condition in the context.
            record({ context: [...context, signature], selector: parentSelector, declarations })
          } else {
            // `@font-face`, `@property`: declarations hang off the at-rule itself.
            rules.push({ context, selector: signature, declarations })
          }
        }

        // `@layer` is NOT part of the context. It only orders the cascade, never
        // conditions whether a rule applies, and Tailwind 4 wraps its whole
        // output in real cascade layers where Tailwind 3 emitted none. Treating
        // it as a condition would make every v4 rule look conditional and break
        // "is this the unconditional rule for this utility" everywhere.
        const nextContext = atRule.name === 'layer' ? context : [...context, signature]
        visit(atRule as unknown as Container<ChildNode>, nextContext, parentSelector)
      }
    }
  }

  visit(root as unknown as Container<ChildNode>, [], '')

  return { css, rules, emittedClassNames, rulesByClass }
}

/**
 * Resolve a nested selector against its parent, substituting `&`.
 *
 * A no-op at the top level, which is why Tailwind 3 output is unaffected.
 */
function resolveNesting(selector: string, parentSelector: string): string {
  if (parentSelector.length === 0) {
    return selector
  }
  return selector
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => (part.includes('&') ? part.split('&').join(parentSelector) : `${parentSelector} ${part}`))
    .join(', ')
}

/** `prop: value` for the direct declaration children of `node`. */
function ownDeclarations(node: Container<ChildNode>): string[] {
  const out: string[] = []
  for (const child of node.nodes ?? []) {
    if (child.type === 'decl') {
      const decl = child as Declaration
      const value = normaliseWhitespace(decl.value)
      out.push(`${decl.prop}: ${value}${decl.important ? ' !important' : ''}`)
    }
  }
  return out
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

const HEX_ESCAPE_RE = /^[0-9a-fA-F]{1,6}/

/**
 * Extract class names from a selector, honouring CSS escapes.
 *
 * `.md\:hover\:flex:hover`             -> `md:hover:flex`
 * `.w-1\/2`                            -> `w-1/2`
 * `.hover\:-translate-y-0\.5:hover`    -> `hover:-translate-y-0.5`
 * `.\32 xl\:flex`                      -> `2xl:flex`
 * `.bg-\[var\(--line-color\)\]`        -> `bg-[var(--line-color)]`
 * `.shadow-\[0_4px_16px_rgba\(0\2c 0\)\]` -> `shadow-[0_4px_16px_rgba(0,0)]`
 *
 * Numeric escapes (`\2c ` for a comma) are decoded anywhere in the name, not
 * just at the start: a backslash is only ever followed by a hex digit when it
 * introduces a numeric escape, because every character a class name actually
 * needs escaped (`: . / [ ] ( ) , % # ! + * = ~ ^ $ | ? space`) is non-alphanumeric.
 */
export function classNamesInSelector(selector: string): string[] {
  const out: string[] = []
  let index = 0

  while (index < selector.length) {
    const char = selector[index]

    if (char === '\\') {
      index += 2
      continue
    }

    if (char === '"' || char === "'") {
      index = skipString(selector, index)
      continue
    }

    if (char !== '.') {
      index += 1
      continue
    }

    const parsed = readClassName(selector, index + 1)
    index = parsed.end
    if (parsed.name.length > 0) {
      out.push(parsed.name)
    }
  }

  return out
}

/** Read one class name starting at `start` (just past the `.`). */
function readClassName(selector: string, start: number): { name: string; end: number } {
  let index = start
  let name = ''

  while (index < selector.length) {
    const current = selector[index]

    if (current === '\\') {
      const hex = HEX_ESCAPE_RE.exec(selector.slice(index + 1))

      if (hex !== null) {
        // Numeric escape: `\32 ` -> `2`, `\2c ` -> `,`. CSS allows one optional
        // whitespace terminator, which we consume when present.
        name += String.fromCodePoint(Number.parseInt(hex[0], 16))
        index += 1 + hex[0].length
        if (selector[index] === ' ') {
          index += 1
        }
        continue
      }

      const escaped = selector[index + 1]
      if (escaped === undefined) {
        index += 1
        break
      }
      name += escaped
      index += 2
      continue
    }

    if (/[a-zA-Z0-9_-]/.test(current ?? '')) {
      name += current
      index += 1
      continue
    }

    break
  }

  return { name, end: index }
}

/** True when `selector` is exactly `.<className>` and nothing else. */
export function isSingleClassSelector(selector: string, className: string): boolean {
  if (!selector.startsWith('.')) {
    return false
  }
  const parsed = readClassName(selector, 1)
  return parsed.end === selector.length && parsed.name === className
}

function skipString(selector: string, start: number): number {
  const quote = selector[start]
  let index = start + 1
  while (index < selector.length) {
    if (selector[index] === '\\') {
      index += 2
      continue
    }
    if (selector[index] === quote) {
      return index + 1
    }
    index += 1
  }
  return index
}

/**
 * Serialise rules into a stable, sorted, line-diffable stylesheet.
 *
 * Format (one block per rule, sorted by the whole block text):
 *
 *   [@media (max-width: 640px)] .card-header {
 *     align-items: stretch;
 *   }
 */
export function serialiseRules(rules: readonly EmittedRule[]): string {
  const blocks = rules.map(rule => {
    const prefix = rule.context.map(entry => `[${entry}]`).join('')
    const head = prefix.length > 0 ? `${prefix} ${rule.selector}` : rule.selector
    const body = rule.declarations.map(declaration => `  ${declaration};`).join('\n')
    return `${head} {\n${body}\n}`
  })

  return `${blocks.sort(compareAscii).join('\n')}\n`
}

/** Find the declarations of the first rule whose head matches exactly. */
export function findRule(
  result: CompileResult,
  selector: string,
  context: readonly string[] = []
): readonly string[] | null {
  for (const rule of result.rules) {
    if (rule.selector !== selector) {
      continue
    }
    if (rule.context.length !== context.length) {
      continue
    }
    if (rule.context.every((entry, position) => entry === context[position])) {
      return rule.declarations
    }
  }
  return null
}

/**
 * Declarations of the rule a single utility produced.
 *
 * Prefers the unconditional, single-class rule (`.rounded-full { ... }`) over
 * variant or media-query forms, so invariant assertions read naturally.
 *
 * Returns `null` when the utility emitted nothing at all - which is the
 * condition the silent-drop detector asserts on.
 */
export function utilityDeclarations(
  result: CompileResult,
  className: string
): readonly string[] | null {
  const candidates = result.rulesByClass.get(className)
  if (candidates === undefined || candidates.length === 0) {
    return null
  }

  const plain = candidates.find(
    rule => rule.context.length === 0 && isSingleClassSelector(rule.selector, className)
  )
  if (plain !== undefined) {
    return plain.declarations
  }

  const unconditional = candidates.find(rule => rule.context.length === 0)
  return (unconditional ?? candidates[0])?.declarations ?? null
}
