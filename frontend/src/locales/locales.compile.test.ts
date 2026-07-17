import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from './en'
import zhCN from './zh-CN'
import zhTW from './zh-TW'

/**
 * Regression guard for "SyntaxError: 10" on /settings/general.
 *
 * vue-i18n's message compiler treats "@" as a linked-message directive
 * (@:key / @.modifier:key). An unescaped "@" inside a plain message such as
 * "admin@example.com" parses as INVALID_LINKED_FORMAT (compiler error code 10)
 * and throws in the PRODUCTION runtime — surfacing as the opaque
 * "SyntaxError: 10". (The dev/test compiler is lenient and does not throw,
 * which is why this only appeared in the deployed bundle.) The literal "@"
 * must be escaped as {'@'}.
 *
 * The static scan below is the real guard: it is independent of the dev/prod
 * compiler difference, so it catches an un-escaping regression in any locale.
 */
const locales = { en, 'zh-CN': zhCN, 'zh-TW': zhTW } as const

function collectStrings(node: unknown, path: string, out: Array<{ path: string; value: string }>): void {
  if (typeof node === 'string') {
    out.push({ path, value: node })
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      collectStrings(child, path ? `${path}.${key}` : key, out)
    }
  }
}

function getByPath(node: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {return undefined}
    return (current as Record<string, unknown>)[key]
  }, node)
}

const advancedSettingsFormKeys = [
  'systemSettings.advanced.title',
  'systemSettings.advanced.description',
  'systemSettings.advanced.messaging',
  'systemSettings.advanced.messageQueueSize',
  'systemSettings.advanced.messageQueueSizeHint',
  'systemSettings.advanced.messageTimeout',
  'systemSettings.advanced.messageTimeoutHint',
  'systemSettings.advanced.recallWindow.label',
  'systemSettings.advanced.recallWindow.hint',
  'systemSettings.advanced.recallWindow.off',
  'systemSettings.advanced.recallWindow.s30',
  'systemSettings.advanced.recallWindow.m1',
  'systemSettings.advanced.recallWindow.m2',
  'systemSettings.advanced.recallWindow.m5',
  'systemSettings.advanced.caching',
  'systemSettings.advanced.cacheExpiry',
  'systemSettings.advanced.cacheExpiryHint',
  'systemSettings.advanced.sessionExpiry',
  'systemSettings.advanced.sessionExpiryHint',
  'systemSettings.advanced.features',
  'systemSettings.advanced.enableRateLimit',
  'systemSettings.advanced.enableRateLimitHint',
  'systemSettings.advanced.enableLogging',
  'systemSettings.advanced.enableLoggingHint',
  'systemSettings.advanced.enableMetrics',
  'systemSettings.advanced.enableMetricsHint',
] as const

describe('i18n locale message compilation', () => {
  it.each(Object.keys(locales) as Array<keyof typeof locales>)(
    'has every literal "@" escaped as {\'@\'} in %s (no INVALID_LINKED_FORMAT)',
    (locale) => {
      const strings: Array<{ path: string; value: string }> = []
      collectStrings(locales[locale], '', strings)

      const offenders = strings.filter(({ value }) => {
        const atCount = (value.match(/@/g) || []).length
        const escapedCount = (value.match(/\{'@'\}/g) || []).length
        return atCount !== escapedCount
      })

      expect(offenders).toEqual([])
    }
  )

  it.each(Object.keys(locales) as Array<keyof typeof locales>)(
    'renders systemSettings.general.contactEmailPlaceholder in %s to a literal email',
    (locale) => {
      const i18n = createI18n({
        legacy: false,
        locale: locale as string,
        fallbackLocale: 'en',
        messages: locales,
      })
      const t = i18n.global.t as (_key: string) => string
      expect(t('systemSettings.general.contactEmailPlaceholder')).toBe('admin@example.com')
    }
  )

  it.each(Object.keys(locales) as Array<keyof typeof locales>)(
    'defines every AdvancedSettingsForm translation key in %s',
    (locale) => {
      const missingKeys = advancedSettingsFormKeys.filter((key) => typeof getByPath(locales[locale], key) !== 'string')
      expect(missingKeys).toEqual([])
    }
  )
})
