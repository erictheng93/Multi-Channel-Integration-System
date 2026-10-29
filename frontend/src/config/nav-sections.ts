/**
 * Navigation sections shared by the sidebar (grouping) and the top bar
 * (breadcrumb context). One definition so the two can never disagree.
 *
 * A path belongs to the section whose `prefixes` contain its first
 * segment(s). Paths that match no section (e.g. /profile) have no section.
 */

export interface NavSection {
  id: 'workspace' | 'growth' | 'team' | 'system'
  label: string
  /** Route path prefixes (matched at a segment boundary) */
  prefixes: readonly string[]
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { id: 'workspace', label: '工作台', prefixes: ['/dashboard', '/conversations', '/notifications'] },
  { id: 'growth', label: '客戶經營', prefixes: ['/tags', '/broadcasts', '/auto-reply', '/reports'] },
  { id: 'team', label: '團隊與頻道', prefixes: ['/team', '/channels', '/activities'] },
  { id: 'system', label: '系統', prefixes: ['/data', '/monitoring', '/settings'] },
]

const matchesPrefix = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`)

export function sectionForPath(path: string): NavSection | undefined {
  return NAV_SECTIONS.find((section) => section.prefixes.some((prefix) => matchesPrefix(path, prefix)))
}
