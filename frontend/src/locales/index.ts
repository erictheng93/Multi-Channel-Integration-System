// 語言包索引文件
import zhTW from './zh-TW'
import zhCN from './zh-CN'
import en from './en'

export const messages = {
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  en
}

export const availableLocales = [
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'en', name: 'English' }
]

export const defaultLocale = 'zh-TW'