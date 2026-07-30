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
 * reasons: the `@` / `@shared` aliases and `postcss.config.js` resolve exactly
 * as they do for the real app, and Tailwind 3 resolves the relative `content`
 * globs in `tailwind.config.js` against `process.cwd()` — which the Playwright
 * `webServer.cwd` pins to the frontend directory.
 * ============================================================================
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { resolve } from 'path'
import { HARNESS_PORT } from './harness-server'

const frontendRoot = resolve(__dirname, '../../..')
const harnessEntry = resolve(__dirname, 'harness/index.html')
const harnessTailwindConfig = resolve(__dirname, 'tailwind.harness.config.js')

export default defineConfig({
  root: frontendRoot,

  /**
   * Same two-plugin PostCSS pipeline as `frontend/postcss.config.js`
   * (tailwindcss then autoprefixer), but pointed at
   * `tailwind.harness.config.js`, which is the app config with `content`
   * widened to include the harness fixtures. See that file for why.
   *
   * Declaring `css.postcss` inline also stops Vite from picking up
   * `frontend/postcss.config.js`, so there is exactly one Tailwind pass.
   */
  css: {
    postcss: {
      plugins: [tailwindcss(harnessTailwindConfig), autoprefixer()],
    },
  },
  // Point env loading at this directory (which holds no .env files) so the
  // harness cannot inherit VITE_BACKEND_URL or any other production pointer.
  envDir: __dirname,
  plugins: [vue()],
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
