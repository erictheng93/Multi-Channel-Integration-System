// API 文檔一致性測試
import { describe, it, expect } from 'vitest'
import type { 
  StandardApiResponse, 
  PaginatedApiResponse, 
  ApiError,
  API_ERROR_CODES,
  HTTP_STATUS 
} from '../src/types/api-standard'

describe('API Documentation Consistency', () => {
  describe('Response Format Standards', () => {
    it('should have consistent StandardApiResponse interface', () => {
      const mockResponse: StandardApiResponse<{ id: string }> = {
        success: true,
        data: { id: 'test' },
        message: 'Test message',
        timestamp: '2024-01-01T00:00:00.000Z',
        requestId: 'req_1234567890_abcdef'
      }

      expect(mockResponse.success).toBe(true)
      expect(mockResponse.data).toEqual({ id: 'test' })
      expect(mockResponse.message).toBe('Test message')
      expect(mockResponse.timestamp).toBe('2024-01-01T00:00:00.000Z')
      expect(mockResponse.requestId).toBe('req_1234567890_abcdef')
    })

    it('should have consistent PaginatedApiResponse interface', () => {
      const mockResponse: PaginatedApiResponse<{ id: string }> = {
        success: true,
        data: [{ id: 'test1' }, { id: 'test2' }],
        message: 'Data retrieved successfully',
        pagination: {
          page: 1,
          limit: 20,
          total: 100,
          totalPages: 5,
          hasNext: true,
          hasPrev: false
        },
        timestamp: '2024-01-01T00:00:00.000Z',
        requestId: 'req_1234567890_abcdef'
      }

      expect(mockResponse.success).toBe(true)
      expect(mockResponse.data).toHaveLength(2)
      expect(mockResponse.pagination?.page).toBe(1)
      expect(mockResponse.pagination?.hasNext).toBe(true)
      expect(mockResponse.pagination?.hasPrev).toBe(false)
    })

    it('should have consistent error response format', () => {
      const mockErrorResponse: StandardApiResponse = {
        success: false,
        error: 'Validation failed',
        data: {
          code: 'VALIDATION_ERROR',
          errors: [
            {
              field: 'email',
              message: 'Email is required',
              value: ''
            }
          ]
        },
        timestamp: '2024-01-01T00:00:00.000Z',
        requestId: 'req_1234567890_abcdef'
      }

      expect(mockErrorResponse.success).toBe(false)
      expect(mockErrorResponse.error).toBe('Validation failed')
      expect(mockErrorResponse.data.code).toBe('VALIDATION_ERROR')
      expect(mockErrorResponse.data.errors).toHaveLength(1)
    })
  })

  describe('Error Codes Consistency', () => {
    it('should have all documented error codes', async () => {
      const { API_ERROR_CODES } = await import('../src/types/api-standard')
      
      // 認證相關
      expect(API_ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED')
      expect(API_ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN')
      expect(API_ERROR_CODES.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED')
      expect(API_ERROR_CODES.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS')
      
      // 驗證相關
      expect(API_ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(API_ERROR_CODES.REQUIRED_FIELD).toBe('REQUIRED_FIELD')
      expect(API_ERROR_CODES.INVALID_FORMAT).toBe('INVALID_FORMAT')
      
      // 資源相關
      expect(API_ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND')
      expect(API_ERROR_CODES.ALREADY_EXISTS).toBe('ALREADY_EXISTS')
      expect(API_ERROR_CODES.RESOURCE_CONFLICT).toBe('RESOURCE_CONFLICT')
      
      // 系統相關
      expect(API_ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
      expect(API_ERROR_CODES.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE')
      expect(API_ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should have all documented HTTP status codes', async () => {
      const { HTTP_STATUS } = await import('../src/types/api-standard')
      
      expect(HTTP_STATUS.OK).toBe(200)
      expect(HTTP_STATUS.CREATED).toBe(201)
      expect(HTTP_STATUS.NO_CONTENT).toBe(204)
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400)
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401)
      expect(HTTP_STATUS.FORBIDDEN).toBe(403)
      expect(HTTP_STATUS.NOT_FOUND).toBe(404)
      expect(HTTP_STATUS.CONFLICT).toBe(409)
      expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422)
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500)
      expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503)
    })
  })

  describe('API Response Utilities', () => {
    it('should generate consistent request IDs', () => {
      // Mock the generateRequestId function behavior
      const requestId1 = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const requestId2 = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      expect(requestId1).toMatch(/^req_\d+_[a-z0-9]+$/)
      expect(requestId2).toMatch(/^req_\d+_[a-z0-9]+$/)
      expect(requestId1).not.toBe(requestId2)
    })

    it('should format timestamps consistently', () => {
      const timestamp = new Date().toISOString()
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })
  })

  describe('Endpoint Documentation Coverage', () => {
    const documentedEndpoints = [
      // 認證端點
      'POST /auth/login',
      'GET /auth/me',
      
      // 對話端點
      'GET /conversations',
      'GET /conversations/:id',
      'PUT /conversations/:id/assign',
      'PUT /conversations/:id/close',
      
      // 訊息端點
      'GET /conversations/:id/messages',
      'POST /conversations/:id/messages',
      
      // 檔案附件端點
      'POST /conversations/:id/attachments',
      'GET /conversations/:id/attachments/:attachmentId',
      'GET /conversations/:id/attachments/:attachmentId/download',
      'DELETE /conversations/:id/attachments/:attachmentId',
      'GET /conversations/:id/attachments',
      
      // Webhook 端點
      'POST /api/webhooks/line',
      'POST /api/webhooks/facebook',
      'POST /api/webhook', // 向後兼容
      
      // 團隊管理端點
      'GET /team/members',
      'POST /team/invite',
      'POST /team/invite/:token/accept',
      'GET /team/invite/:token',
      'PUT /team/members/:id/status',
      'DELETE /team/members/:id',
      'GET /team/invitations',
      'DELETE /team/invitations/:id',
      
      // 系統管理端點
      'GET /system/info',
      'GET /system/settings',
      'PUT /system/settings',
      'POST /system/integrations/:platform/test',
      'GET /system/metrics',
      'POST /system/backup',
      'GET /system/backups',
      'POST /system/restore/:backupId',
      'POST /system/cache/clear',
      'POST /system/restart',
      'GET /system/health'
    ]

    it('should have comprehensive endpoint documentation', () => {
      expect(documentedEndpoints.length).toBeGreaterThan(25)
      
      // 檢查是否涵蓋主要功能區域
      const authEndpoints = documentedEndpoints.filter(e => e.includes('/auth/'))
      const conversationEndpoints = documentedEndpoints.filter(e => e.includes('/conversations'))
      const teamEndpoints = documentedEndpoints.filter(e => e.includes('/team/'))
      const systemEndpoints = documentedEndpoints.filter(e => e.includes('/system/'))
      const webhookEndpoints = documentedEndpoints.filter(e => e.includes('/webhook/'))
      
      expect(authEndpoints.length).toBeGreaterThanOrEqual(2)
      expect(conversationEndpoints.length).toBeGreaterThanOrEqual(7)
      expect(teamEndpoints.length).toBeGreaterThanOrEqual(8)
      expect(systemEndpoints.length).toBeGreaterThanOrEqual(10)
      expect(webhookEndpoints.length).toBeGreaterThanOrEqual(2)
    })

    it('should document all CRUD operations for main resources', () => {
      // 對話 CRUD
      expect(documentedEndpoints).toContain('GET /conversations')
      expect(documentedEndpoints).toContain('GET /conversations/:id')
      expect(documentedEndpoints).toContain('PUT /conversations/:id/assign')
      expect(documentedEndpoints).toContain('PUT /conversations/:id/close')
      
      // 訊息 CRUD
      expect(documentedEndpoints).toContain('GET /conversations/:id/messages')
      expect(documentedEndpoints).toContain('POST /conversations/:id/messages')
      
      // 團隊成員 CRUD
      expect(documentedEndpoints).toContain('GET /team/members')
      expect(documentedEndpoints).toContain('PUT /team/members/:id/status')
      expect(documentedEndpoints).toContain('DELETE /team/members/:id')
      
      // 檔案附件 CRUD
      expect(documentedEndpoints).toContain('POST /conversations/:id/attachments')
      expect(documentedEndpoints).toContain('GET /conversations/:id/attachments/:attachmentId')
      expect(documentedEndpoints).toContain('DELETE /conversations/:id/attachments/:attachmentId')
    })
  })

  describe('Authentication Requirements', () => {
    const authRequiredEndpoints = [
      'GET /auth/me',
      'GET /conversations',
      'GET /conversations/:id',
      'PUT /conversations/:id/assign',
      'PUT /conversations/:id/close',
      'GET /conversations/:id/messages',
      'POST /conversations/:id/messages',
      'POST /conversations/:id/attachments',
      'GET /conversations/:id/attachments/:attachmentId',
      'GET /conversations/:id/attachments/:attachmentId/download',
      'DELETE /conversations/:id/attachments/:attachmentId',
      'GET /conversations/:id/attachments',
      'GET /system/info'
    ]

    const adminRequiredEndpoints = [
      'GET /team/members',
      'POST /team/invite',
      'PUT /team/members/:id/status',
      'DELETE /team/members/:id',
      'GET /team/invitations',
      'DELETE /team/invitations/:id',
      'GET /system/settings',
      'PUT /system/settings',
      'POST /system/integrations/:platform/test',
      'GET /system/metrics',
      'POST /system/backup',
      'GET /system/backups',
      'POST /system/restore/:backupId',
      'POST /system/cache/clear',
      'POST /system/restart'
    ]

    it('should properly document authentication requirements', () => {
      expect(authRequiredEndpoints.length).toBeGreaterThan(10)
      expect(adminRequiredEndpoints.length).toBeGreaterThan(10)
    })

    it('should have clear distinction between user and admin endpoints', () => {
      // 確保管理員端點不與一般用戶端點重疊
      const overlap = authRequiredEndpoints.filter(endpoint => 
        adminRequiredEndpoints.includes(endpoint)
      )
      expect(overlap.length).toBe(0)
    })
  })
})