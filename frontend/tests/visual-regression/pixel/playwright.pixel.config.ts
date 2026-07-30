/**
 * ============================================================================
 * Pixel VRT — Playwright config
 * ============================================================================
 *
 * Separate from `frontend/playwright.config.ts` on purpose: that config points
 * at the app dev server (which proxies /api to the production Worker), keeps
 * `screenshot: 'only-on-failure'`, and its specs log in. None of that is
 * compatible with a hermetic pixel gate, and it is not ours to change.
 *
 * Run:
 *   bunx playwright test --config tests/visual-regression/pixel/playwright.pixel.config.ts
 *
 * Record/refresh baselines (only ever on a known-good tree):
 *   bunx playwright test --config tests/visual-regression/pixel/playwright.pixel.config.ts -u
 * ============================================================================
 */

import { defineConfig, devices } from '@playwright/test'
import { HARNESS_PORT, HARNESS_URL } from './harness-server'

export default defineConfig({
  testDir: '.',

  /**
   * `.vrt.ts`, NOT `.spec.ts`.
   *
   * `frontend/vitest.config.ts` includes `tests/**\/*.{test,spec}.ts` and only
   * excludes `tests/e2e/playwright/**`. A file named `pixel.spec.ts` here would
   * therefore be collected by `bun run test` and fail instantly under jsdom.
   * Renaming the file is a smaller, safer fix than editing the shared vitest
   * config.
   */
  testMatch: '**/*.vrt.ts',

  /**
   * Baselines are stored per project AND per platform.
   *
   * Font rasterisation is not portable: the design system's stack starts
   * `-apple-system, BlinkMacSystemFont, "Segoe UI"`, which resolves to Segoe UI
   * on Windows, a fontconfig substitute on Linux and SF on macOS. Different
   * glyphs mean different pixels, and no tolerance setting can paper over that
   * honestly. Scoping by `{platform}` means a developer on another OS gets a
   * clear "missing baseline for linux" instead of 40 bogus failures.
   */
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',

  // Own output dir so it never collides with the e2e suite's artifacts.
  outputDir: './.playwright-artifacts',

  // Sequential and unretried on purpose. A flaky pixel test must be visible as
  // a failure, not silently retried into green.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './.playwright-report' }],
  ],

  expect: {
    /**
     * =======================================================================
     * TOLERANCE — derived from Playwright's actual comparator, not guessed
     * =======================================================================
     *
     * Playwright compares PNGs with a vendored pixelmatch. Two knobs matter,
     * and the first one is easy to get badly wrong:
     *
     *   per-pixel:  maxDelta = 35215 * threshold^2      <- QUADRATIC
     *               a pixel counts as different only when its YIQ distance
     *               exceeds maxDelta
     *   per-image:  the number of counted pixels must stay <= maxDiffPixels
     *
     * For a neutral (grey) change of d levels the YIQ distance is ~0.5053*d^2,
     * so the smallest detectable greyscale step is:
     *
     *     d_min = sqrt(35215 / 0.5053) * threshold ~= 264 * threshold
     *
     *   threshold 0.2 (Playwright default) -> d_min ~= 53 levels
     *   threshold 0.1                      -> d_min ~= 26 levels
     *   threshold 0.02                     -> d_min ~=  5 levels
     *   threshold 0.01 (chosen)            -> d_min ~=  2.6 levels
     *
     * The default 0.2 is useless for a design-system gate. Measured against
     * this harness, at threshold 0.1 a plausible accent-token slip
     * (`#007AFF` -> `#0A84FF`, the iOS light/dark blue mix-up, YIQ distance
     * 44.7) was NOT detected: maxDelta at 0.1 is 352. Even swapping the accent
     * to Tailwind's `blue-500` (`#3b82f6`, distance 620) sits under the
     * default's maxDelta of 1409.
     *
     * `threshold: 0.01` -> maxDelta 3.5, i.e. any change of ~3 greyscale
     * levels or more is registered. That is tight, and it is affordable here
     * for two reasons:
     *   1. pixelmatch runs with `includeAA: false`, so pixels it identifies as
     *      antialiasing edges are excluded from the count. Glyph-edge jitter,
     *      the usual source of noise, is filtered out before the budget.
     *   2. This harness is byte-identical run to run on a fixed machine
     *      (verified: a re-record pass left all 43 baselines with unchanged
     *      SHA-256s), and baselines are scoped per platform, so the tolerance
     *      never has to paper over a different font renderer.
     *
     * `maxDiffPixels: 20` — absolute, deliberately not a ratio. A ratio scales
     * with the element and so cannot be one number: a border-radius change on
     * a 940x140 card touches ~100 px (0.0008 of its area) while the same change
     * on a 60x22 badge is 8% of it. The absolute figures for the changes we
     * must catch are:
     *     radius 16px -> 12px       ~= (16^2-12^2)*(1-pi/4) ~= 24 px/corner,
     *                                  ~96 px over four corners
     *     accent colour on a button   2,000+ px
     *     1px padding change on a row several hundred px
     *     shadow alpha 0.08 -> 0.12   whole shadow footprint, 1,000+ px
     * 20 px sits ~5x below the smallest of those while still absorbing a
     * handful of stray non-AA pixels.
     *
     * MEASURED SENSITIVITY (this harness, these baselines, Chromium 151):
     *     .btn-primary #007AFF -> #0A84FF      2,520 px   FAILS
     *     .btn radius 12px -> 8px                 39 px   FAILS
     *     .btn radius 12px -> 10px                 5 px   passes  <- floor
     *     .team-card shadow alpha .08 -> .12   6,230 px   FAILS
     *     .status-badge padding +1px vertical  6,574 px   FAILS (plus a size
     *                                                     mismatch, which is an
     *                                                     unconditional failure)
     *
     * KNOWN BLIND SPOTS, both a direct consequence of the two knobs above:
     *   - A 1-2px border-radius change on a small element. Rounded corners are
     *     almost entirely antialiased pixels, and `includeAA: false` discards
     *     them, so only ~5 pixels are counted. Catching it needs
     *     maxDiffPixels <= 4, which leaves no headroom at all for a future
     *     Chromium or system-font update; 4px radius steps (i.e. one Tailwind
     *     radius token) are caught, and that is the granularity a dependency
     *     upgrade actually moves things by.
     *   - A very small shadow/opacity nudge (alpha 0.06 -> 0.07, ~1-2 levels)
     *     stays under maxDelta. Catching that needs threshold 0, which trades a
     *     real regression signal for constant re-baselining.
     */
    toHaveScreenshot: {
      threshold: 0.01,
      maxDiffPixels: 20,
      // Both are Playwright defaults; pinned explicitly so a future default
      // change cannot silently alter every baseline.
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  use: {
    ...devices['Desktop Chrome'],

    baseURL: HARNESS_URL,

    // --- geometry -----------------------------------------------------------
    // Fixed viewport + 1x DPR. `devices['Desktop Chrome']` already sets
    // deviceScaleFactor 1, restated so it survives a devices-preset change.
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,

    // --- media / preference queries ----------------------------------------
    // style.css, SkeletonLoader.vue and TypingIndicator.vue all carry
    // `prefers-color-scheme: dark` blocks; style.css also has a
    // `prefers-reduced-motion: reduce` block that rewrites animation durations
    // and a `prefers-contrast: high` block that adds 2px borders. All three are
    // pinned to the values a default desktop user has, so the baselines
    // describe the default experience rather than an accessibility variant.
    colorScheme: 'light',
    // `reducedMotion` / `forcedColors` / `contrast` are not top-level `use`
    // options in @playwright/test 1.62 — they only exist on BrowserContextOptions.
    contextOptions: {
      reducedMotion: 'no-preference',
      forcedColors: 'none',
      contrast: 'no-preference',
    },

    // --- locale / clock -----------------------------------------------------
    // `TeamMemberCard.formatDate` and `PlatformStatus.formatTime` both call
    // `toLocaleString('zh-TW')`, which renders the *machine's* timezone. Pin
    // both so the rendered date strings are stable everywhere.
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',

    // --- isolation ----------------------------------------------------------
    serviceWorkers: 'block',

    trace: 'retain-on-failure',
    video: 'off',
    // Per-test screenshots off: `toHaveScreenshot` is the assertion, and the
    // failure artifacts it writes (expected/actual/diff) are what we want.
    screenshot: 'off',

    actionTimeout: 10_000,
    navigationTimeout: 30_000,

    launchOptions: {
      args: [
        // Font rasterisation determinism. Subpixel positioning and LCD
        // (subpixel-RGB) text are the two biggest sources of "one pixel is
        // off by 3 levels" noise between runs and machines.
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--disable-lcd-text',
        // Keep compositing on the software rasteriser so shadow/blur output
        // does not depend on the host GPU driver.
        '--disable-gpu',
        // Stop Chromium's own animations and first-run surfaces.
        '--force-prefers-reduced-motion=0',
        '--hide-scrollbars',
      ],
    },
  },

  projects: [
    // Chromium only. A pixel gate's job here is to detect that OUR CSS output
    // changed, not that browsers disagree — and every extra engine multiplies
    // the baseline count and the maintenance cost for zero extra signal about
    // a Tailwind/PostCSS upgrade.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: `bunx vite --config tests/visual-regression/pixel/vite.harness.config.ts --port ${HARNESS_PORT} --host 127.0.0.1`,
    // Pinned so Tailwind 3 resolves its relative `content` globs correctly.
    cwd: '../../..',
    url: HARNESS_URL,
    reuseExistingServer: !process.env.CI,
    // Cold start has to pre-bundle Vue + Pinia + the component graph.
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
