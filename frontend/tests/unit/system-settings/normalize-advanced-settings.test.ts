/**
 * normalizeAdvancedSettings 單元測試
 *
 * 驗證舊環境殘留的錯誤單位數值在載入時被升級換算並夾擠進表單有效範圍，
 * 防止「表單載入即 invalid → 儲存靜默失敗」的歷史事故重演。
 */
import { describe, it, expect } from 'vitest'
import { normalizeAdvancedSettings } from '@/composables/useSystemSettingsController'

describe('normalizeAdvancedSettings', () => {
  it('升級歷史「秒」值的 messageTimeout 為毫秒（30 → 30000）', () => {
    expect(normalizeAdvancedSettings({ messageTimeout: 30 }).messageTimeout).toBe(30000)
  })

  it('保留已是毫秒的 messageTimeout（5000 → 5000）', () => {
    expect(normalizeAdvancedSettings({ messageTimeout: 5000 }).messageTimeout).toBe(5000)
  })

  it('夾擠超出範圍的 messageTimeout（999999 → 300000）', () => {
    expect(normalizeAdvancedSettings({ messageTimeout: 999999 }).messageTimeout).toBe(300000)
  })

  it('把非整秒的 messageTimeout 對齊 step（1400 → 1000）', () => {
    expect(normalizeAdvancedSettings({ messageTimeout: 1400 }).messageTimeout).toBe(1000)
  })

  it('升級歷史「分鐘」值的 cacheExpiry 為秒（30 → 1800）', () => {
    expect(normalizeAdvancedSettings({ cacheExpiry: 30 }).cacheExpiry).toBe(1800)
  })

  it('保留已是秒且對齊分鐘的 cacheExpiry（3600 → 3600）', () => {
    expect(normalizeAdvancedSettings({ cacheExpiry: 3600 }).cacheExpiry).toBe(3600)
  })

  it('升級歷史「小時」值的 sessionExpiry 為秒（24 → 86400）', () => {
    expect(normalizeAdvancedSettings({ sessionExpiry: 24 }).sessionExpiry).toBe(86400)
  })

  it('把低於表單 1 小時下限的合法後端值拉到 3600（300 → 3600）', () => {
    expect(normalizeAdvancedSettings({ sessionExpiry: 300 }).sessionExpiry).toBe(3600)
  })

  it('夾擠超出範圍的 sessionExpiry（999999 → 604800）', () => {
    expect(normalizeAdvancedSettings({ sessionExpiry: 999999 }).sessionExpiry).toBe(604800)
  })

  it('不動未提供的欄位與非數值欄位', () => {
    const result = normalizeAdvancedSettings({ enableRateLimit: true })
    expect(result).toEqual({ enableRateLimit: true })
  })

  it('production 現值全部原樣通過（5000ms / 60s / 7200s）', () => {
    const result = normalizeAdvancedSettings({
      messageTimeout: 5000,
      cacheExpiry: 60,
      sessionExpiry: 7200
    })
    expect(result).toEqual({ messageTimeout: 5000, cacheExpiry: 60, sessionExpiry: 7200 })
  })
})
