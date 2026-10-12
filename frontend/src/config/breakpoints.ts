/**
 * Single source of truth for responsive breakpoints.
 *
 * CSS cannot read these values, so every `@media (max-width: Npx)` in the app
 * must use a value from this scale. `bun run lint:breakpoints` enforces it.
 * The scale matches Tailwind's defaults (sm/md/lg/xl) plus `xs` for narrow phones.
 *
 * Convention (desktop-first, as used across the app):
 *   phone   : width <= md          (sidebar becomes a drawer)
 *   tablet  : md  < width <= lg    (sidebar auto-collapses to an icon rail)
 *   desktop : width > lg
 */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

export type BreakpointName = keyof typeof BREAKPOINTS

/** `true` when the viewport is a phone: matches `@media (max-width: 768px)`. */
export function isPhoneWidth(width: number): boolean {
  return width <= BREAKPOINTS.md
}

/** `true` when the viewport is a tablet: matches `(min-width: 769px) and (max-width: 1024px)`. */
export function isTabletWidth(width: number): boolean {
  return width > BREAKPOINTS.md && width <= BREAKPOINTS.lg
}
