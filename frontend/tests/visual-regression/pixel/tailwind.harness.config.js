/**
 * ============================================================================
 * Pixel VRT — Tailwind config for the harness only
 * ============================================================================
 *
 * The app's `tailwind.config.js` remains the single source of truth for theme,
 * plugins and everything else. This file changes EXACTLY ONE thing: it widens
 * `content` to also scan the harness fixtures.
 *
 * WHY THIS IS NECESSARY
 *
 *   Tailwind 3 tree-shakes rules authored inside `@layer components` /
 *   `@layer utilities` against the `content` globs, the same way it prunes
 *   utilities. Roughly a third of the design system in `src/style.css` is
 *   *defined but not currently used anywhere in `src/`* — `.btn-warning`,
 *   `.badge-instagram`, `.heading-1`..`.heading-4`, `.body-large`, `.alert-*`
 *   and friends. With the app's globs, those rules never reach the browser.
 *
 *   That is fine for the shipped bundle, but it is a false-green trap for a
 *   pixel gate: a fixture using `.btn-warning` would render an unstyled native
 *   button, screenshot that perfectly consistently, and "pass" forever while
 *   testing nothing. Widening `content` means the harness screenshots the
 *   design-system DEFINITIONS, which is what we actually want gated.
 *
 * WHAT THIS DOES NOT CHANGE
 *
 *   Widening `content` can only ADD rules; it never alters how an existing rule
 *   is generated. Theme values, plugins, `@apply` resolution and the utility
 *   generator are all still the app's.
 *
 * KNOWN LIMITATION (documented, not solved)
 *
 *   Because the harness deliberately generates a superset, it cannot detect a
 *   regression in Tailwind's content-scanning / purge behaviour itself. A future
 *   Tailwind version that stopped extracting a class pattern used in `src/`
 *   would break the app while the harness stayed green.
 * ============================================================================
 */

import appConfig from '../../../tailwind.config.js'

export default {
  ...appConfig,
  content: [
    // Same globs as the app...
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    // ...plus the harness fixtures and their HTML shell.
    './tests/visual-regression/pixel/harness/**/*.{vue,ts,html}',
  ],
}
