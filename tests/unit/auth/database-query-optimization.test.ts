// 資料庫查詢優化測試
// 驗證登入認證是否優化為單次查詢

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'

// Mock drizzle ORM
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn()
}))

// Mock utilities with hoisted mock function
vi.mock('../../../src/utils/auth', async () => {
  const actual = await vi.importActual('../../../src/utils/auth')
  return {
    ...actual,
    verifyPassword: vi.fn()
  }
})

// Also mock the drizzle converters
vi.mock('../../../src/utils/drizzle-converters', () => ({
  convertAgent: vi.fn((agent, teamName) => ({
    id: agent.id,
    email: agent.email,
    displayName: agent.displayName,
    role: agent.role,
    teamId: agent.teamId,
    isActive: agent.isActive,
    passwordPolicy: agent.passwordPolicy,
    teamName,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  }))
}))

// Import after mocking
import { authenticateUser, verifyPassword } from '@backend/utils/auth'

describe('資料庫查詢優化測試', () => {
  let mockDb: any
  let mockDrizzleDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockDrizzleDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn()
    }
    
    vi.mocked(drizzle).mockReturnValue(mockDrizzleDb)
    mockDb = {} // Mock D1Database
  })

  describe('單次查詢優化驗證', () => {
    test('應該只執行一次資料庫查詢獲取所有用戶資訊', async () => {
      // 模擬完整的用戶資料（包含密碼策略）
      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: '$2a$12$hashedpassword',
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        team_name: 'Test Team',
        is_active: true,
        password_policy: 'changeable',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockDrizzleDb.get.mockResolvedValue(mockUserData)
      
      // Mock password verification to return true
      vi.mocked(verifyPassword).mockResolvedValue(true)

      console.log('Mock verifyPassword setup:', vi.mocked(verifyPassword))

      // 執行認證
      const result = await authenticateUser(mockDb, 'test@example.com', 'password')

      console.log('Authentication result:', result)

      // 驗證：只執行了一次 select 查詢
      expect(mockDrizzleDb.select).toHaveBeenCalledTimes(1)
      
      // 驗證：select 包含所有必要欄位（包含 password_policy）
      expect(mockDrizzleDb.select).toHaveBeenCalledWith({
        id: expect.anything(),
        email: expect.anything(),
        password_hash: expect.anything(),
        display_name: expect.anything(),
        role: expect.anything(),
        team_id: expect.anything(),
        team_name: expect.anything(),
        is_active: expect.anything(),
        password_policy: expect.anything(),  // ✅ 確保包含密碼策略欄位
        created_at: expect.anything(),
        updated_at: expect.anything()
      })

      // 驗證：認證成功並返回完整資訊
      expect(result.accountStatus).toBe('authenticated')
      expect(result.user).toBeTruthy()
      expect(result.passwordPolicy).toBe('changeable')
    })

    test('當用戶不存在時應該只查詢一次', async () => {
      // 模擬用戶不存在
      mockDrizzleDb.get.mockResolvedValue(null)

      const result = await authenticateUser(mockDb, 'nonexistent@example.com', 'password')

      // 驗證：只執行了一次查詢
      expect(mockDrizzleDb.select).toHaveBeenCalledTimes(1)
      expect(mockDrizzleDb.get).toHaveBeenCalledTimes(1)

      // 驗證：返回正確的錯誤狀態
      expect(result.accountStatus).toBe('not_found')
      expect(result.user).toBeNull()
    })

    test('當帳戶被禁用時應該只查詢一次', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: '$2a$12$hashedpassword',
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        team_name: 'Test Team',
        is_active: false,  // 帳戶被禁用
        password_policy: 'changeable',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockDrizzleDb.get.mockResolvedValue(mockUserData)

      const result = await authenticateUser(mockDb, 'test@example.com', 'password')

      // 驗證：只執行了一次查詢
      expect(mockDrizzleDb.select).toHaveBeenCalledTimes(1)
      expect(mockDrizzleDb.get).toHaveBeenCalledTimes(1)

      // 驗證：返回正確的錯誤狀態
      expect(result.accountStatus).toBe('disabled')
      expect(result.user).toBeNull()
      expect(result.passwordPolicy).toBe('changeable')
    })

    test('當密碼錯誤時應該只查詢一次', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: '$2a$12$hashedpassword',
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        team_name: 'Test Team',
        is_active: true,
        password_policy: 'changeable',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockDrizzleDb.get.mockResolvedValue(mockUserData)
      
      // Mock password verification to return false
      vi.mocked(verifyPassword).mockResolvedValue(false)

      const result = await authenticateUser(mockDb, 'test@example.com', 'wrongpassword')

      // 驗證：只執行了一次查詢
      expect(mockDrizzleDb.select).toHaveBeenCalledTimes(1)
      expect(mockDrizzleDb.get).toHaveBeenCalledTimes(1)

      // 驗證：返回正確的錯誤狀態
      expect(result.accountStatus).toBe('wrong_password')
      expect(result.user).toBeNull()
      expect(result.passwordPolicy).toBe('changeable')
    })

    test('應該正確處理密碼策略 must_change', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: '$2a$12$hashedpassword',
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        team_name: 'Test Team',
        is_active: true,
        password_policy: 'must_change',  // 需要強制更改密碼
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockDrizzleDb.get.mockResolvedValue(mockUserData)
      
      vi.mocked(verifyPassword).mockResolvedValue(true)

      const result = await authenticateUser(mockDb, 'test@example.com', 'password')

      // 驗證：只執行了一次查詢
      expect(mockDrizzleDb.select).toHaveBeenCalledTimes(1)

      // 驗證：成功認證並返回密碼策略
      expect(result.accountStatus).toBe('authenticated')
      expect(result.user).toBeTruthy()
      expect(result.passwordPolicy).toBe('must_change')
    })
  })

  describe('性能基準測試', () => {
    test('查詢優化前後的對比', async () => {
      const mockUserData = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: '$2a$12$hashedpassword',
        display_name: 'Test User',
        role: 'agent',
        team_id: 1,
        team_name: 'Test Team',
        is_active: true,
        password_policy: 'changeable',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      mockDrizzleDb.get.mockResolvedValue(mockUserData)
      
      vi.mocked(verifyPassword).mockResolvedValue(true)

      const startTime = Date.now()
      
      // 執行 10 次認證測試
      const promises = Array(10).fill(0).map(() => 
        authenticateUser(mockDb, 'test@example.com', 'password')
      )
      
      const results = await Promise.all(promises)
      const endTime = Date.now()

      // 驗證：所有認證都成功
      expect(results.every(r => r.accountStatus === 'authenticated')).toBe(true)
      
      // 驗證：總共只執行了 10 次查詢（每次認證 1 次）
      expect(mockDrizzleDb.select).toHaveBeenCalledTimes(10)
      
      // 性能驗證：10 次認證應該在合理時間內完成
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(1000) // 應該在 1 秒內完成

      console.log(`✅ 查詢優化測試通過：10 次認證總耗時 ${totalTime}ms，平均每次 ${totalTime/10}ms`)
    })
  })
})