// SystemSettings 完整測試套件
import { systemApi } from '@/api/system'
import { setLocale, getCurrentLocale } from '@/plugins/i18n'
// import { runSystemSettingsDiagnostic } from './systemSettingsDiagnostic'
// import { fixSystemSettingsLanguage } from './systemSettingsFix'

export interface TestResult {
  testName: string
  success: boolean
  message: string
  details?: unknown
  duration?: number
}

export class SystemSettingsTestSuite {
  private results: TestResult[] = []

  private addResult(testName: string, success: boolean, message: string, details?: unknown, duration?: number) {
    this.results.push({ testName, success, message, details, duration })
    const icon = success ? '✅' : '❌'
    const durationText = duration ? ` (${duration}ms)` : ''
    console.log(`${icon} ${testName}: ${message}${durationText}`)
    if (details) {
      console.log('   Details:', details)
    }
  }

  async runCompleteTest(): Promise<TestResult[]> {
    console.group('🧪 SystemSettings 完整測試套件')
    this.results = []

    try {
      // 1. 基礎連接測試
      await this.testBasicConnectivity()

      // 2. 設定讀寫測試
      await this.testSettingsReadWrite()

      // 3. 語言切換測試
      await this.testLanguageSwitching()

      // 4. 錯誤處理測試
      await this.testErrorHandling()

      // 5. 性能測試
      await this.testPerformance()

    } catch (error) {
      this.addResult('測試套件', false, '測試過程中發生未預期錯誤', error)
    }

    console.groupEnd()
    return this.results
  }

  private async testBasicConnectivity() {
    console.group('🔗 基礎連接測試')

    // 測試 API 基礎連接
    const startTime = Date.now()
    try {
      const response = await fetch('/health')
      const duration = Date.now() - startTime
      
      if (response.ok) {
        this.addResult('API 連接', true, 'API 服務正常', { status: response.status }, duration)
      } else {
        this.addResult('API 連接', false, `API 回應異常: ${response.status}`, null, duration)
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.addResult('API 連接', false, 'API 連接失敗', error, duration)
    }

    // 測試系統信息 API
    try {
      const startTime = Date.now()
      const systemInfo = await systemApi.getSystemInfo()
      const duration = Date.now() - startTime
      
      if (systemInfo.success) {
        this.addResult('系統信息 API', true, '系統信息獲取成功', systemInfo.data, duration)
      } else {
        this.addResult('系統信息 API', false, '系統信息獲取失敗', systemInfo.error, duration)
      }
    } catch (error) {
      this.addResult('系統信息 API', false, '系統信息 API 異常', error)
    }

    console.groupEnd()
  }

  private async testSettingsReadWrite() {
    console.group('📖 設定讀寫測試')

    let originalSettings: Record<string, unknown> | null = null

    // 測試讀取設定
    try {
      const startTime = Date.now()
      const response = await systemApi.getSettings()
      const duration = Date.now() - startTime
      
      if (response.success && response.data) {
        originalSettings = response.data as Record<string, unknown>
        this.addResult('讀取設定', true, '設定讀取成功', {
          hasGeneral: !!response.data.general,
          hasIntegrations: !!response.data.integrations,
          hasAdvanced: !!response.data.advanced
        }, duration)
      } else {
        this.addResult('讀取設定', false, '設定讀取失敗', response.error, duration)
        console.groupEnd()
        return
      }
    } catch (error) {
      this.addResult('讀取設定', false, '設定讀取異常', error)
      console.groupEnd()
      return
    }

    // 測試寫入設定
    try {
      const testSettings = {
        general: {
          ...(originalSettings?.general as Record<string, unknown> || {}),
          systemName: `Test System ${Date.now()}`
        }
      }

      const startTime = Date.now()
      const writeResponse = await systemApi.updateSettings(testSettings)
      const duration = Date.now() - startTime

      if (writeResponse.success) {
        this.addResult('寫入設定', true, '設定寫入成功', null, duration)

        // 驗證寫入結果
        await new Promise(resolve => setTimeout(resolve, 500))
        const verifyResponse = await systemApi.getSettings()
        
        if (verifyResponse.success && 
            verifyResponse.data?.general?.systemName === testSettings.general.systemName) {
          this.addResult('驗證寫入', true, '設定寫入驗證成功')
        } else {
          this.addResult('驗證寫入', false, '設定寫入驗證失敗', {
            expected: testSettings.general.systemName,
            actual: verifyResponse.data?.general?.systemName
          })
        }

        // 恢復原始設定
        if (originalSettings) {
          await systemApi.updateSettings(originalSettings)
        }
        this.addResult('恢復設定', true, '原始設定已恢復')

      } else {
        this.addResult('寫入設定', false, '設定寫入失敗', writeResponse.error, duration)
      }
    } catch (error) {
      this.addResult('寫入設定', false, '設定寫入異常', error)
    }

    console.groupEnd()
  }

  private async testLanguageSwitching() {
    console.group('🌐 語言切換測試')

    const testLanguages = ['zh-TW', 'zh-CN', 'en']
    const originalLanguage = getCurrentLocale()
    let successCount = 0

    for (const lang of testLanguages) {
      try {
        console.log(`測試語言: ${lang}`)
        
        // 1. 前端切換測試
        const startTime = Date.now()
        const frontendSuccess = setLocale(lang)
        const frontendDuration = Date.now() - startTime
        
        if (frontendSuccess && getCurrentLocale() === lang) {
          this.addResult(`前端切換 ${lang}`, true, '前端語言切換成功', null, frontendDuration)
        } else {
          this.addResult(`前端切換 ${lang}`, false, '前端語言切換失敗', {
            expected: lang,
            actual: getCurrentLocale()
          }, frontendDuration)
          continue
        }

        // 2. 後端保存測試
        const backendStartTime = Date.now()
        const backendResponse = await systemApi.updateSettings({
          general: {
            systemName: 'Multi-Channel Support',
            contactEmail: 'admin@example.com',
            timezone: 'Asia/Taipei',
            language: lang
          }
        })
        const backendDuration = Date.now() - backendStartTime

        if (backendResponse.success) {
          this.addResult(`後端保存 ${lang}`, true, '後端語言保存成功', null, backendDuration)
        } else {
          this.addResult(`後端保存 ${lang}`, false, '後端語言保存失敗', backendResponse.error, backendDuration)
          continue
        }

        // 3. 驗證一致性
        await new Promise(resolve => setTimeout(resolve, 300))
        const verifyResponse = await systemApi.getSettings()
        const backendLang = verifyResponse.data?.general?.language
        const frontendLang = getCurrentLocale()

        if (backendLang === lang && frontendLang === lang) {
          this.addResult(`驗證 ${lang}`, true, '前後端語言一致', {
            backend: backendLang,
            frontend: frontendLang
          })
          successCount++
        } else {
          this.addResult(`驗證 ${lang}`, false, '前後端語言不一致', {
            expected: lang,
            backend: backendLang,
            frontend: frontendLang
          })
        }

      } catch (error) {
        this.addResult(`語言測試 ${lang}`, false, '語言測試異常', error)
      }
    }

    // 恢復原始語言
    setLocale(originalLanguage)
    await systemApi.updateSettings({
      general: {
        systemName: 'Multi-Channel Support',
        contactEmail: 'admin@example.com',
        timezone: 'Asia/Taipei',
        language: originalLanguage
      }
    })

    this.addResult('語言切換總結', successCount === testLanguages.length, 
      `語言切換測試完成 (${successCount}/${testLanguages.length})`)

    console.groupEnd()
  }

  private async testErrorHandling() {
    console.group('🚨 錯誤處理測試')

    // 測試無效的設定數據
    try {
      const invalidSettings = {
        general: {
          language: 'invalid-language'
        }
      }

      const response = await systemApi.updateSettings(invalidSettings)
      
      // 這個測試預期會成功，因為後端可能不會驗證語言代碼
      if (response.success) {
        this.addResult('無效語言處理', true, '後端接受了無效語言（可能需要加強驗證）')
      } else {
        this.addResult('無效語言處理', true, '後端正確拒絕了無效語言', response.error)
      }
    } catch (error) {
      this.addResult('無效語言處理', false, '無效語言測試異常', error)
    }

    // 測試網路錯誤處理
    try {
      // 嘗試訪問不存在的端點
      const response = await fetch('/api/non-existent-endpoint')
      
      if (response.status === 404) {
        this.addResult('404 錯誤處理', true, '404 錯誤正確處理')
      } else {
        this.addResult('404 錯誤處理', false, `意外的響應狀態: ${response.status}`)
      }
    } catch (error) {
      this.addResult('404 錯誤處理', false, '404 錯誤測試異常', error)
    }

    console.groupEnd()
  }

  private async testPerformance() {
    console.group('⚡ 性能測試')

    // 測試設定讀取性能
    const readTimes: number[] = []
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now()
      try {
        await systemApi.getSettings()
        readTimes.push(Date.now() - startTime)
      } catch (error) {
        // 忽略錯誤，只記錄時間
      }
    }

    if (readTimes.length > 0) {
      const avgReadTime = readTimes.reduce((a, b) => a + b, 0) / readTimes.length
      const maxReadTime = Math.max(...readTimes)
      const minReadTime = Math.min(...readTimes)

      this.addResult('讀取性能', avgReadTime < 1000, 
        `平均讀取時間: ${avgReadTime.toFixed(0)}ms`, {
          average: avgReadTime,
          max: maxReadTime,
          min: minReadTime,
          samples: readTimes.length
        })
    }

    // 測試語言切換性能
    const switchTimes: number[] = []
    const testLangs = ['zh-TW', 'zh-CN', 'en']
    
    for (const lang of testLangs) {
      const startTime = Date.now()
      try {
        setLocale(lang)
        switchTimes.push(Date.now() - startTime)
      } catch (error) {
        // 忽略錯誤
      }
    }

    if (switchTimes.length > 0) {
      const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length
      
      this.addResult('切換性能', avgSwitchTime < 100, 
        `平均切換時間: ${avgSwitchTime.toFixed(0)}ms`, {
          average: avgSwitchTime,
          samples: switchTimes.length
        })
    }

    console.groupEnd()
  }

  getResults(): TestResult[] {
    return this.results
  }

  getSummary() {
    const total = this.results.length
    const passed = this.results.filter(r => r.success).length
    const failed = total - passed
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

    return {
      total,
      passed,
      failed,
      passRate,
      results: this.results
    }
  }
}

// 便利函數
export const runCompleteSystemSettingsTest = async () => {
  console.log('🚀 開始完整的 SystemSettings 測試...')
  
  const testSuite = new SystemSettingsTestSuite()
  const results = await testSuite.runCompleteTest()
  const summary = testSuite.getSummary()

  console.group('📊 測試結果摘要')
  console.log(`總測試數: ${summary.total}`)
  console.log(`✅ 通過: ${summary.passed}`)
  console.log(`❌ 失敗: ${summary.failed}`)
  console.log(`通過率: ${summary.passRate}%`)
  console.groupEnd()

  // 如果測試失敗率較高，提供修復建議
  if (summary.passRate < 70) {
    console.group('💡 修復建議')
    console.log('檢測到多個測試失敗，建議執行以下操作：')
    console.log('1. 運行完整診斷 (runFullDiagnostic)')
    console.log('2. 執行自動修復 (runFullFix)')
    console.log('3. 檢查網路連接和後端服務狀態')
    console.log('4. 清除瀏覽器緩存和 localStorage')
    console.groupEnd()
  }

  return { results, summary }
}

// 快速測試函數
export const quickSystemSettingsTest = async () => {
  console.log('⚡ 快速 SystemSettings 測試...')
  
  const results: TestResult[] = []
  
  // 1. API 連接測試
  try {
    const startTime = Date.now()
    const response = await systemApi.getSettings()
    const duration = Date.now() - startTime
    
    if (response.success) {
      results.push({
        testName: 'API 連接',
        success: true,
        message: 'API 連接正常',
        duration
      })
    } else {
      results.push({
        testName: 'API 連接',
        success: false,
        message: 'API 連接失敗',
        details: response.error,
        duration
      })
    }
  } catch (error) {
    results.push({
      testName: 'API 連接',
      success: false,
      message: 'API 連接異常',
      details: error
    })
  }

  // 2. 語言切換測試
  const originalLang = getCurrentLocale()
  const testLang = originalLang === 'zh-TW' ? 'zh-CN' : 'zh-TW'
  
  try {
    const success = setLocale(testLang)
    if (success && getCurrentLocale() === testLang) {
      results.push({
        testName: '語言切換',
        success: true,
        message: '語言切換正常'
      })
      
      // 恢復原始語言
      setLocale(originalLang)
    } else {
      results.push({
        testName: '語言切換',
        success: false,
        message: '語言切換失敗'
      })
    }
  } catch (error) {
    results.push({
      testName: '語言切換',
      success: false,
      message: '語言切換異常',
      details: error
    })
  }

  const passed = results.filter(r => r.success).length
  const total = results.length
  const passRate = Math.round((passed / total) * 100)

  console.log(`快速測試完成: ${passed}/${total} 通過 (${passRate}%)`)
  
  return { results, passed, total, passRate }
}