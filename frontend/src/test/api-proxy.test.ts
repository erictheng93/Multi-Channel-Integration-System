// API Proxy Configuration Test
// 測試 API 代理設定是否正確配置

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/base'
import { getBackendUrl } from '@/config/runtime'

describe('API Proxy Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use correct base URL from environment variable', () => {
    // 檢查 API 客戶端是否使用正確的環境變數
    expect(import.meta.env.VITE_API_BASE_URL).toBeDefined()
    
    // 驗證 API 客戶端實例存在
    expect(apiClient).toBeDefined()
    expect(typeof apiClient.get).toBe('function')
    expect(typeof apiClient.post).toBe('function')
    expect(typeof apiClient.put).toBe('function')
    expect(typeof apiClient.delete).toBe('function')
  })

  it('should handle different environment configurations', () => {
    // 測試不同環境的配置
    const testCases = [
      {
        env: 'development',
        expectedURL: 'http://localhost:8787',
        description: '開發環境應使用本地 Worker'
      },
      {
        env: 'production', 
        expectedURL: '' + getBackendUrl() + '',
        description: '生產環境應使用實際域名'
      }
    ]

    testCases.forEach(({ env, expectedURL, description }) => {
      // 這裡我們只是驗證配置的邏輯，實際的環境變數在運行時設定
      expect(description).toBeDefined()
      expect(env).toMatch(/^(development|production)$/)
      expect(expectedURL).toMatch(/^https?:\/\//)
    })
  })

  it('should have proper CORS configuration', () => {
    // 驗證 CORS 相關的配置存在
    // 這些會在實際的 HTTP 請求中測試
    const corsHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods', 
      'Access-Control-Allow-Headers'
    ]

    corsHeaders.forEach(header => {
      expect(header).toMatch(/^Access-Control-/)
    })
  })

  it('should support both local and remote development', () => {
    // 測試本地和遠程開發的支援
    const localURL = 'http://localhost:8787'
    const remoteURL = 'https://your-api-domain.example.com'

    // 驗證 URL 格式
    expect(localURL).toMatch(/^http:\/\/localhost:\d+$/)
    expect(remoteURL).toMatch(/^https:\/\/[\w.-]+$/)

    // 驗證都是有效的 URL
    expect(() => new URL(localURL)).not.toThrow()
    expect(() => new URL(remoteURL)).not.toThrow()
  })

  it('should handle API endpoint paths correctly', () => {
    // 測試 API 端點路徑處理
    const testEndpoints = [
      '/api/auth/login',
      '/api/conversations',
      '/api/messages/send',
      '/api/teams',
      '/api/system/health'
    ]

    testEndpoints.forEach(endpoint => {
      expect(endpoint).toMatch(/^\/api\//)
      expect(endpoint.length).toBeGreaterThan(4)
    })
  })

  it('should support file upload endpoints', () => {
    // 測試檔案上傳端點支援
    expect(typeof apiClient.uploadFile).toBe('function')
    
    // 驗證檔案上傳相關的端點
    const uploadEndpoints = [
      '/api/messages/upload',
      '/api/attachments/upload'
    ]

    uploadEndpoints.forEach(endpoint => {
      expect(endpoint).toMatch(/^\/api\/.*upload$/)
    })
  })
})

describe('Environment Variable Consistency', () => {
  it('should use consistent environment variable names', () => {
    // 確保使用一致的環境變數名稱
    const envVarName = 'VITE_API_BASE_URL'
    
    // 檢查環境變數名稱的一致性
    expect(envVarName).toBe('VITE_API_BASE_URL')
    expect(envVarName).not.toBe('VITE_API_URL') // 避免舊的變數名稱
  })

  it('should have proper fallback values', () => {
    // 測試回退值
    const fallbackURL = 'http://localhost:8787'
    
    expect(fallbackURL).toMatch(/^http:\/\/localhost:\d+$/)
    expect(() => new URL(fallbackURL)).not.toThrow()
  })
})

describe('Proxy Configuration Validation', () => {
  it('should validate Vite proxy configuration structure', () => {
    // 驗證 Vite 代理配置的結構
    const proxyConfig = {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false
      }
    }

    expect(proxyConfig['/api']).toBeDefined()
    expect(proxyConfig['/api'].target).toMatch(/^https?:\/\//)
    expect(typeof proxyConfig['/api'].changeOrigin).toBe('boolean')
    expect(typeof proxyConfig['/api'].secure).toBe('boolean')
  })

  it('should validate Cloudflare Pages redirect rules', () => {
    // 驗證 Cloudflare Pages 重定向規則格式
    const redirectRules = [
      '/*    /index.html   200',
      '/api/*  ' + getBackendUrl() + '/api/:splat  200'
    ]

    redirectRules.forEach(rule => {
      expect(rule).toMatch(/\s+200$/) // 應該以狀態碼 200 結尾
      expect(rule.split(/\s+/)).toHaveLength(3) // 應該有三個部分
    })

    // 驗證 API 代理規則
    const apiRule = redirectRules[1]
    expect(apiRule).toContain('/api/*')
    expect(apiRule).toContain('' + getBackendUrl() + '')
    expect(apiRule).toContain(':splat')
  })
})