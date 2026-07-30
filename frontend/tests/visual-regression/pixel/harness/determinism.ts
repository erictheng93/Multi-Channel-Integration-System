/**
 * ============================================================================
 * Pixel VRT — determinism shims
 * ============================================================================
 *
 * Pixel diffing only works if the page renders byte-identically on every run.
 * Two non-determinism sources in this codebase are unavoidable at the source
 * level (we are explicitly forbidden from editing components), so they are
 * neutralised here, in the harness, before the Vue app is created:
 *
 *  1. `Math.random()`
 *     `src/components/ui/SkeletonLoader.vue` calls it twice per rendered row:
 *       - `getRandomWidth()` for bar widths (inline `style="width: NN%"`)
 *       - `v-if="Math.random() > 0.5"` / `> 0.6` for badge/count visibility
 *     Both run during render, so the stub must be installed before mount.
 *     A seeded mulberry32 PRNG is used: same seed -> same bytes, forever.
 *     `resetRandom()` is called once per render pass so the sequence does not
 *     depend on how many components rendered earlier on the page.
 *
 *  2. The wall clock
 *     Every fixture passes explicit fixed dates, but `withDefaults` blocks such
 *     as `PlatformStatus`'s `webhookStatus: () => ({ lastVerified: new Date() })`
 *     reach for `new Date()` on their own. Freezing the clock makes those paths
 *     deterministic too, and stops any future "3 minutes ago" rendering from
 *     silently rotting the baselines.
 *
 * `performance.now()` is intentionally left alone — Vue's scheduler and the
 * Playwright screenshot machinery both use it, and nothing renders it.
 * ============================================================================
 */

/** Frozen instant: 2026-01-15T01:30:00Z === 2026-01-15 09:30 Asia/Taipei. */
export const FROZEN_NOW_MS = Date.UTC(2026, 0, 15, 1, 30, 0)

/** PRNG seed. Changing this invalidates every SkeletonLoader baseline. */
const RANDOM_SEED = 0x5eed1234

let randomState = RANDOM_SEED

/**
 * mulberry32 — small, fast, well-distributed 32-bit PRNG.
 * Chosen over a trivial LCG because SkeletonLoader thresholds its output at
 * 0.5 / 0.6; a poor generator would produce a visually degenerate skeleton.
 */
function mulberry32(): number {
  randomState = (randomState + 0x6d2b79f5) | 0
  let t = randomState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Rewind the PRNG so a render pass always starts from the same sequence. */
export function resetRandom(): void {
  randomState = RANDOM_SEED
}

function freezeRandom(): void {
  Math.random = mulberry32
}

/** Every shape `new Date(...)` can legally be called with. */
type DateCtorArgs =
  | []
  | [value: number | string | Date]
  | [
      year: number,
      monthIndex: number,
      date?: number,
      hours?: number,
      minutes?: number,
      seconds?: number,
      ms?: number,
    ]

function freezeClock(): void {
  const RealDate = Date

  class FrozenDate extends RealDate {
    constructor(...args: DateCtorArgs) {
      if (args.length === 0) {
        super(FROZEN_NOW_MS)
      } else if (args.length === 1) {
        super(args[0])
      } else {
        super(...args)
      }
    }

    static override now(): number {
      return FROZEN_NOW_MS
    }
  }

  globalThis.Date = FrozenDate as DateConstructor
}

/**
 * Install every determinism shim. Must be called before `createApp`, and
 * before importing anything that captures `Date` or `Math.random` eagerly.
 */
export function installDeterminism(): void {
  freezeRandom()
  freezeClock()
}
