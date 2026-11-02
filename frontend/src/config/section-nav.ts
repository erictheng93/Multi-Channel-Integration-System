/**
 * Pages grouped under one sidebar entry (報表 / 資料管理 / 系統設定).
 *
 * One definition feeds both navigations so they can never disagree on names or order:
 *  - the sidebar children (desktop, > 1024px), via `sectionNavItems`
 *  - the in-page segmented fallback `<UiSectionNav>` (<= 1024px, where the sidebar is an
 *    icon rail or a drawer and its children are not visible)
 *
 * Labels are the page names: the same string is the nav label, the breadcrumb, the
 * route `meta.title` and the page title. Change them together.
 */

export type SectionNavKey = 'reports' | 'data' | 'settings'

export interface SectionNavItem {
  path: string
  label: string
  /** Hidden from non-admin agents */
  adminOnly?: boolean
}

export interface SectionNavDef {
  /** Sidebar entry label and route prefix */
  label: string
  path: string
  /** aria-label of the in-page fallback nav */
  ariaLabel: string
  items: readonly SectionNavItem[]
}

export const SECTION_NAV: Readonly<Record<SectionNavKey, SectionNavDef>> = {
  reports: {
    label: '報表',
    path: '/reports',
    ariaLabel: '報表分頁',
    items: [
      { path: '/reports/dashboard', label: '報表總覽' },
      { path: '/reports/templates', label: '報表模板' },
      { path: '/reports/generate', label: '產生報表' },
    ],
  },
  data: {
    label: '資料管理',
    path: '/data',
    ariaLabel: '資料管理分頁',
    items: [
      { path: '/data/export', label: '匯出對話' },
      { path: '/data/backup', label: '資料備份', adminOnly: true },
    ],
  },
  settings: {
    label: '系統設定',
    path: '/settings',
    ariaLabel: '設定分類',
    items: [
      { path: '/settings/general', label: '一般設定' },
      { path: '/settings/integrations/line', label: 'LINE 官方帳號' },
      { path: '/settings/integrations/facebook', label: 'Facebook' },
      { path: '/settings/advanced', label: '進階設定' },
      { path: '/settings/maintenance/health', label: '健康檢查' },
    ],
  },
}

/** Items of one section that the given role may see. */
export function sectionNavItems(key: SectionNavKey, isAdmin: boolean): SectionNavItem[] {
  return SECTION_NAV[key].items.filter((item) => isAdmin || !item.adminOnly)
}

/** Section a path lives in (for choosing which fallback nav a page shows). */
export function sectionNavKeyForPath(path: string): SectionNavKey | undefined {
  return (Object.keys(SECTION_NAV) as SectionNavKey[]).find((key) => {
    const prefix = SECTION_NAV[key].path
    return path === prefix || path.startsWith(`${prefix}/`)
  })
}
