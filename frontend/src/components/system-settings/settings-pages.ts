/**
 * Section registry shared by the settings layout (page head) and the section rail.
 * One entry per nested /settings/* route.
 */

export type SettingsSectionKey = 'general' | 'line' | 'facebook' | 'advanced' | 'health'

export type SettingsTileColor = 'gray' | 'green' | 'blue' | 'indigo' | 'orange'

export interface SettingsSection {
  key: SettingsSectionKey
  routeName: string
  path: string
  /** Rail label and page title */
  title: string
  subtitle: string
  group: '基本' | '整合' | '維護'
  color: SettingsTileColor
  /** Inner SVG markup of a 24x24 outline icon */
  icon: string
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: 'general',
    routeName: 'SettingsGeneral',
    path: '/settings/general',
    title: '一般設定',
    subtitle: '設定系統名稱、聯絡信箱與時區。',
    group: '基本',
    color: 'gray',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>'
  },
  {
    key: 'line',
    routeName: 'SettingsIntegrationsLine',
    path: '/settings/integrations/line',
    title: 'LINE 官方帳號',
    subtitle: 'Messaging API 憑證加密儲存，僅顯示末四碼。',
    group: '整合',
    color: 'green',
    icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/>'
  },
  {
    key: 'facebook',
    routeName: 'SettingsIntegrationsFacebook',
    path: '/settings/integrations/facebook',
    title: 'Facebook',
    subtitle: 'Messenger 應用程式與粉絲專頁憑證加密儲存，僅顯示末四碼。',
    group: '整合',
    color: 'blue',
    icon: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
  },
  {
    key: 'advanced',
    routeName: 'SettingsAdvanced',
    path: '/settings/advanced',
    title: '進階設定',
    subtitle: '調整訊息處理、快取、登入有效期限與功能開關。',
    group: '維護',
    color: 'indigo',
    icon: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'
  },
  {
    key: 'health',
    routeName: 'SettingsMaintenanceHealth',
    path: '/settings/maintenance/health',
    title: '健康檢查',
    subtitle: '逐項檢查資料庫、快取、儲存、佇列與 LINE webhook。',
    group: '維護',
    color: 'orange',
    icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'
  }
]

export function findSettingsSection(routeName: unknown): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find(section => section.routeName === routeName)
}

/** Form id the page-head submit button points at (`<button form="...">`). */
export const SETTINGS_FORM_ID = 'settings-form'
