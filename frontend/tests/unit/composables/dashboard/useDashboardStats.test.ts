/**
 * Unit Tests for useDashboardStats Composable
 *
 * @module tests/unit/composables/dashboard/useDashboardStats.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDashboardStats } from '@/composables/dashboard/useDashboardStats'
import { flushPromises } from '@vue/test-utils'

// Mock the system API
vi.mock('@/api/system', () => ({
  systemApi: {
    getDashboardStats: vi.fn()
  }
}))

describe('useDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化状态', () => {
    it('应该使用默认值初始化', async () => {
      const { systemApi } = await import('@/api/system')

      // Use a delayed promise to ensure we can check loading state
      let resolvePromise: (_value: any) => void
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(systemApi.getDashboardStats).mockReturnValue(delayedPromise as any)

      const { stats, loading } = useDashboardStats()

      // Wait for the microtask to run (useAsyncData uses Promise.resolve().then())
      await flushPromises()

      // Should be loading before promise resolves
      expect(loading.value).toBe(true)
      expect(stats.value).toBeNull()

      // Resolve the promise
      resolvePromise!({
        success: true,
        data: {
          todayMessages: 150,
          onlineAgents: 8,
          responseTime: '5分鐘',
          satisfactionRate: 92,
          resolvedToday: 45
        }
      })

      await flushPromises()

      // Should have loaded data
      expect(loading.value).toBe(false)
      expect(stats.value).not.toBeNull()
    })

    it('immediate: false 时不应该自动加载数据', () => {
      const { stats, loading } = useDashboardStats({ immediate: false })

      expect(loading.value).toBe(false)
      expect(stats.value).toBeNull()
    })
  })

  describe('成功获取统计数据', () => {
    it('应该正确获取并设置统计数据', async () => {
      const mockData = {
        todayMessages: 150,
        onlineAgents: 8,
        responseTime: '5分鐘',
        satisfactionRate: 92,
        resolvedToday: 45
      }

      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: true,
        data: mockData
      })

      const { stats, loading } = useDashboardStats()
      await flushPromises()

      expect(loading.value).toBe(false)
      expect(stats.value).toEqual(mockData)
    })

    it('应该正确处理所有统计字段', async () => {
      const mockData = {
        todayMessages: 250,
        onlineAgents: 12,
        responseTime: '3分鐘',
        satisfactionRate: 95,
        resolvedToday: 78
      }

      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: true,
        data: mockData
      })

      const { stats } = useDashboardStats()
      await flushPromises()

      expect(stats.value?.todayMessages).toBe(250)
      expect(stats.value?.onlineAgents).toBe(12)
      expect(stats.value?.responseTime).toBe('3分鐘')
      expect(stats.value?.satisfactionRate).toBe(95)
      expect(stats.value?.resolvedToday).toBe(78)
    })
  })

  describe('错误处理', () => {
    it('API 失败时应该返回默认值', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: false,
        data: null
      })

      const { stats } = useDashboardStats()
      await flushPromises()

      expect(stats.value).toEqual({
        todayMessages: 0,
        onlineAgents: 0,
        responseTime: '-',
        satisfactionRate: 0,
        resolvedToday: 0
      })
    })

    it('API 抛出异常时应该返回默认值', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockRejectedValue(new Error('Network error'))

      const { stats } = useDashboardStats()
      await flushPromises()

      expect(stats.value).toEqual({
        todayMessages: 0,
        onlineAgents: 0,
        responseTime: '-',
        satisfactionRate: 0,
        resolvedToday: 0
      })
    })

    it('响应数据不完整时应该返回默认值', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: true,
        data: null
      })

      const { stats } = useDashboardStats()
      await flushPromises()

      expect(stats.value).toEqual({
        todayMessages: 0,
        onlineAgents: 0,
        responseTime: '-',
        satisfactionRate: 0,
        resolvedToday: 0
      })
    })
  })

  describe('刷新功能', () => {
    it('应该能够手动刷新统计数据', async () => {
      const { systemApi } = await import('@/api/system')
      const mockFn = vi.mocked(systemApi.getDashboardStats)

      mockFn.mockResolvedValueOnce({
        success: true,
        data: {
          todayMessages: 100,
          onlineAgents: 5,
          responseTime: '10分鐘',
          satisfactionRate: 80,
          resolvedToday: 30
        }
      })

      const { stats, refresh } = useDashboardStats()
      await flushPromises()

      expect(stats.value?.todayMessages).toBe(100)

      // 更新 mock 返回新数据
      mockFn.mockResolvedValueOnce({
        success: true,
        data: {
          todayMessages: 200,
          onlineAgents: 10,
          responseTime: '5分鐘',
          satisfactionRate: 90,
          resolvedToday: 60
        }
      })

      await refresh()
      await flushPromises()

      expect(stats.value?.todayMessages).toBe(200)
      expect(stats.value?.onlineAgents).toBe(10)
    })

    it('刷新时 loading 状态应该正确切换', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: true,
        data: {
          todayMessages: 100,
          onlineAgents: 5,
          responseTime: '10分鐘',
          satisfactionRate: 80,
          resolvedToday: 30
        }
      })

      const { loading, refresh } = useDashboardStats({ immediate: false })

      expect(loading.value).toBe(false)

      const refreshPromise = refresh()
      expect(loading.value).toBe(true)

      await refreshPromise
      expect(loading.value).toBe(false)
    })
  })

  describe('边界情况', () => {
    it('应该正确处理零值统计数据', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: true,
        data: {
          todayMessages: 0,
          onlineAgents: 0,
          responseTime: '0分鐘',
          satisfactionRate: 0,
          resolvedToday: 0
        }
      })

      const { stats } = useDashboardStats()
      await flushPromises()

      expect(stats.value?.todayMessages).toBe(0)
      expect(stats.value?.onlineAgents).toBe(0)
      expect(stats.value?.satisfactionRate).toBe(0)
    })

    it('应该正确处理极大值统计数据', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: true,
        data: {
          todayMessages: 999999,
          onlineAgents: 1000,
          responseTime: '120分鐘',
          satisfactionRate: 100,
          resolvedToday: 50000
        }
      })

      const { stats } = useDashboardStats()
      await flushPromises()

      expect(stats.value?.todayMessages).toBe(999999)
      expect(stats.value?.onlineAgents).toBe(1000)
      expect(stats.value?.satisfactionRate).toBe(100)
    })

    it('应该正确处理响应时间为数字类型', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getDashboardStats).mockResolvedValue({
        success: true,
        data: {
          todayMessages: 100,
          onlineAgents: 5,
          responseTime: 15, // 数字类型
          satisfactionRate: 80,
          resolvedToday: 30
        }
      })

      const { stats } = useDashboardStats()
      await flushPromises()

      expect(stats.value?.responseTime).toBe(15)
    })
  })
})
