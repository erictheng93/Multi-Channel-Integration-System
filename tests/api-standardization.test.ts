// API 標準化測試
// 驗證所有 API 端點都使用統一的響應格式和錯誤處理

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// 模擬 Cloudflare Workers 環境
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        first: () => Promise.resolve(null),
        all: () => Promise.resolve({ results: [] }),
        run: () => Promise.resolve({ meta: { last_row_id: 1 } })
      })
    })
  },
  JWT_SECRET: 'test-secret',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  FB_VERIFY_TOKEN: 'test-verify-token'
}

// 模擬 Hono Context
const createMockContext = (method: string = 'GET', path: string = '/', body?: any) => ({
  req: {
    method,
    url: `http://localhost${path}`,
    header: (name: string) => {
      if (name === 'Authorization') return 'Bearer test-token'
      if (name === 'X-Line-Signature') return 'test-signature'
      return null
    },
    param: (name: string) => {
      const params: Record<string, string> = {
        id: 'test-id',
        token: 'test-token',
        attachmentId: 'test-attachment-id',
        backupId: 'test-backup-id',
        platform: 'line'
      }
      return params[name]
    },
    query: (name?: string) => {
      const queries: Record<string, string> = {
        page: '1',
        pageSize: '20',
        status: 'open',
        type: 'image'
      }
      return name ? queries[name] : queries
    },
    json: () => Promise.resolve(body || {}),
    text: () => Promise.resolve(JSON.stringify(body || {})),
    formData: () => Promise.resolve(new FormData())
  },
  env: mockEnv,
  get: (key: string) => {
    if (key === 'jwtPayload') {
      return { userId: 'test-user-id', role: 'admin' }
    }
    return null
  },
  json: (data: any, status?: number) => new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  })
})

describe('API 標準化測試', () => {
  describe('響應格式標準化', () => {
    test('成功響應應該包含標準字段', async () => {
      const { successResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const response = successResponse(mockContext, { test: 'data' }, 'Test message')
      const data = await response.json()
      
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('message', 'Test message')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
      expect(data.requestId).toMatch(/^req_\d+_[a-z0-9]+$/)
    })

    test('錯誤響應應該包含標準字段', async () => {
      const { errorResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const response = errorResponse(mockContext, 'Test error', 400)
      const data = await response.json()
      
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error', 'Test error')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
      expect(response.status).toBe(400)
    })

    test('分頁響應應該包含分頁信息', async () => {
      const { paginatedResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const testData = [{ id: 1 }, { id: 2 }]
      const pagination = { page: 1, limit: 20, total: 100 }
      
      const response = paginatedResponse(mockContext, testData, pagination, 'Test message')
      const data = await response.json()
      
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('data', testData)
      expect(data).toHaveProperty('pagination')
      expect(data.pagination).toHaveProperty('page', 1)
      expect(data.pagination).toHaveProperty('limit', 20)
      expect(data.pagination).toHaveProperty('total', 100)
      expect(data.pagination).toHaveProperty('totalPages', 5)
      expect(data.pagination).toHaveProperty('hasNext', true)
      expect(data.pagination).toHaveProperty('hasPrev', false)
    })

    test('驗證錯誤響應應該包含詳細錯誤信息', async () => {
      const { validationErrorResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const errors = [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is too short', value: 'abc' }
      ]
      
      const response = validationErrorResponse(mockContext, errors)
      const data = await response.json()
      
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error', 'Validation failed')
      expect(data).toHaveProperty('data.code', 'VALIDATION_ERROR')
      expect(data).toHaveProperty('data.errors', errors)
      expect(response.status).toBe(422)
    })
  })

  describe('處理器標準化測試', () => {
    test('認證處理器應該使用標準響應', async () => {
      const { authHandler } = await import('../src/handlers/auth')
      const mockContext = createMockContext('POST', '/auth/login', {
        email: 'test@example.com',
        password: 'password123'
      })
      
      // 模擬認證成功
      mockContext.env.DB.prepare = () => ({
        bind: () => ({
          first: () => Promise.resolve({
            id: 1,
            email: 'test@example.com',
            displayName: 'Test User',
            role: 'agent',
            isActive: 1,
            createdAt: '2024-01-01T00:00:00Z'
          })
        })
      })
      
      const response = await authHandler.login(mockContext)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
    })

    test('對話處理器應該使用標準響應', async () => {
      const { conversationHandler } = await import('../src/handlers/conversation')
      const mockContext = createMockContext('GET', '/conversations')
      
      const response = await conversationHandler.list(mockContext)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
      
      if (data.success) {
        expect(data).toHaveProperty('pagination')
      }
    })

    test('訊息處理器應該使用標準響應', async () => {
      const { messageHandler } = await import('../src/handlers/message')
      const mockContext = createMockContext('GET', '/conversations/test-id/messages')
      
      const response = await messageHandler.list(mockContext)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
    })

    test('附件處理器應該使用標準響應', async () => {
      const { attachmentHandler } = await import('../src/handlers/attachment')
      const mockContext = createMockContext('GET', '/conversations/test-id/attachments/test-attachment-id')
      
      const response = await attachmentHandler.get(mockContext)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
    })

    test('系統處理器應該使用標準響應', async () => {
      const { getSystemInfo } = await import('../src/handlers/system')
      const mockContext = createMockContext('GET', '/system/info')
      
      const response = await getSystemInfo(mockContext)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
    })

    test('團隊處理器應該使用標準響應', async () => {
      const { getTeamMembers } = await import('../src/handlers/team')
      const mockContext = createMockContext('GET', '/team/members')
      
      const response = await getTeamMembers(mockContext)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('requestId')
    })
  })

  describe('錯誤處理標準化測試', () => {
    test('應該正確處理未授權錯誤', async () => {
      const { unauthorizedResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const response = unauthorizedResponse(mockContext, 'Custom unauthorized message')
      const data = await response.json()
      
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error', 'Custom unauthorized message')
      expect(response.status).toBe(401)
    })

    test('應該正確處理禁止訪問錯誤', async () => {
      const { forbiddenResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const response = forbiddenResponse(mockContext, 'Custom forbidden message')
      const data = await response.json()
      
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error', 'Custom forbidden message')
      expect(response.status).toBe(403)
    })

    test('應該正確處理資源未找到錯誤', async () => {
      const { notFoundResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const response = notFoundResponse(mockContext, 'User')
      const data = await response.json()
      
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error', 'User not found')
      expect(response.status).toBe(404)
    })

    test('應該正確處理內部錯誤', async () => {
      const { internalErrorResponse } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      const response = internalErrorResponse(mockContext, 'Custom internal error')
      const data = await response.json()
      
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error', 'Custom internal error')
      expect(response.status).toBe(500)
    })

    test('handleApiError 應該正確處理不同類型的錯誤', async () => {
      const { handleApiError } = await import('../src/utils/api-response')
      const mockContext = createMockContext()
      
      // 測試驗證錯誤
      const validationError = new Error('Validation failed')
      validationError.name = 'ValidationError'
      ;(validationError as any).errors = [{ field: 'email', message: 'Invalid email' }]
      
      const response = handleApiError(validationError, mockContext)
      const data = await response.json()
      
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error', 'Validation failed')
      expect(response.status).toBe(422)
    })
  })

  describe('類型定義一致性測試', () => {
    test('共用類型應該正確導出', async () => {
      const apiTypes = await import('../shared/api-types')
      
      expect(apiTypes).toHaveProperty('API_ERROR_CODES')
      expect(apiTypes).toHaveProperty('HTTP_STATUS')
      expect(apiTypes.API_ERROR_CODES).toHaveProperty('UNAUTHORIZED')
      expect(apiTypes.API_ERROR_CODES).toHaveProperty('VALIDATION_ERROR')
      expect(apiTypes.HTTP_STATUS).toHaveProperty('OK', 200)
      expect(apiTypes.HTTP_STATUS).toHaveProperty('UNAUTHORIZED', 401)
    })

    test('前端類型應該包含共用類型', async () => {
      const frontendTypes = await import('../frontend/src/types/index')
      
      expect(frontendTypes).toHaveProperty('API_ERROR_CODES')
      expect(frontendTypes).toHaveProperty('HTTP_STATUS')
    })
  })
})

describe('API 客戶端標準化測試', () => {
  test('現代化 API 客戶端應該正確處理標準響應', async () => {
    const { ModernApiClient } = await import('../frontend/src/api/modern-client')
    
    // 模擬 fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: { test: 'data' },
        message: 'Success',
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'req_123_abc'
      })
    })
    
    const client = new ModernApiClient({ baseURL: 'http://localhost:8787' })
    const response = await client.get('/test')
    
    expect(response).toHaveProperty('success', true)
    expect(response).toHaveProperty('data')
    expect(response).toHaveProperty('message', 'Success')
    expect(response).toHaveProperty('status', 200)
  })

  test('現代化 API 客戶端應該正確處理錯誤響應', async () => {
    const { ModernApiClient } = await import('../frontend/src/api/modern-client')
    
    // 模擬 fetch 錯誤響應
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({
        success: false,
        error: 'Bad request',
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'req_123_abc'
      })
    })
    
    const client = new ModernApiClient({ baseURL: 'http://localhost:8787' })
    const response = await client.get('/test')
    
    expect(response).toHaveProperty('success', false)
    expect(response).toHaveProperty('error', 'Bad request')
    expect(response).toHaveProperty('status', 400)
  })
})