/**
 * Unit Tests for useDashboardData Composable
 *
 * @module tests/unit/composables/dashboard/useDashboardData.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useDashboardData } from '@/composables/dashboard/useDashboardData'
import { useConversations } from '@/composables/useConversations'
import type { Conversation } from '@/types'

// Mock useRouter
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock useConversations
vi.mock('@/composables/useConversations')

describe('useDashboardData', () => {
  const mockConversations: Conversation[] = [
    {
      id: '1',
      platform: 'line',
      platformUserId: 'user1',
      status: 'open',
      lastMessageAt: new Date('2025-01-01T12:00:00'),
      createdAt: new Date('2025-01-01T10:00:00'),
      updatedAt: new Date('2025-01-01T12:00:00')
    },
    {
      id: '2',
      platform: 'line',
      platformUserId: 'user2',
      status: 'assigned',
      assignedTo: 'agent1',
      lastMessageAt: new Date('2025-01-01T11:00:00'),
      createdAt: new Date('2025-01-01T09:00:00'),
      updatedAt: new Date('2025-01-01T11:00:00')
    },
    {
      id: '3',
      platform: 'line',
      platformUserId: 'user3',
      status: 'resolved',
      lastMessageAt: new Date('2025-01-01T10:00:00'),
      createdAt: new Date('2025-01-01T08:00:00'),
      updatedAt: new Date('2025-01-01T10:00:00')
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化状态', () => {
    it('应该正确初始化对话数据', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref(mockConversations.filter(c => c.status === 'open')),
        assignedConversations: ref(mockConversations.filter(c => c.status === 'assigned')),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { openConversations, assignedConversations } = useDashboardData()

      expect(openConversations.value).toHaveLength(1)
      expect(assignedConversations.value).toHaveLength(1)
    })

    it('应该提供当前日期', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref([]),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { currentDate } = useDashboardData()

      expect(currentDate.value).toBeTruthy()
      expect(typeof currentDate.value).toBe('string')
    })
  })

  describe('recentConversations', () => {
    it('应该返回指定数量的最近对话', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { recentConversations } = useDashboardData({
        recentConversationsCount: 2
      })

      expect(recentConversations.value).toHaveLength(2)
    })

    it('默认应该返回5个最近对话', () => {
      const manyConversations = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        platform: 'line' as const,
        platformUserId: `user${i}`,
        status: 'open' as const,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(manyConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { recentConversations } = useDashboardData()

      expect(recentConversations.value).toHaveLength(5)
    })

    it('对话数量少于请求数量时应该返回所有对话', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { recentConversations } = useDashboardData({
        recentConversationsCount: 10
      })

      expect(recentConversations.value).toHaveLength(3)
    })

    it('应该正确处理空对话列表', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(null),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { recentConversations } = useDashboardData()

      expect(recentConversations.value).toEqual([])
    })
  })

  describe('goToConversation', () => {
    it('应该导航到指定对话', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { goToConversation } = useDashboardData()

      goToConversation(mockConversations[0])

      expect(mockPush).toHaveBeenCalledWith('/conversations/1')
    })

    it('应该处理不同的对话 ID', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { goToConversation } = useDashboardData()

      goToConversation(mockConversations[1])
      expect(mockPush).toHaveBeenCalledWith('/conversations/2')

      goToConversation(mockConversations[2])
      expect(mockPush).toHaveBeenCalledWith('/conversations/3')
    })
  })

  describe('refresh', () => {
    it('应该调用 refreshConversations', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: mockRefresh
      })

      const { refresh } = useDashboardData()

      await refresh()

      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('loading 状态', () => {
    it('应该正确反映 loading 状态', () => {
      const loadingRef = ref(true)
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref([]),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: loadingRef,
        refreshConversations: vi.fn()
      })

      const { loading } = useDashboardData()

      expect(loading.value).toBe(true)

      loadingRef.value = false
      expect(loading.value).toBe(false)
    })
  })

  describe('currentDate 格式化', () => {
    it('应该返回中文格式的日期', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref([]),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { currentDate } = useDashboardData()

      // 应该包含年、月、日、星期
      expect(currentDate.value).toMatch(/\d{4}/)
      expect(currentDate.value).toMatch(/月/)
    })
  })

  describe('边界情况', () => {
    it('应该处理 conversations 为 undefined', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(undefined),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { recentConversations } = useDashboardData()

      expect(recentConversations.value).toEqual([])
    })

    it('应该处理 recentConversationsCount 为 0', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { recentConversations } = useDashboardData({
        recentConversationsCount: 0
      })

      expect(recentConversations.value).toEqual([])
    })

    it('应该处理负数的 recentConversationsCount', () => {
      vi.mocked(useConversations).mockReturnValue({
        conversations: ref(mockConversations),
        openConversations: ref([]),
        assignedConversations: ref([]),
        loading: ref(false),
        refreshConversations: vi.fn()
      })

      const { recentConversations } = useDashboardData({
        recentConversationsCount: -1
      })

      // slice 会将负数视为从末尾开始，应该返回空数组或最后一个
      expect(Array.isArray(recentConversations.value)).toBe(true)
    })
  })
})
