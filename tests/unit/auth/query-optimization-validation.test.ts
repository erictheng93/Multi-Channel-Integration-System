// 資料庫查詢優化驗證測試
// 簡化版本 - 專注於驗證查詢次數

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { authenticateUser } from '@backend/utils/auth'

// Mock drizzle ORM
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn()
}))

describe('資料庫查詢優化驗證', () => {
  let mockDb: any
  let mockDrizzleDb: any
  let mockQueryCount: number

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryCount = 0
    
    // 創建一個可以追蹤查詢次數的mock
    mockDrizzleDb = {
      select: vi.fn().mockImplementation(() => {
        mockQueryCount++
        return mockDrizzleDb
      }),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue(null) // 默認返回null (用戶不存在)
    }
    
    vi.mocked(drizzle).mockReturnValue(mockDrizzleDb)
    mockDb = {} // Mock D1Database
  })

  it('應該只執行一次資料庫查詢 - 用戶不存在的情況', async () => {
    // 模擬用戶不存在的情況
    mockDrizzleDb.get.mockResolvedValue(null)

    const result = await authenticateUser(mockDb, 'nonexistent@example.com', 'password')

    // ✅ 關鍵驗證：只執行了一次 select 查詢
    expect(mockQueryCount).toBe(1)
    expect(mockDrizzleDb.select).toHaveBeenCalledTimes(1)
    
    // 驗證查詢包含所有必要欄位
    expect(mockDrizzleDb.select).toHaveBeenCalledWith({
      id: expect.anything(),
      email: expect.anything(),
      password_hash: expect.anything(),
      display_name: expect.anything(),
      role: expect.anything(),
      team_id: expect.anything(),
      team_name: expect.anything(),
      is_active: expect.anything(),
      password_policy: expect.anything(), // ✅ 確保包含密碼策略欄位
      created_at: expect.anything(),
      updated_at: expect.anything()
    })

    // 驗證返回正確的狀態
    expect(result.accountStatus).toBe('not_found')
    expect(result.user).toBeNull()
  })

  it('應該只執行一次資料庫查詢 - 帳戶被禁用的情況', async () => {
    // 模擬被禁用的用戶
    const mockUserData = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: '$2a$12$hashedpassword',
      display_name: 'Test User',
      role: 'agent',
      team_id: 1,
      team_name: 'Test Team',
      is_active: false, // 被禁用
      password_policy: 'changeable',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    mockDrizzleDb.get.mockResolvedValue(mockUserData)

    const result = await authenticateUser(mockDb, 'test@example.com', 'password')

    // ✅ 關鍵驗證：只執行了一次 select 查詢
    expect(mockQueryCount).toBe(1)
    expect(mockDrizzleDb.select).toHaveBeenCalledTimes(1)

    // 驗證返回正確的狀態和密碼策略
    expect(result.accountStatus).toBe('disabled')
    expect(result.user).toBeNull()
    expect(result.passwordPolicy).toBe('changeable')
  })

  it('驗證查詢結構包含所有優化要求的欄位', async () => {
    // 執行任意認證請求
    await authenticateUser(mockDb, 'test@example.com', 'password')

    // ✅ 驗證查詢結構包含所有必要欄位，實現單次查詢優化
    expect(mockDrizzleDb.select).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.anything(),
        email: expect.anything(),
        password_hash: expect.anything(),  // ✅ 密碼驗證所需
        display_name: expect.anything(),
        role: expect.anything(),
        team_id: expect.anything(),
        team_name: expect.anything(),      // ✅ 通過 leftJoin 獲取
        is_active: expect.anything(),      // ✅ 帳戶狀態檢查所需
        password_policy: expect.anything(), // ✅ 密碼策略檢查所需
        created_at: expect.anything(),
        updated_at: expect.anything()
      })
    )

    // ✅ 驗證只調用了一次查詢
    expect(mockQueryCount).toBe(1)
  })

  it('性能驗證：多次調用仍保持單次查詢模式', async () => {
    // 重置計數器
    mockQueryCount = 0
    
    // 模擬用戶不存在的情況來避免密碼驗證的複雜性
    mockDrizzleDb.get.mockResolvedValue(null)

    // 執行多次認證
    const promises = [
      authenticateUser(mockDb, 'user1@example.com', 'password'),
      authenticateUser(mockDb, 'user2@example.com', 'password'),
      authenticateUser(mockDb, 'user3@example.com', 'password')
    ]

    await Promise.all(promises)

    // ✅ 驗證：每次認證都只執行一次查詢，總共3次
    expect(mockQueryCount).toBe(3)
    expect(mockDrizzleDb.select).toHaveBeenCalledTimes(3)

    console.log(`✅ 查詢優化驗證通過：3次認證總共執行 ${mockQueryCount} 次查詢，符合單次查詢優化目標`)
  })
})