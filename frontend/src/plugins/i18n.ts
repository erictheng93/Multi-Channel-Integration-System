// Vue I18n 配置
import { createI18n } from 'vue-i18n'
import { messages, defaultLocale } from '@/locales'

// 從 localStorage 獲取保存的語言設定，如果沒有則使用預設語言
const getStoredLocale = (): string => {
  if (typeof window === 'undefined') {return defaultLocale}
  
  try {
    // 首先嘗試從 localStorage 獲取
    const stored = localStorage.getItem('locale')
    if (stored && messages[stored as keyof typeof messages]) {
      return stored
    }
    
    // 如果沒有儲存的語言設定，嘗試從瀏覽器語言推斷
    const browserLang = navigator.language
    if (browserLang.startsWith('zh')) {
      // 根據地區代碼決定繁體或簡體中文
      if (browserLang.includes('TW') || browserLang.includes('HK') || browserLang.includes('MO')) {
        return 'zh-TW'
      } else {
        return 'zh-CN'
      }
    } else if (browserLang.startsWith('en')) {
      return 'en'
    }
  } catch (error) {
    console.warn('Failed to get stored locale:', error)
  }
  
  return defaultLocale
}

// 建立 i18n 實例
export const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getStoredLocale(),
  fallbackLocale: defaultLocale,
  messages,
  globalInjection: true, // 全域注入 $t 函數
  silentTranslationWarn: true, // 在開發環境中靜默翻譯警告
  silentFallbackWarn: true
})

// 切換語言的函數
export const setLocale = (locale: string) => {
  if (messages[locale as keyof typeof messages]) {
    i18n.global.locale.value = locale as 'zh-TW' | 'en-US'
    
    // 儲存到 localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('locale', locale)
      } catch (error) {
        console.warn('Failed to save locale to localStorage:', error)
      }
    }
    
    // 更新 HTML lang 屬性
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
    
    return true
  }
  return false
}

// 獲取當前語言
export const getCurrentLocale = (): string => {
  return i18n.global.locale.value
}

// 檢查語言是否可用
export const isLocaleAvailable = (locale: string): boolean => {
  return locale in messages
}