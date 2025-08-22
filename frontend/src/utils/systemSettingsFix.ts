// SystemSettings 語言設定修復工具
import { systemApi } from '@/api/system'
import { setLocale, getCurrentLocale } from '@/plugins/i18n'

interface FixResult {
  step: string
  success: boolean
  message: string
  details?: unknown
}

export class SystemSettingsFix {
  private results: FixResult[] = []

  private addResult(step: string, success: boolean, message: string, details?: unknown) {
    this.results.push({ step, success, message, details })
    console.log(`${success ? '✅' : '❌'} ${step}: ${message}`)
    if (details) {
      console.log('   Details:', details)
    }
  }

  async fixLanguageSettingIssues(): Promise<FixResult[]> {
    console.group('🔧 修復語言設定問題')
    this.results = []

    try {
      // 1. 清理 localStorage
      await this.cleanLocalStorage()

      // 2. 初始化系統設定
      await this.initializeSystemSettings()

      // 3. 修復前後端同步
      await this.fixFrontendBackendSync()

      // 4. 測試語言切換
      await this.testLanguageSwitchingAfterFix()

    } catch (error) {
      this.addResult('修復過程', false, '修復過程中發生錯誤', error)
    }

    console.groupEnd()
    return this.results
  }

  private async cleanLocalStorage() {
    console.group('🧹 清理 localStorage')

    try {
      // 清除可能損壞的語言設定
      const oldLocale = localStorage.getItem('locale')
      localStorage.removeItem('locale')
      this.addResult('清除舊設定', true, `已清除舊的語言設定: ${oldLocale}`)

      // 清除其他可能相關的設定
      const keysToRemove = ['i18n-locale', 'language', 'lang']
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key)
          this.addResult(`清除 ${key}`, true, `已清除 ${key}`)
        }
      })

      // 設定預設語言
      localStorage.setItem('locale', 'zh-TW')
      this.addResult('設定預設語言', true, '已設定預設語言為 zh-TW')

    } catch (error) {
      this.addResult('localStorage 清理', false, 'localStorage 清理失敗', error)
    }

    console.groupEnd()
  }

  private async initializeSystemSettings() {
    console.group('⚙️ 初始化系統設定')

    try {
      // 獲取當前設定
      const currentSettings = await systemApi.getSettings()
      
      if (!currentSettings.success) {
        this.addResult('獲取設定', false, '無法獲取當前系統設定', currentSettings.error)
        console.groupEnd()
        return
      }

      // 檢查是否需要初始化
      const needsInit = !currentSettings.data?.general?.language
      
      if (needsInit) {
        console.log('需要初始化系統設定...')
        
        const defaultSettings = {
          general: {
            systemName: 'Multi-Channel Support',
            contactEmail: 'admin@example.com',
            timezone: 'Asia/Taipei',
            language: 'zh-TW'
          }
        }

        const initResponse = await systemApi.updateSettings(defaultSettings)
        
        if (initResponse.success) {
          this.addResult('初始化設定', true, '系統設定初始化成功')
        } else {
          this.addResult('初始化設定', false, '系統設定初始化失敗', initResponse.error)
        }
      } else {
        this.addResult('檢查設定', true, '系統設定已存在，無需初始化')
      }

    } catch (error) {
      this.addResult('初始化設定', false, '初始化過程發生錯誤', error)
    }

    console.groupEnd()
  }

  private async fixFrontendBackendSync() {
    console.group('🔄 修復前後端同步')

    try {
      // 獲取後端語言設定
      const settings = await systemApi.getSettings()
      
      if (!settings.success || !settings.data) {
        this.addResult('獲取後端設定', false, '無法獲取後端語言設定')
        console.groupEnd()
        return
      }

      const backendLanguage = settings.data.general?.language || 'zh-TW'
      const frontendLanguage = getCurrentLocale()

      console.log(`後端語言: ${backendLanguage}, 前端語言: ${frontendLanguage}`)

      if (backendLanguage !== frontendLanguage) {
        // 同步前端到後端語言
        const syncSuccess = setLocale(backendLanguage)
        
        if (syncSuccess) {
          this.addResult('同步語言', true, `已同步前端語言到: ${backendLanguage}`)
          
          // 更新 localStorage
          localStorage.setItem('locale', backendLanguage)
          
          // 更新 HTML lang 屬性
          document.documentElement.lang = backendLanguage
          
        } else {
          this.addResult('同步語言', false, `語言同步失敗: ${backendLanguage}`)
        }
      } else {
        this.addResult('檢查同步', true, '前後端語言已同步')
      }

    } catch (error) {
      this.addResult('前後端同步', false, '同步過程發生錯誤', error)
    }

    console.groupEnd()
  }

  private async testLanguageSwitchingAfterFix() {
    console.group('🧪 測試修復後的語言切換')

    const testLanguages = ['zh-TW', 'zh-CN', 'en']
    let successCount = 0

    for (const lang of testLanguages) {
      try {
        console.log(`測試切換到 ${lang}...`)
        
        // 1. 前端切換
        const frontendSuccess = setLocale(lang)
        
        // 2. 後端保存
        const backendResponse = await systemApi.updateSettings({
          general: {
            systemName: 'Multi-Channel Support',
            contactEmail: 'admin@example.com', 
            timezone: 'Asia/Taipei',
            language: lang
          }
        })

        // 3. 驗證
        await new Promise(resolve => setTimeout(resolve, 300))
        const verifyResponse = await systemApi.getSettings()
        const backendLang = verifyResponse.data?.general?.language
        const frontendLang = getCurrentLocale()

        const testSuccess = frontendSuccess && 
                           backendResponse.success && 
                           backendLang === lang && 
                           frontendLang === lang

        if (testSuccess) {
          this.addResult(`測試 ${lang}`, true, '語言切換測試成功')
          successCount++
        } else {
          this.addResult(`測試 ${lang}`, false, '語言切換測試失敗', {
            frontendSuccess,
            backendSuccess: backendResponse.success,
            backendLang,
            frontendLang,
            expected: lang
          })
        }

      } catch (error) {
        this.addResult(`測試 ${lang}`, false, '語言切換測試異常', error)
      }
    }

    // 恢復到繁體中文
    setLocale('zh-TW')
    await systemApi.updateSettings({
      general: {
        systemName: 'Multi-Channel Support',
        contactEmail: 'admin@example.com',
        timezone: 'Asia/Taipei', 
        language: 'zh-TW'
      }
    })

    this.addResult('測試總結', successCount === testLanguages.length, 
      `語言切換測試完成 (${successCount}/${testLanguages.length})`)

    console.groupEnd()
  }

  getResults(): FixResult[] {
    return this.results
  }

  getSuccessRate(): number {
    const total = this.results.length
    const success = this.results.filter(r => r.success).length
    return total > 0 ? Math.round((success / total) * 100) : 0
  }
}

// 便利函數
export const fixSystemSettingsLanguage = async () => {
  const fixer = new SystemSettingsFix()
  const results = await fixer.fixLanguageSettingIssues()
  const successRate = fixer.getSuccessRate()

  console.group('📊 修復結果摘要')
  console.log(`修復項目: ${results.length}`)
  console.log(`成功率: ${successRate}%`)
  
  const failures = results.filter(r => !r.success)
  if (failures.length > 0) {
    console.log('失敗項目:')
    failures.forEach(f => console.log(`  - ${f.step}: ${f.message}`))
  }
  console.groupEnd()

  return { results, successRate }
}

// 快速修復函數
export const quickFixLanguageSettings = async () => {
  console.log('🚀 快速修復語言設定問題...')
  
  try {
    // 1. 清理並重設 localStorage
    localStorage.removeItem('locale')
    localStorage.setItem('locale', 'zh-TW')
    
    // 2. 重設前端語言
    setLocale('zh-TW')
    
    // 3. 確保後端有預設設定
    const response = await systemApi.updateSettings({
      general: {
        systemName: 'Multi-Channel Support',
        contactEmail: 'admin@example.com',
        timezone: 'Asia/Taipei',
        language: 'zh-TW'
      }
    })
    
    if (response.success) {
      console.log('✅ 快速修復完成')
      return true
    } else {
      console.error('❌ 快速修復失敗:', response.error)
      return false
    }
    
  } catch (error) {
    console.error('❌ 快速修復異常:', error)
    return false
  }
}