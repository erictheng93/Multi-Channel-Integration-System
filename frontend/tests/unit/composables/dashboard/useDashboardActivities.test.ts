/**
 * Unit Tests for useDashboardActivities Composable
 *
 * @module tests/unit/composables/dashboard/useDashboardActivities.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useDashboardActivities } from '@/composables/dashboard/useDashboardActivities'
import { useActivityStream } from '@/composables/useActivityStream'
import type { Activity } from '@/composables/useActivityStream'

// Mock useActivityStream
vi.mock('@/composables/useActivityStream')

describe('useDashboardActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化状态', () => {
    it('应该正确初始化并连接 ActivityStream', () => {
      const mockConnect = vi.fn()
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: mockConnect,
        disconnect: vi.fn()
      })

      const { isConnected } = useDashboardActivities()

      expect(useActivityStream).toHaveBeenCalledWith({
        maxActivities: 50,
        autoConnect: true,
        priorityFilter: []
      })
      expect(isConnected.value).toBe(true)
    })

    it('应该支持自定义配置选项', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(false),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      useDashboardActivities({
        maxActivities: 100,
        autoConnect: false,
        importantTimeRange: 4,
        maxImportantActivities: 10
      })

      expect(useActivityStream).toHaveBeenCalledWith({
        maxActivities: 100,
        autoConnect: false,
        priorityFilter: []
      })
    })
  })

  describe('活动过滤', () => {
    it('应该只返回高优先级和中优先级活动', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      const mockActivities: Activity[] = [
        {
          id: '1',
          type: 'message',
          title: 'High Priority',
          description: 'Test',
          priority: 'high',
          createdAt: oneHourAgo
        },
        {
          id: '2',
          type: 'message',
          title: 'Medium Priority',
          description: 'Test',
          priority: 'medium',
          createdAt: oneHourAgo
        },
        {
          id: '3',
          type: 'message',
          title: 'Low Priority',
          description: 'Test',
          priority: 'low',
          createdAt: oneHourAgo
        }
      ]

      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref(mockActivities),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { importantActivities } = useDashboardActivities()

      expect(importantActivities.value).toHaveLength(2)
      expect(importantActivities.value[0].priority).toBe('high')
      expect(importantActivities.value[1].priority).toBe('medium')
    })

    it('应该过滤掉超出时间范围的活动', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)

      const mockActivities: Activity[] = [
        {
          id: '1',
          type: 'message',
          title: 'Recent',
          description: 'Test',
          priority: 'high',
          createdAt: oneHourAgo
        },
        {
          id: '2',
          type: 'message',
          title: 'Old',
          description: 'Test',
          priority: 'high',
          createdAt: threeHoursAgo
        }
      ]

      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref(mockActivities),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { importantActivities } = useDashboardActivities({
        importantTimeRange: 2 // 2 hours
      })

      expect(importantActivities.value).toHaveLength(1)
      expect(importantActivities.value[0].id).toBe('1')
    })

    it('应该限制返回的活动数量', () => {
      const now = new Date()
      const mockActivities: Activity[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        type: 'message',
        title: `Activity ${i}`,
        description: 'Test',
        priority: 'high',
        createdAt: new Date(now.getTime() - i * 1000)
      }))

      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref(mockActivities),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { importantActivities } = useDashboardActivities({
        maxImportantActivities: 5
      })

      expect(importantActivities.value).toHaveLength(5)
    })
  })

  describe('getActivityIcon', () => {
    it('应该为业务活动返回正确的图标', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { getActivityIcon } = useDashboardActivities()

      expect(getActivityIcon('message')).toBeDefined()
      expect(getActivityIcon('assignment')).toBeDefined()
      expect(getActivityIcon('resolved')).toBeDefined()
      expect(getActivityIcon('urgent')).toBeDefined()
    })

    it('应该为系统活动返回正确的图标', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { getActivityIcon } = useDashboardActivities()

      expect(getActivityIcon('system-error')).toBeDefined()
      expect(getActivityIcon('system-success')).toBeDefined()
      expect(getActivityIcon('system-warning')).toBeDefined()
      expect(getActivityIcon('system-info')).toBeDefined()
    })

    it('应该为用户和设置活动返回正确的图标', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { getActivityIcon } = useDashboardActivities()

      expect(getActivityIcon('user')).toBeDefined()
      expect(getActivityIcon('settings')).toBeDefined()
      expect(getActivityIcon('settings-critical')).toBeDefined()
    })

    it('未知类型应该返回默认图标', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { getActivityIcon } = useDashboardActivities()

      const icon = getActivityIcon('unknown-type')
      expect(icon).toBeDefined()
    })
  })

  describe('formatTime', () => {
    it('应该将刚刚的时间格式化为"剛剛"', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { formatTime } = useDashboardActivities()

      const now = new Date()
      expect(formatTime(now)).toBe('剛剛')
    })

    it('应该将分钟前的时间格式化为"X 分鐘前"', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { formatTime } = useDashboardActivities()

      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)

      expect(formatTime(fiveMinutesAgo)).toBe('5 分鐘前')
      expect(formatTime(thirtyMinutesAgo)).toBe('30 分鐘前')
    })

    it('应该将小时前的时间格式化为"X 小時前"', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { formatTime } = useDashboardActivities()

      const now = new Date()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)

      expect(formatTime(twoHoursAgo)).toBe('2 小時前')
      expect(formatTime(twelveHoursAgo)).toBe('12 小時前')
    })

    it('应该将天前的时间格式化为日期', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { formatTime } = useDashboardActivities()

      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

      const formatted = formatTime(twoDaysAgo)
      expect(formatted).toContain('/')
    })
  })

  describe('边界情况', () => {
    it('应该正确处理空活动列表', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { activities, importantActivities } = useDashboardActivities()

      expect(activities.value).toEqual([])
      expect(importantActivities.value).toEqual([])
    })

    it('应该正确处理连接状态变化', () => {
      const isConnectedRef = ref(false)
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: isConnectedRef,
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { isConnected } = useDashboardActivities()

      expect(isConnected.value).toBe(false)

      isConnectedRef.value = true
      expect(isConnected.value).toBe(true)
    })

    it('应该正确处理未来时间（防御性编程）', () => {
      vi.mocked(useActivityStream).mockReturnValue({
        activities: ref([]),
        isConnected: ref(true),
        connect: vi.fn(),
        disconnect: vi.fn()
      })

      const { formatTime } = useDashboardActivities()

      const futureDate = new Date(Date.now() + 60 * 60 * 1000)
      const formatted = formatTime(futureDate)

      expect(formatted).toBe('剛剛')
    })
  })
})
