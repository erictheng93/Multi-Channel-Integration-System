// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/config/security.ts
// Created by: Frontend Security Configuration

/**
 * 安全配置介面
 */
interface SecurityConfig {
  environment: {
    HTTPS_REQUIRED: boolean
    SECURE_COOKIES: boolean
    STRICT_CSP: boolean
  }
  ERROR: {
    SHOW_DETAILED_ERRORS: boolean
  }
  checks: {
    checkBrowserSecurity: () => BrowserSecurityCheck
    isSecureContext: () => boolean
    checkCSPSupport: () => boolean
  }
}

/**
 * 瀏覽器安全檢查結果
 */
interface BrowserSecurityCheck {
  localStorage: boolean
  crypto: boolean
}

/**
 * 驗證安全環境變數
 */
export const validateSecurityEnvironment = (): void => {
  // 檢查必要的環境變數
  const requiredEnvVars = ['VITE_API_BASE_URL']
  
  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`)
    }
  }
  
  // 在生產環境中檢查 HTTPS
  if (import.meta.env.PROD && !window.location.protocol.startsWith('https')) {
    console.warn('⚠️ Application is running over HTTP in production mode')
  }
}

/**
 * 獲取當前安全配置
 */
export const getCurrentSecurityConfig = (): SecurityConfig => {
  const isDev = import.meta.env.DEV
  
  return {
    environment: {
      HTTPS_REQUIRED: !isDev,
      SECURE_COOKIES: !isDev,
      STRICT_CSP: !isDev
    },
    ERROR: {
      SHOW_DETAILED_ERRORS: isDev
    },
    checks: {
      checkBrowserSecurity: (): BrowserSecurityCheck => ({
        localStorage: typeof Storage !== 'undefined',
        crypto: typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      }),
      isSecureContext: (): boolean => {
        return window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      },
      checkCSPSupport: (): boolean => {
        return 'SecurityPolicyViolationEvent' in window
      }
    }
  }
}

/**
 * 安全常數
 */
export const SECURITY_CONSTANTS = {
  TOKEN_STORAGE_KEY: 'auth_token',
  REFRESH_TOKEN_STORAGE_KEY: 'refresh_token',
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
} as const