// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/utils/securityInit.ts
// Created by: Frontend Security Initialization

import { validateSecurityEnvironment, getCurrentSecurityConfig } from '@/config/security'

/**
 * 初始化應用程式安全配置
 * 在應用程式啟動時調用此函數
 */
export const initializeSecurity = async (): Promise<void> => {
  try {
    console.log('🔒 Initializing security configuration...')
    
    // 驗證環境變數
    validateSecurityEnvironment()
    
    // 獲取安全配置
    const securityConfig = getCurrentSecurityConfig()
    
    // 檢查瀏覽器安全功能
    const browserSecurity = securityConfig.checks.checkBrowserSecurity()
    
    // 記錄安全狀態
    console.log('✅ Security validation passed')
    console.log('🌐 Browser security features:', {
      localStorage: browserSecurity.localStorage,
      crypto: browserSecurity.crypto,
      secureContext: securityConfig.checks.isSecureContext(),
    })
    
    // 在開發環境中顯示額外信息
    if (import.meta.env.DEV) {
      console.log('🔧 Development mode security settings:', {
        httpsRequired: securityConfig.environment.HTTPS_REQUIRED,
        secureCookies: securityConfig.environment.SECURE_COOKIES,
        strictCSP: securityConfig.environment.STRICT_CSP,
      })
    }
    
    // 設置全局錯誤處理
    setupGlobalErrorHandling(securityConfig)
    
  } catch (error) {
    console.error('❌ Security initialization failed:', error)
    
    // 在生產環境中，安全驗證失敗應該阻止應用程式啟動
    if (import.meta.env.PROD) {
      throw new Error('Application cannot start due to security configuration errors')
    }
    
    // 在開發環境中，顯示警告但允許繼續
    console.warn('⚠️ Continuing in development mode with security warnings')
  }
}

/**
 * 設置全局錯誤處理
 */
const setupGlobalErrorHandling = (securityConfig: { ERROR: { SHOW_DETAILED_ERRORS: boolean }; checks: { checkCSPSupport: () => boolean } }) => {
  // 處理未捕獲的錯誤
  window.addEventListener('error', (event) => {
    // 忽略 null 错误（通常由浏览器扩展或第三方脚本触发）
    if (event.error === null || event.error === undefined) {
      return
    }

    console.error('Global error:', event.error)

    // 在生產環境中不顯示詳細錯誤
    if (!securityConfig.ERROR.SHOW_DETAILED_ERRORS) {
      event.preventDefault()
      // 可以在這裡發送錯誤報告到後端
    }
  })
  
  // 處理未處理的 Promise 拒絕
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    
    // 在生產環境中不顯示詳細錯誤
    if (!securityConfig.ERROR.SHOW_DETAILED_ERRORS) {
      event.preventDefault()
      // 可以在這裡發送錯誤報告到後端
    }
  })
  
  // 設置 CSP 違規報告
  if (securityConfig.checks.checkCSPSupport()) {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.warn('CSP violation:', {
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
      })
      
      // 可以在這裡發送 CSP 違規報告到後端
    })
  }
}

/**
 * 生成安全的隨機字符串
 */
export const generateSecureRandomString = (length: number = 32): string => {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * 檢查當前環境是否安全
 */
export const isSecureEnvironment = (): boolean => {
  try {
    validateSecurityEnvironment()
    return true
  } catch {
    return false
  }
}