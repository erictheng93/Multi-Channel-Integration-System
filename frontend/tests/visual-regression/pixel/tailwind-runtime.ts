/**
 * ============================================================================
 * Pixel VRT — Tailwind major detection and version-specific plugin loading
 * ============================================================================
 *
 * The harness exists to guard a Tailwind major upgrade, so it has to be able to
 * BOOT on both majors. The two versions have incompatible PostCSS entry points:
 *
 *   v3: `tailwindcss` IS the PostCSS plugin, and the config is handed to it as an
 *       object. Vendor prefixing is a separate `autoprefixer` pass.
 *   v4: the PostCSS plugin moved to `@tailwindcss/postcss`. Calling `tailwindcss`
 *       as a plugin throws with an explicit "the PostCSS plugin has moved"
 *       error. Prefixing is internal (lightningcss), so autoprefixer is gone.
 *
 * Nothing version-specific may be imported STATICALLY. A static
 * `import tailwindcss from 'tailwindcss'` resolves fine on v4 but explodes the
 * moment it is used as a plugin, and a static `import '@tailwindcss/postcss'`
 * fails to resolve at all on v3 — which, in a Vite config file, means the config
 * itself fails to load and the Playwright `webServer` dies before a single
 * screenshot is taken. That is exactly the failure this module removes.
 *
 * Resolution therefore goes through `createRequire`, so the specifier is never
 * seen by Vite's config bundler and a package that is absent for the current
 * major only fails if it is actually reached.
 *
 * This mirrors the approach `tests/visual-regression/css/helpers/tailwind-pipeline.ts`
 * uses for the CSS layer. It is deliberately NOT imported from there: the two
 * layers stay independent so neither can break the other, and this one only
 * needs plugin loading, not compiling or AST analysis.
 * ============================================================================
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AcceptedPlugin } from 'postcss'

export interface TailwindRuntime {
  /** Full installed version string, e.g. "4.3.3". For failure messages. */
  readonly version: string
  /** Installed major, read straight off the installed package. */
  readonly major: number
}

/**
 * A PostCSS plugin factory. Both Tailwind majors and autoprefixer expose this
 * shape; `options` is deliberately `unknown` because its meaning is
 * version-specific (v3 takes a resolved config object, v4 takes `{ base }`).
 */
type PluginFactory = (_options?: unknown) => AcceptedPlugin

/**
 * Build a `require` rooted at the frontend directory.
 *
 * `frontendRoot`'s own `package.json` is used as the anchor rather than
 * `import.meta.url`: this module is bundled by Vite's config loader, and
 * anchoring on a real, known file makes resolution independent of how that
 * bundler shims module metadata. It also guarantees we resolve out of
 * `frontend/node_modules` and not some parent workspace.
 */
function requireFrom(frontendRoot: string): NodeJS.Require {
  return createRequire(resolve(frontendRoot, 'package.json'))
}

/** Read the installed Tailwind version and major from `node_modules`. */
export function readTailwindRuntime(frontendRoot: string): TailwindRuntime {
  const manifest = resolve(frontendRoot, 'node_modules', 'tailwindcss', 'package.json')
  const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown }

  if (typeof parsed.version !== 'string') {
    throw new Error(`Could not read a version from ${manifest}`)
  }

  const major = Number.parseInt(parsed.version.split('.')[0] ?? '', 10)
  if (!Number.isInteger(major)) {
    throw new Error(`Could not determine a major version from "${parsed.version}"`)
  }

  return { version: parsed.version, major }
}

function loadFactory(frontendRoot: string, specifier: string): PluginFactory {
  const required = requireFrom(frontendRoot)(specifier) as unknown
  const factory =
    typeof required === 'object' && required !== null && 'default' in required
      ? (required as { default: unknown }).default
      : required

  if (typeof factory !== 'function') {
    throw new Error(`"${specifier}" did not export a callable PostCSS plugin factory`)
  }

  return factory as PluginFactory
}

/**
 * The PostCSS plugin list for the installed major, matching the app's real
 * pipeline as closely as the harness can.
 *
 * v3 mirrors `postcss.config.js` on `main` (tailwindcss then autoprefixer) but
 * points Tailwind at `tailwind.harness.config.js`, which is the app config with
 * `content` widened — see that file for why that is required on v3.
 *
 * v4 mirrors `postcss.config.js` on this branch exactly: `@tailwindcss/postcss`
 * alone, with no options, so source detection and `@config` resolution behave
 * precisely as they do for the app. Widening is handled in CSS via `@source`
 * instead (see `vite.harness.config.ts`), because on v4 there is no config
 * object to widen — `src/style.css` reaches the app config through `@config`.
 */
export function tailwindPostcssPlugins(
  frontendRoot: string,
  runtime: TailwindRuntime,
  harnessConfigPath: string
): AcceptedPlugin[] {
  if (runtime.major >= 4) {
    return [loadFactory(frontendRoot, '@tailwindcss/postcss')()]
  }

  return [
    loadFactory(frontendRoot, 'tailwindcss')(harnessConfigPath),
    loadFactory(frontendRoot, 'autoprefixer')(),
  ]
}
