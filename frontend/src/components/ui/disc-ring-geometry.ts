/**
 * Deterministic geometry of the abrasive-disc signature (see DiscRing.vue).
 * Pure data, no randomness: the same disc renders on the server, in tests and in every tab.
 * The viewBox is 640 x 640 with the disc centred at (320, 320).
 */

export interface DiscRingSpec {
  r: number
  w: number
  o: number
}

export interface DiscGrainTick {
  x1: string
  y1: string
  x2: string
  y2: string
  o: string
}

/** Bond rings, outermost first. */
export const DISC_RINGS: readonly DiscRingSpec[] = [
  { r: 296, w: 1.5, o: 0.3 },
  { r: 276, w: 1, o: 0.22 },
  { r: 240, w: 1, o: 0.18 },
  { r: 204, w: 1, o: 0.16 },
  { r: 168, w: 1, o: 0.14 },
  { r: 132, w: 1, o: 0.14 },
  { r: 96, w: 1, o: 0.16 },
  { r: 60, w: 1, o: 0.2 },
  { r: 26, w: 1.5, o: 0.34 },
]

/** Fine grain ticks around the rim. */
export const DISC_GRAIN: readonly DiscGrainTick[] = Array.from({ length: 240 }, (_, i) => {
  const a = (i * Math.PI) / 120
  const r1 = 302 + (i % 5 === 0 ? 0 : 3)
  const r2 = r1 + 4 + ((i * 7) % 5) * 2.2
  return {
    x1: (320 + r1 * Math.cos(a)).toFixed(1),
    y1: (320 + r1 * Math.sin(a)).toFixed(1),
    x2: (320 + r2 * Math.cos(a)).toFixed(1),
    y2: (320 + r2 * Math.sin(a)).toFixed(1),
    o: (0.22 + ((i * 3) % 4) * 0.08).toFixed(2),
  }
})

/** Hero variant: gradient-stroked bond rings (heavier than the hairline set). */
export const DISC_HERO_RINGS: readonly DiscRingSpec[] = [
  { r: 292, w: 1.75, o: 0.5 },
  { r: 262, w: 1, o: 0.34 },
  { r: 192, w: 1, o: 0.3 },
  { r: 160, w: 1, o: 0.28 },
  { r: 108, w: 1.25, o: 0.34 },
  { r: 66, w: 1.5, o: 0.46 },
]

/** Hero variant: filled abrasive bands (wide strokes, low opacity). */
export const DISC_HERO_BANDS: readonly DiscRingSpec[] = [
  { r: 226, w: 34, o: 0.07 },
  { r: 130, w: 14, o: 0.06 },
]

/** Hero variant: a denser, longer rim of grain ticks (every third tick is a long one). */
export const DISC_HERO_GRAIN: readonly DiscGrainTick[] = Array.from({ length: 180 }, (_, i) => {
  const a = (i * Math.PI) / 90
  const long = i % 3 === 0
  const r1 = 298
  const r2 = r1 + (long ? 18 : 9) + ((i * 7) % 4)
  return {
    x1: (320 + r1 * Math.cos(a)).toFixed(1),
    y1: (320 + r1 * Math.sin(a)).toFixed(1),
    x2: (320 + r2 * Math.cos(a)).toFixed(1),
    y2: (320 + r2 * Math.sin(a)).toFixed(1),
    o: (long ? 0.7 : 0.4).toFixed(2),
  }
})

/** Hero variant: the polishing sweep, an arc of about 70 degrees on the r=262 bond ring. */
export const DISC_HERO_SWEEP: string = (() => {
  const r = 262
  const rad = (deg: number) => (deg * Math.PI) / 180
  const pt = (deg: number) => `${(320 + r * Math.cos(rad(deg))).toFixed(1)} ${(320 + r * Math.sin(rad(deg))).toFixed(1)}`
  return `M ${pt(-62)} A ${r} ${r} 0 0 1 ${pt(8)}`
})()
