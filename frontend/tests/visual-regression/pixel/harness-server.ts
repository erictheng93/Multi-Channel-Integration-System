/**
 * Harness server coordinates, shared by the Vite config and the Playwright
 * config/spec. Deliberately import-free so it is safe to load from any runtime
 * (Vite's ESM config loader, Playwright's TS loader, the browser).
 */

/** Port chosen to avoid the app dev server (5173) and the existing e2e run. */
export const HARNESS_PORT = 5219

export const HARNESS_ORIGIN = `http://127.0.0.1:${HARNESS_PORT}`

/**
 * Path of the harness HTML inside the Vite dev server.
 * The dev server's `root` is the frontend directory, so this is the on-disk
 * path relative to it.
 */
export const HARNESS_PATH = '/tests/visual-regression/pixel/harness/index.html'

export const HARNESS_URL = `${HARNESS_ORIGIN}${HARNESS_PATH}`
