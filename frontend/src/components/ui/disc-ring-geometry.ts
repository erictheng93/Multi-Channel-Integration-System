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
