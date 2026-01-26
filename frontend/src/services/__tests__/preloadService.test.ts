/**
 * PreloadService 單元測試
 * 測試目標: preloadService.ts (Facade over usePreloadStore)
 * 覆蓋率目標: ≥85%
 *
 * 測試重點:
 * 1. 快取管理 (有效、過期、不存在)
 * 2. API 調用與錯誤處理
 * 3. Stale-While-Revalidate 策略
 * 4. 響應式 teamsRef 行為
 * 5. 初始化與清理流程
 * 6. TTL 過期邏輯
 * 7. Pinia Store 整合
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// Mock team API - use vi.hoisted to fix hoisting issue
const { mockGetTeams } = vi.hoisted(() => ({
  mockGetTeams: vi.fn()
}))

vi.mock('@/api/team', () => ({
  teamApi: {
    getTeams: mockGetTeams
  }
}))

// Import after mocking
import { preloadService, type Team } from '../preloadService'
import { usePreloadStore } from '@/stores/preload'

// Test data
const mockTeams: Team[] = [
  {
    id: 1,
    name: 'Team Alpha',
    description: 'First team',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    memberCount: 5
  },
  {
    id: 2,
    name: 'Team Beta',
    description: 'Second team',
    isActive: true,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    memberCount: 3
  },
  {
    id: 3,
    name: 'Team Gamma',
    description: 'Third team',
    isActive: false,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    memberCount: 8
  }
]

describe('PreloadService', () => {
  beforeEach(() => {
    // Setup Pinia for each test
    setActivePinia(createPinia())

    // Reset all mocks
    vi.clearAllMocks()

    // Clear service state before each test
    preloadService.clearAll()

    // Default mock implementation - successful API call
    mockGetTeams.mockResolvedValue({
      success: true,
      data: mockTeams
    })
  })

  afterEach(() => {
    // Clean up after each test
    preloadService.clearAll()
    vi.useRealTimers()
  })

  // =========================================================================
  // 1. 基本 API 測試
  // =========================================================================
  describe('Basic API', () => {
    it('should export preloadService as singleton', () => {
      expect(preloadService).toBeDefined()
      expect(typeof preloadService.getTeams).toBe('function')
      expect(typeof preloadService.ensureTeamsLoaded).toBe('function')
      expect(typeof preloadService.refreshTeams).toBe('function')
      expect(typeof preloadService.warmup).toBe('function')
      expect(typeof preloadService.init).toBe('function')
      expect(typeof preloadService.cleanup).toBe('function')
      expect(typeof preloadService.clearAll).toBe('function')
    })

    it('should have teamsRef as shallowRef', () => {
      expect(preloadService.teamsRef).toBeDefined()
      expect(preloadService.teamsRef.value).toEqual([])
    })
  })

  // =========================================================================
  // 2. getTeams() 測試
  // =========================================================================
  describe('getTeams()', () => {
    describe('Case 1: 快取不存在', () => {
      it('should return empty array when cache does not exist', () => {
        const teams = preloadService.getTeams()

        expect(teams).toEqual([])
      })

      it('should trigger background loading when cache does not exist', async () => {
        preloadService.getTeams()

        // Wait for background loading to complete
        await vi.waitFor(() => {
          expect(mockGetTeams).toHaveBeenCalledTimes(1)
        })
      })

      it('should update teamsRef after background loading completes', async () => {
        // Initial call triggers background loading
        const initialTeams = preloadService.getTeams()
        expect(initialTeams).toEqual([])

        // Wait for API call to complete
        await vi.waitFor(() => {
          expect(preloadService.teamsRef.value).toEqual(mockTeams)
        })
      })
    })

    describe('Case 2: 快取有效', () => {
      it('should return cached data when cache is valid', async () => {
        // First, populate the cache
        await preloadService.ensureTeamsLoaded()

        // Clear mock to verify no new API call
        mockGetTeams.mockClear()

        // Should return cached data
        const teams = preloadService.getTeams()

        expect(teams).toEqual(mockTeams)
        expect(mockGetTeams).not.toHaveBeenCalled()
      })

      it('should return teamsRef.value for Vue reactivity tracking', async () => {
        await preloadService.ensureTeamsLoaded()

        const teams = preloadService.getTeams()

        // Should be the same reference as teamsRef.value
        expect(teams).toBe(preloadService.teamsRef.value)
      })
    })

    describe('Case 3: 快取過期 (Stale-While-Revalidate)', () => {
      it('should return stale data and trigger background refresh', async () => {
        // Populate cache
        await preloadService.ensureTeamsLoaded()

        // Advance time past TTL (30 minutes)
        vi.useFakeTimers()
        vi.advanceTimersByTime(31 * 60 * 1000)

        // Clear mock to track new calls
        mockGetTeams.mockClear()

        // Updated data for refresh
        const updatedTeams = [...mockTeams, {
          id: 4,
          name: 'Team Delta',
          isActive: true,
          createdAt: '2024-01-04T00:00:00Z',
          updatedAt: '2024-01-04T00:00:00Z',
          memberCount: 2
        }]
        mockGetTeams.mockResolvedValue({ success: true, data: updatedTeams })

        // Should return stale data immediately
        const teams = preloadService.getTeams()
        expect(teams).toEqual(mockTeams) // Old data

        // Background refresh should be triggered
        await vi.waitFor(() => {
          expect(mockGetTeams).toHaveBeenCalledTimes(1)
        })
      })
    })
  })

  // =========================================================================
  // 3. ensureTeamsLoaded() 測試
  // =========================================================================
  describe('ensureTeamsLoaded()', () => {
    it('should load teams from API when cache is empty', async () => {
      const teams = await preloadService.ensureTeamsLoaded()

      expect(teams).toEqual(mockTeams)
      expect(mockGetTeams).toHaveBeenCalledTimes(1)
      expect(mockGetTeams).toHaveBeenCalledWith(true) // includeInactive
    })

    it('should return cached data without API call when cache is valid', async () => {
      // First call to populate cache
      await preloadService.ensureTeamsLoaded()

      mockGetTeams.mockClear()

      // Second call should use cache
      const teams = await preloadService.ensureTeamsLoaded()

      expect(teams).toEqual(mockTeams)
      expect(mockGetTeams).not.toHaveBeenCalled()
    })

    it('should update teamsRef after loading', async () => {
      expect(preloadService.teamsRef.value).toEqual([])

      await preloadService.ensureTeamsLoaded()

      expect(preloadService.teamsRef.value).toEqual(mockTeams)
    })

    it('should handle API error gracefully', async () => {
      mockGetTeams.mockResolvedValue({
        success: false,
        error: 'Network error'
      })

      const teams = await preloadService.ensureTeamsLoaded()

      expect(teams).toEqual([])
    })

    it('should handle API exception gracefully', async () => {
      mockGetTeams.mockRejectedValue(new Error('Connection failed'))

      const teams = await preloadService.ensureTeamsLoaded()

      expect(teams).toEqual([])
    })
  })

  // =========================================================================
  // 4. refreshTeams() 測試
  // =========================================================================
  describe('refreshTeams()', () => {
    it('should force refresh even when cache is valid', async () => {
      // Populate cache
      await preloadService.ensureTeamsLoaded()

      mockGetTeams.mockClear()

      // Force refresh
      await preloadService.refreshTeams()

      expect(mockGetTeams).toHaveBeenCalledTimes(1)
    })

    it('should clear existing cache before refresh', async () => {
      // Populate cache
      await preloadService.ensureTeamsLoaded()

      // Update mock to return different data
      const newTeams = [{ ...mockTeams[0], name: 'Updated Team' }]
      mockGetTeams.mockResolvedValue({ success: true, data: newTeams })

      // Refresh
      const teams = await preloadService.refreshTeams()

      expect(teams).toHaveLength(1)
      expect(teams[0]!.name).toBe('Updated Team')
    })

    it('should update teamsRef with fresh data', async () => {
      await preloadService.ensureTeamsLoaded()

      const newTeams = [{ ...mockTeams[0], name: 'Fresh Team' }]
      mockGetTeams.mockResolvedValue({ success: true, data: newTeams })

      await preloadService.refreshTeams()

      expect(preloadService.teamsRef.value).toHaveLength(1)
      expect(preloadService.teamsRef.value[0]!.name).toBe('Fresh Team')
    })
  })

  // =========================================================================
  // 5. init() / warmup() 測試
  // =========================================================================
  describe('init() / warmup()', () => {
    it('should initialize and preload teams', async () => {
      await preloadService.init()

      expect(mockGetTeams).toHaveBeenCalled()
      expect(preloadService.teamsRef.value).toEqual(mockTeams)
    })

    it('should only initialize once (idempotent)', async () => {
      await preloadService.init()
      await preloadService.init()
      await preloadService.init()

      // API should only be called once
      expect(mockGetTeams).toHaveBeenCalledTimes(1)
    })

    it('warmup() should call init()', async () => {
      await preloadService.warmup()

      expect(mockGetTeams).toHaveBeenCalled()
    })

    it('should handle concurrent init calls', async () => {
      // Multiple concurrent calls
      const promises = [
        preloadService.init(),
        preloadService.init(),
        preloadService.init()
      ]

      await Promise.all(promises)

      // Should only call API once
      expect(mockGetTeams).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 6. cleanup() / clearAll() 測試
  // =========================================================================
  describe('cleanup() / clearAll()', () => {
    it('clearAll() should reset all state', async () => {
      // Populate cache
      await preloadService.ensureTeamsLoaded()
      expect(preloadService.teamsRef.value).toEqual(mockTeams)

      // Clear all
      preloadService.clearAll()

      expect(preloadService.teamsRef.value).toEqual([])

      // Verify cache is cleared (API should be called again)
      mockGetTeams.mockClear()
      await preloadService.ensureTeamsLoaded()
      expect(mockGetTeams).toHaveBeenCalled()
    })

    it('cleanup() should remove expired entries', async () => {
      vi.useFakeTimers()

      // Populate cache
      await preloadService.ensureTeamsLoaded()

      // Advance time past TTL
      vi.advanceTimersByTime(31 * 60 * 1000)

      // Run cleanup
      preloadService.cleanup()

      // Cache should be cleared (API will be called on next access)
      mockGetTeams.mockClear()
      preloadService.getTeams()

      await vi.waitFor(() => {
        expect(mockGetTeams).toHaveBeenCalled()
      })
    })

    it('cleanup() should not affect valid cache entries', async () => {
      // Populate cache
      await preloadService.ensureTeamsLoaded()

      mockGetTeams.mockClear()

      // Run cleanup (cache should still be valid)
      preloadService.cleanup()

      // Should still use cache
      const teams = preloadService.getTeams()
      expect(teams).toEqual(mockTeams)
      expect(mockGetTeams).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 7. teamsRef 響應式測試
  // =========================================================================
  describe('teamsRef Reactivity', () => {
    it('should be reactive (Vue can track changes)', async () => {
      // Track reactivity
      let reactiveValue: Team[] = []

      // Simulate Vue computed behavior
      const updateValue = () => {
        reactiveValue = preloadService.teamsRef.value
      }

      // Initial value
      updateValue()
      expect(reactiveValue).toEqual([])

      // Load teams
      await preloadService.ensureTeamsLoaded()

      // Value should be updated
      updateValue()
      expect(reactiveValue).toEqual(mockTeams)
    })

    it('should trigger Vue computed recalculation on update', async () => {
      let computedCallCount = 0

      // Simulate computed getter
      const getComputedTeams = () => {
        computedCallCount++
        return preloadService.getTeams()
      }

      // First access
      getComputedTeams()
      expect(computedCallCount).toBe(1)

      // Load teams
      await preloadService.ensureTeamsLoaded()
      await nextTick()

      // Access again - should return updated data
      const teams = getComputedTeams()
      expect(teams).toEqual(mockTeams)
    })

    it('teamsRef should sync with cache after API call', async () => {
      // Initially empty
      expect(preloadService.teamsRef.value).toEqual([])

      // After loading
      await preloadService.preloadTeams()

      expect(preloadService.teamsRef.value).toEqual(mockTeams)
    })
  })

  // =========================================================================
  // 8. getCacheStats() 測試
  // =========================================================================
  describe('getCacheStats()', () => {
    it('should return empty stats initially', () => {
      const stats = preloadService.getCacheStats()

      expect(stats.size).toBe(0)
      expect(stats.entries).toEqual([])
    })

    it('should return correct stats after loading', async () => {
      await preloadService.ensureTeamsLoaded()

      const stats = preloadService.getCacheStats()

      expect(stats.size).toBe(1)
      expect(stats.entries).toContain('teams')
    })

    it('should return empty stats after clearAll', async () => {
      await preloadService.ensureTeamsLoaded()
      preloadService.clearAll()

      const stats = preloadService.getCacheStats()

      expect(stats.size).toBe(0)
      expect(stats.entries).toEqual([])
    })
  })

  // =========================================================================
  // 9. 邊界條件測試
  // =========================================================================
  describe('Edge Cases', () => {
    it('should handle empty API response', async () => {
      mockGetTeams.mockResolvedValue({
        success: true,
        data: []
      })

      const teams = await preloadService.ensureTeamsLoaded()

      expect(teams).toEqual([])
      expect(preloadService.teamsRef.value).toEqual([])
    })

    it('should handle null/undefined API response gracefully', async () => {
      mockGetTeams.mockResolvedValue({
        success: true,
        data: null
      })

      const teams = await preloadService.ensureTeamsLoaded()

      // Should not crash, return empty array
      expect(teams).toEqual([])
    })

    it('should handle rapid sequential calls', async () => {
      // Rapid calls
      const results = await Promise.all([
        preloadService.ensureTeamsLoaded(),
        preloadService.ensureTeamsLoaded(),
        preloadService.ensureTeamsLoaded()
      ])

      // All should return same data
      results.forEach(result => {
        expect(result).toEqual(mockTeams)
      })
    })
  })

  // =========================================================================
  // 10. Pinia Store 整合測試
  // =========================================================================
  describe('Pinia Store Integration', () => {
    it('should use the same underlying store', async () => {
      const store = usePreloadStore()

      // Load via preloadService
      await preloadService.ensureTeamsLoaded()

      // Store should have the same data
      expect(store.teams).toEqual(mockTeams)
    })

    it('should reflect store changes in preloadService', async () => {
      const store = usePreloadStore()

      // Load via store directly
      await store.ensureTeamsLoaded()

      // preloadService should see the data
      const teams = preloadService.getTeams()
      expect(teams).toEqual(mockTeams)
    })
  })
})
