# Compiled-CSS regression layer

Headless, browser-free, backend-free regression tests for the CSS the app
actually ships. Runs under the normal Vitest setup:

```bash
bunx vitest run tests/visual-regression/css
```

Runs and produces meaningful results under **both Tailwind 3 and Tailwind 4**.
That is a hard requirement, not a nicety: the whole point is to be trustworthy
across the upgrade this layer was built to guard.

## Why this exists

`vue-tsc`, ESLint, Vitest and `vite build` are **all green** when the CSS
silently changes or disappears. A `class="..."` attribute is just a string: if
Tailwind stops recognising a utility named in it, no CSS is emitted, no error is
raised, and the layout quietly breaks.

## The three tiers

Not every check survives a major version, and pretending otherwise buries the
real findings in noise. The tiers are explicit about what they are worth.

| Tier | File | Scope | Catches |
|---|---|---|---|
| 1 | `silent-drop.test.ts` | **version-agnostic** | a utility this app **still references** stops emitting CSS at all (`flex-shrink-0`, `outline-none`, `shadow-sm`, bare `rounded` are all Tailwind 4 rename targets) |
| 2 | `css-snapshots.test.ts` | **same-major only** | same class name, different value - a shadow edited in the config, a colour scale shifted, an `@apply` that now resolves differently |
| 3 | `design-system-invariants.test.ts` | **version-agnostic** | the design system's token values, asserted as EFFECTIVE values so representation changes do not fire but appearance changes do |
| - | `sfc-apply-resolution.test.ts` | version-agnostic | `@apply` stops resolving in a Vue SFC `<style>` block (Tailwind 4's `@reference` trap) |
| - | `postcss-pipeline.test.ts` | version-aware | the real pipeline moved out from under the harness |

Tier 1 is the crown jewel. "This class still emits at least one declaration"
means the same thing under every major, so it is the assertion carried across the
upgrade boundary.

Tier 2 is gated. Each baseline records the major it was captured under
(`tailwind-major: 3`), and the snapshot tests skip with a visible reason when it
does not match the installed version. Tailwind 4 renders the same design through
real cascade layers, theme custom properties, `color-mix()` opacity and
registered `@property` defaults, so a cross-major byte diff is thousands of lines
for output that looks identical.

Tier 3 asserts **effective** values, via `helpers/effective-style.ts`: custom
properties are substituted and colours, lengths and durations canonicalised.
These pairs all render identically and none of them fires an alarm:

| utility | Tailwind 3 | Tailwind 4 |
|---|---|---|
| `bg-[#007AFF]` | `--tw-bg-opacity: 1; background-color: rgb(0 122 255 / var(--tw-bg-opacity, 1))` | `background-color: #007AFF` |
| `bg-white/80` | `rgb(255 255 255 / 0.8)` | `color-mix(in srgb, #fff 80%, transparent)` |
| `backdrop-blur-xl` | `blur(24px)` | `blur(var(--blur-xl))` |
| `text-sm` | `line-height: 1.25rem` | `line-height: var(--tw-leading, 1.25rem)` |
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | `0 1px 2px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.05))` |

### The rule every invariant follows

**An invariant may fail only when THIS APPLICATION's rendered result would
change.** Not when the toolchain expresses the same result differently, and not
when the app stops using a utility. Both are noise, and noise is how a suite
dies.

That has two concrete consequences, both of which were false-positive bugs first:

**1. The drop detector is gated on "still used in source".** A guarded entry that
emits nothing is only a silent failure when the class is still referenced
somewhere. When the app deliberately migrated `outline-none` -> `outline-hidden`,
the ungated version reported two "silent failures" whose message claimed the class
attributes still existed - they did not. Vocabulary shrinkage is reported
separately, as a baseline-refresh request, symmetric with the "vocabulary grew"
test.

**2. Where Tailwind 4 changed a default that the app compensates for, the
assertion measures the app, not the toolchain.** Tailwind 4 changed three defaults
that matter here. Compiling preflight in isolation cannot see `src/style.css`'s
`@layer base` override, so an isolated assertion is a permanent false red on the
v4 branch even though the shipped CSS is correct:

| Tailwind 4 change | asserted as | outcome |
|---|---|---|
| default border colour -> `currentColor` | an element with a colourless `border`, compiled through the real `src/style.css`, ends up `#e5e7eb` | passes on v3 (from preflight) and on v4 (from the app's base-layer reset); fails if that reset is deleted |
| `outline-none` -> `outline-style: none`; old behaviour renamed `outline-hidden` | whichever outline reset the app actually uses keeps an outline present under `forced-colors: active` | passes on v3 `outline-none` and v4 `outline-hidden`; fails on v4 `outline-none`, which has no fallback |
| bare `ring` 3px -> 1px | `ring-2` (what the app uses) is 2px, plus a version-aware bare-`ring` value AND an assertion that the app still has zero bare-`ring` call sites | records the accepted decision; fails if the premise stops holding |

The third one is worth spelling out: the change was accepted because the app has
no bare-`ring` call sites. That premise is the load-bearing part, so it is
asserted rather than left in a commit message.

## Version awareness

`helpers/tailwind-pipeline.ts` reads the installed major off
`node_modules/tailwindcss/package.json` and picks entry points accordingly.
Nothing version-specific is imported statically - a static
`import 'tailwindcss/loadConfig'` throws at module-eval time under v4 and a
static `import '@tailwindcss/postcss'` throws under v3, and either way the whole
suite dies at collection and detects nothing.

|  | Tailwind 3 | Tailwind 4 |
|---|---|---|
| PostCSS plugin | `tailwindcss` | `@tailwindcss/postcss` |
| JS config | `tailwindcss/loadConfig`, passed as an object | `@config` directive inside the CSS |
| layers | `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| candidates | `content: [{ raw }]` | `@source inline("...")` |

Two Tailwind 4 details that are easy to get wrong and are commented in the code:

- the utilities-only entry **must** also import `tailwindcss/theme`. In v4 a
  candidate is only valid if the design system knows the token it names, so
  without the theme `bg-white`, `font-bold`, `ease-out`, `leading-normal` and
  every colour utility generate nothing - which the drop detector would report as
  126 dropped classes that are in fact fine.
- `@layer` is not treated as rule context. It orders the cascade but never
  conditions whether a rule applies, and v4 wraps its entire output in real
  cascade layers.
- `analyse` is nesting-aware. v4 nests conditional branches inside the rule they
  qualify (`.outline-hidden { ...; @media (forced-colors: active) { ... } }`)
  where v3 emitted flat rules. Both nested at-rules and nested `&` rules stay
  attached to their parent selector, otherwise a conditional branch detaches from
  the class it belongs to and no assertion can reach it. This is a no-op on v3
  output, which never nests.

## Layout

```
css/
  helpers/
    repo-files.ts          deterministic file discovery, LF-normalised reads
    class-vocabulary.ts    extracts the class vocabulary from the source tree
    sfc-styles.ts          finds SFC <style> blocks that use @apply
    tailwind-pipeline.ts   version-aware PostCSS + Tailwind harness
    effective-style.ts     var() substitution + colour/length/duration canonicalisation
    baseline.ts            baseline read / refresh, major recording and gating
  baseline/
    utility-vocabulary.txt guarded utility list (the silent-drop contract)
    utility-vocabulary.css declarations every used utility emits
    app-stylesheet.css     preflight + forms plugin + src/style.css @apply output
  scripts/
    update-baseline.ts     regenerate the three baseline files
  postcss-pipeline.test.ts
  silent-drop.test.ts
  css-snapshots.test.ts
  design-system-invariants.test.ts
  sfc-apply-resolution.test.ts
```

## Updating the baselines

```bash
bun tests/visual-regression/css/scripts/update-baseline.ts
```

The diff **is** the change in shipped CSS. Read it before committing.

Refreshing is **refused** when the installed major differs from the recorded one,
because re-baselining across a major would discard the evidence of what the
upgrade broke - including any utility that stopped emitting CSS. Override
deliberately, after the migration is finished and reviewed:

```bash
UPDATE_CSS_BASELINE_MAJOR=4 bun tests/visual-regression/css/scripts/update-baseline.ts
```

## Deliberate design decisions

- **Autoprefixer is not in the harness.** The real v3 `postcss.config.js` runs
  `tailwindcss` then `autoprefixer`, but autoprefixer's output is a function of
  the resolved browserslist and the `caniuse-lite` data version. Including it
  would churn the baselines on unrelated dependency bumps while catching no
  regression this layer targets. (Tailwind 4 drops autoprefixer entirely.)
  `postcss-pipeline.test.ts` asserts the real plugin list for the installed
  major, so a change to the real pipeline fails loudly rather than silently
  invalidating the baselines.
- **Two separate CSS snapshots.** `utility-vocabulary.css` covers utilities used
  by templates; `app-stylesheet.css` covers what `src/style.css` and the plugins
  contribute. They are compiled with different content lists so a routine
  template edit cannot churn the design-system snapshot.
- **Tailwind's own extractor is not reused.** `defaultExtractor` is a private
  implementation detail that changes between majors; this layer has to be an
  independent observer of the pipeline.
- **`.ts` string literals are low-confidence candidates.** They are fed to
  Tailwind to widen coverage, but only the tokens Tailwind recognises are
  recorded, so unrelated strings cannot pollute the baseline. Fragments that
  cannot be expressed as a v4 `@source inline()` candidate (double quotes,
  braces, backslashes) are skipped, and a test asserts no GUARDED utility is
  among them.
- **Determinism.** Sorted output, no timestamps, no absolute paths, no
  randomness, LF-only. The baselines are byte-identical across runs and machines.

## What this layer cannot catch

It compiles CSS; it does not render anything. Out of scope, and therefore the
pixel layer's problem:

- cascade and specificity outcomes - two rules can both exist and the wrong one
  still win. Tailwind 4's move from emulated to real cascade layers changes
  exactly this, and this layer cannot see it.
- Vue `scoped` attribute rewriting (`[data-v-xxxxxxx]`) and the resulting
  specificity
- whether a class is actually applied to the element the designer intended
- computed geometry: overflow, wrapping, stacking, layout shift
- anything driven by the plain CSS files under `src/styles/**` that never passes
  through Tailwind
- utilities used only through a runtime-built string (`` `w-${size}` ``), which
  the extractor deliberately skips
- new utilities used since the last baseline refresh - they are only guarded once
  they are in `utility-vocabulary.txt`
- `oklch()` / `oklab()` colours are canonicalised but not converted to sRGB, so
  an oklch-vs-hex comparison reports as a difference rather than resolving. The
  app's own palette is hex, so this only matters if a utility starts reading
  Tailwind 4's built-in oklch scale.
