/**
 * Pure arc math of the Service Rings graphic (see ServiceRings.vue).
 * Rings are concentric circles stroked with a round cap; a ring's filled share is drawn with
 * stroke-dasharray, so the only numbers needed are a radius and a circumference.
 */

export interface RingLayout {
  /** px of the square viewBox */
  size: number
  /** stroke width of every ring */
  stroke: number
  /** clear space between neighbouring rings */
  gap: number
}

/** Share of a ring that is filled: value / total clamped to 0..1; 0 for an empty or invalid total. */
export function ringFraction(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0 || value <= 0) { return 0 }
  return Math.min(1, value / total)
}

/** Radius of ring `index` (0 = outermost). Drawn complete: the outermost stroke touches the box edge, never beyond. */
export function ringRadius(index: number, layout: RingLayout): number {
  return layout.size / 2 - layout.stroke / 2 - index * (layout.stroke + layout.gap)
}

export function ringCircumference(radius: number): number {
  return 2 * Math.PI * radius
}

/** Length of the drawn arc along the circumference. */
export function arcLength(fraction: number, radius: number): number {
  return ringCircumference(radius) * Math.min(1, Math.max(0, fraction))
}

/** Radius of the empty disc inside the innermost of `count` rings (room for a centre label). */
export function innerRadius(count: number, layout: RingLayout): number {
  if (count <= 0) { return layout.size / 2 }
  return Math.max(0, ringRadius(count - 1, layout) - layout.stroke / 2 - layout.gap)
}
