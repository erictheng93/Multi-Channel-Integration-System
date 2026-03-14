// i18n 組合式函數
import { computed } from 'vue'
import { useI18n as useVueI18n } from 'vue-i18n'
import { setLocale, isLocaleAvailable, i18n } from '@/plugins/i18n'
import { availableLocales } from '@/locales'

export function useI18n() {
  const { t, locale } = useVueI18n()

  // 當前語言 - 直接使用 i18n 實例的響應式 locale
  const currentLocale = computed(() => i18n.global.locale.value)

  // 可用語言列表
  const locales = computed(() => availableLocales)

  // 切換語言
  const switchLocale = async (newLocale: string) => {
    console.log(` Attempting to switch locale to: ${newLocale}`)
    
    if (!isLocaleAvailable(newLocale)) {
      console.warn(` Locale ${newLocale} is not available`)
      return false
    }
    
    try {
      const success = setLocale(newLocale)
      if (success) {
        console.log(` Language switched successfully to: ${newLocale}`)
        console.log(`Current locale after switch: ${i18n.global.locale.value}`)
        
        // 強制觸發響應式更新
        await new Promise(resolve => setTimeout(resolve, 100))
        
        return true
      } else {
        console.error(` Failed to set locale: ${newLocale}`)
        return false
      }
    } catch (error) {
      console.error(` Error switching locale:`, error)
      return false
    }
  }

  // 獲取語言顯示名稱
  const getLocaleName = (localeCode: string) => {
    const locale = availableLocales.find(l => l.code === localeCode)
    return locale?.name || localeCode
  }

  // 格式化日期時間（根據當前語言）
  const formatDateTime = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
    
    return dateObj.toLocaleString(currentLocale.value, { ...defaultOptions, ...options })
  }

  // 格式化日期
  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
    
    return dateObj.toLocaleDateString(currentLocale.value, { ...defaultOptions, ...options })
  }

  // 格式化相對時間
  const formatRelativeTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
      return t('dashboard.time.justNow')
    } else if (diffInMinutes < 60) {
      return t('dashboard.time.minutesAgo', { count: diffInMinutes })
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60)
      return t('dashboard.time.hoursAgo', { count: hours })
    } else {
      const days = Math.floor(diffInMinutes / 1440)
      return t('dashboard.time.daysAgo', { count: days })
    }
  }

  return {
    t,
    locale,
    currentLocale,
    locales,
    switchLocale,
    getLocaleName,
    formatDateTime,
    formatDate,
    formatRelativeTime
  }
}