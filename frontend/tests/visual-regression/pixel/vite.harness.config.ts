/**
 * ============================================================================
 * Pixel VRT — dedicated Vite dev server config
 * ============================================================================
 *
 * WHY A SEPARATE CONFIG (and not an extra entry in `frontend/vite.config.ts`):
 *
 *   `vite.config.ts` is on the production deploy path — `bun run deploy:pages`
 *   builds with it, and its `rolldownOptions.codeSplitting` groups are tuned for
 *   the shipped bundle. Adding a test-only HTML entry there would put harness
 *   code into the production build graph and give a test file the ability to
 *   break a deploy. This file changes nothing the app ships.
 *
 *   It also drops the `/api` proxy. `vite.config.ts` proxies `/api` to
 *   `https://mcis-backend.daiwandist.com` (production). The harness must never
 *   be able to reach it, even by accident, so the proxy simply does not exist
 *   here. The Playwright spec additionally aborts every off-origin request.
 *
 * `root` stays at the frontend directory rather than the harness folder. Two
 * reasons: the `@` / `@shared` aliases resolve exactly as they do for the real
 * app, and Tailwind 3 resolves the relative `content` globs in
 * `tailwind.config.js` against `process.cwd()` — which the Playwright
 * `webServer.cwd` pins to the frontend directory.
 *
 * ---------------------------------------------------------------------------
 * RUNS ON BOTH TAILWIND MAJORS
 * ---------------------------------------------------------------------------
 * A visual-regression harness that cannot execute under the upgrade it guards
 * cannot guard it. The PostCSS pipeline is therefore selected from the INSTALLED
 * Tailwind major at config-load time (see `tailwind-runtime.ts`), never from a
 * static import of a version-specific package.
 * ============================================================================
 */

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { HARNESS_PORT } from './harness-server'
import { readTailwindRuntime, tailwindPostcssPlugins } from './tailwind-runtime'

const frontendRoot = resolve(__dirname, '../../..')
const harnessEntry = resolve(__dirname, 'harness/index.html')
const harnessTailwindConfig = resolve(__dirname, 'tailwind.harness.config.js')
const harnessDir = resolve(__dirname, 'harness')
const appStylesheet = resolve(frontendRoot, 'src', 'style.css')

const tailwind = readTailwindRuntime(frontendRoot)

/** Vite ids use forward slashes and may carry a `?query`; normalise both away. */
function normaliseId(id: string): string {
  return id.split('?')[0]?.replace(/\\/g, '/') ?? ''
}

/**
 * Tailwind 4: make the harness fixtures an explicit source root, in CSS.
 *
 * WHY IN CSS AND NOT IN THE CONFIG
 *   On v3 the harness widens `content` via `tailwind.harness.config.js`, which
 *   it can do because the config object is handed straight to the plugin. On v4
 *   there is no such hook: `src/style.css` reaches the app's config itself with
 *   `@config "../tailwind.config.js"`, so a harness-side config object is simply
 *   bypassed. v4's equivalent lever is the `@source` directive, which only works
 *   from inside the stylesheet that owns `@import "tailwindcss"`.
 *
 *   Since `src/style.css` is app source and shared with the deploy path, it is
 *   not edited. This plugin appends the directive to the module IN MEMORY, for
 *   the harness dev server only. `enforce: 'pre'` puts it ahead of Vite's own
 *   `vite:css` transform, so Tailwind sees the appended directive.
 *
 * WHAT IT IS AND IS NOT DOING (measured on tailwindcss 4.3.3)
 *   It is NOT what keeps `.btn-warning` alive. Tailwind 4 does not purge
 *   hand-authored rules inside `@layer components` at all — they are ordinary CSS
 *   in a real cascade layer now, not utility candidates. Measured: the full
 *   design-system family (`.btn-warning`, `.alert-*`, `.heading-1..4`,
 *   `.body-large`, `.badge-instagram`, ...) is emitted even with
 *   `source(none)`, which is a genuine structural difference from v3, where every
 *   one of them was purged unless `content` covered the fixture using it.
 *
 *   What it DOES buy is that the harness's coverage of Tailwind UTILITIES is
 *   explicit rather than inherited from v4's implicit auto-detection. v4 walks
 *   the project and honours `.gitignore`; this harness has its own `.gitignore`
 *   entries, and a future broader ignore rule (or a change in how the plugin
 *   picks its base directory) would silently narrow coverage. With this
 *   directive, a utility used only by a fixture is guaranteed to be generated.
 *   Verified live: under `source(none)` a fixture-only utility is dropped
 *   without this directive and emitted with it.
 *
 *   It is a no-op on today's output: with and without it, the emitted class set
 *   is identical (0 added, 0 removed), so it cannot skew a pixel diff.
 */
function harnessSourceDirectivePlugin(): Plugin {
  const target = normaliseId(appStylesheet)
  const glob = `${normaliseId(harnessDir)}/**/*.{vue,ts,html}`

  return {
    name: 'vrt-pixel-harness-source',
    enforce: 'pre',
    transform(code, id) {
      if (normaliseId(id) !== target) {
        return null
      }
      // Match the file's dominant line ending so the emitted CSS stays
      // byte-identical to the un-injected build apart from the new directive.
      const eol = code.includes('\r\n') ? '\r\n' : '\n'
      return { code: `${code}${eol}@source "${glob}";${eol}`, map: null }
    },
  }
}

const plugins: Plugin[] = [vue()]
if (tailwind.major >= 4) {
  plugins.unshift(harnessSourceDirectivePlugin())
}

export default defineConfig({
  root: frontendRoot,

  /**
   * The app's real PostCSS pipeline for the installed major:
   *   v3 -> `tailwindcss` (pointed at the widened harness config) + autoprefixer
   *   v4 -> `@tailwindcss/postcss` alone, no options, exactly as this branch's
   *         `postcss.config.js` does (v4 prefixes internally, so autoprefixer is
   *         gone and passing options would change source-detection behaviour)
   *
   * Declaring `css.postcss` inline also stops Vite from picking up
   * `frontend/postcss.config.js`, so there is exactly one Tailwind pass.
   */
  css: {
    postcss: {
      plugins: tailwindPostcssPlugins(frontendRoot, tailwind, harnessTailwindConfig),
    },
  },
  // Point env loading at this directory (which holds no .env files) so the
  // harness cannot inherit VITE_BACKEND_URL or any other production pointer.
  envDir: __dirname,
  plugins,
  resolve: {
    alias: {
      '@': resolve(frontendRoot, 'src'),
      '@shared': resolve(frontendRoot, '../shared'),
    },
  },
  // Pre-bundle from the harness entry, not the app's index.html, so startup does
  // not crawl every view in the application.
  optimizeDeps: {
    entries: [harnessEntry],
  },
  server: {
    host: '127.0.0.1',
    port: HARNESS_PORT,
    strictPort: true,
    // Explicitly empty: no proxy to any backend.
    proxy: {},
  },
})
