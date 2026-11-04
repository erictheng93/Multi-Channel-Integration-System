/**
 * The last few pages this browser opened, newest first, so the 404 page can offer them back.
 * Paths only (no query, no ids): stored in localStorage, every access guarded because storage can be blocked.
 */
const KEY = 'mcis:recent-pages'
const MAX = 8

export function readRecentPaths(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function recordRecentPath(path: string): void {
  if (!path || path === '/login' || path === '/') { return }
  try {
    const next = [path, ...readRecentPaths().filter(p => p !== path)].slice(0, MAX)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: the 404 page simply has no recents
  }
}
