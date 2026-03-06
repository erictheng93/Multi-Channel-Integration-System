/**
 * Unit Tests for useConversationVirtualScroll Composable
 *
 * @module tests/unit/composables/conversation/useConversationVirtualScroll.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConversationVirtualScroll } from '@/composables/conversation/useConversationVirtualScroll'

describe('useConversationVirtualScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should initialize visibleRange with startIndex 0 and endIndex 0', () => {
      const { visibleRange } = useConversationVirtualScroll()
      expect(visibleRange.value).toEqual({ startIndex: 0, endIndex: 0 })
    })

    it('should initialize isPreloading as false', () => {
      const { isPreloading } = useConversationVirtualScroll()
      expect(isPreloading.value).toBe(false)
    })

    it('should initialize reachedEnd as false', () => {
      const { reachedEnd } = useConversationVirtualScroll()
      expect(reachedEnd.value).toBe(false)
    })
  })

  describe('scrollConfig defaults', () => {
    it('should have default itemHeight of 120', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.itemHeight).toBe(120)
    })

    it('should have default containerHeight of 600', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.containerHeight).toBe(600)
    })

    it('should have default overscan of 3', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.overscan).toBe(3)
    })

    it('should have default preloadPages of 2', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.preloadPages).toBe(2)
    })

    it('should have enableSmartPreload true by default', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.enableSmartPreload).toBe(true)
    })

    it('should have default predictiveLoadThreshold of 0.8', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.predictiveLoadThreshold).toBe(0.8)
    })

    it('should have default intersectionThreshold of 0.5', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.intersectionThreshold).toBe(0.5)
    })

    it('should have default rootMargin of 200px', () => {
      const { scrollConfig } = useConversationVirtualScroll()
      expect(scrollConfig.rootMargin).toBe('200px')
    })
  })

  describe('custom config', () => {
    it('should merge custom config with defaults', () => {
      const { scrollConfig } = useConversationVirtualScroll({
        itemHeight: 80,
        containerHeight: 400
      })

      expect(scrollConfig.itemHeight).toBe(80)
      expect(scrollConfig.containerHeight).toBe(400)
      // Defaults preserved
      expect(scrollConfig.overscan).toBe(3)
      expect(scrollConfig.enableSmartPreload).toBe(true)
    })

    it('should allow overriding all config values', () => {
      const custom = {
        itemHeight: 60,
        containerHeight: 800,
        overscan: 5,
        preloadPages: 3,
        enableSmartPreload: false,
        predictiveLoadThreshold: 0.5,
        intersectionThreshold: 0.8,
        rootMargin: '100px'
      }

      const { scrollConfig } = useConversationVirtualScroll(custom)

      expect(scrollConfig).toEqual(custom)
    })
  })

  describe('handleVisibleRangeChange', () => {
    it('should update visibleRange', async () => {
      const { handleVisibleRangeChange, visibleRange } = useConversationVirtualScroll()

      await handleVisibleRangeChange(5, 15)

      expect(visibleRange.value).toEqual({ startIndex: 5, endIndex: 15 })
    })

    it('should accept onPreload callback without error', async () => {
      const { handleVisibleRangeChange } = useConversationVirtualScroll()
      const onPreload = vi.fn().mockResolvedValue(undefined)

      await handleVisibleRangeChange(0, 10, onPreload)

      // onPreload is not called directly by handleVisibleRangeChange
      // (handled by handlePredictiveLoad instead)
      expect(onPreload).not.toHaveBeenCalled()
    })

    it('should update range even without onPreload', async () => {
      const { handleVisibleRangeChange, visibleRange } = useConversationVirtualScroll()

      await handleVisibleRangeChange(10, 30)

      expect(visibleRange.value).toEqual({ startIndex: 10, endIndex: 30 })
    })
  })

  describe('handleReachBottom', () => {
    it('should call onLoadMore when provided', async () => {
      const { handleReachBottom } = useConversationVirtualScroll()
      const onLoadMore = vi.fn().mockResolvedValue(undefined)

      await handleReachBottom(onLoadMore)

      expect(onLoadMore).toHaveBeenCalled()
    })

    it('should do nothing when onLoadMore is not provided', async () => {
      const { handleReachBottom, isPreloading } = useConversationVirtualScroll()

      await handleReachBottom()

      expect(isPreloading.value).toBe(false)
    })

    it('should set isPreloading during load', async () => {
      let resolveLoad: () => void
      const onLoadMore = vi.fn(() => new Promise<void>((r) => { resolveLoad = r }))

      const { handleReachBottom, isPreloading } = useConversationVirtualScroll()

      const promise = handleReachBottom(onLoadMore)
      expect(isPreloading.value).toBe(true)

      resolveLoad!()
      await promise

      expect(isPreloading.value).toBe(false)
    })

    it('should not call onLoadMore when already preloading', async () => {
      const { handleReachBottom, isPreloading } = useConversationVirtualScroll()
      isPreloading.value = true

      const onLoadMore = vi.fn().mockResolvedValue(undefined)
      await handleReachBottom(onLoadMore)

      expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('should not call onLoadMore when reachedEnd is true', async () => {
      const { handleReachBottom, reachedEnd } = useConversationVirtualScroll()
      reachedEnd.value = true

      const onLoadMore = vi.fn().mockResolvedValue(undefined)
      await handleReachBottom(onLoadMore)

      expect(onLoadMore).not.toHaveBeenCalled()
    })

    it('should reset isPreloading on error', async () => {
      const onLoadMore = vi.fn().mockRejectedValue(new Error('load failed'))
      const { handleReachBottom, isPreloading } = useConversationVirtualScroll()

      await expect(handleReachBottom(onLoadMore)).rejects.toThrow('load failed')

      expect(isPreloading.value).toBe(false)
    })
  })

  describe('handlePredictiveLoad', () => {
    it('should trigger preload when scrolling down with small distance', async () => {
      const { handlePredictiveLoad, isPreloading: _isPreloading } = useConversationVirtualScroll()
      const onPreload = vi.fn().mockResolvedValue(undefined)

      handlePredictiveLoad('down', 5, onPreload)

      // Wait for the promise chain
      await vi.waitFor(() => {
        expect(onPreload).toHaveBeenCalled()
      })
    })

    it('should not trigger preload when scrolling up', () => {
      const { handlePredictiveLoad } = useConversationVirtualScroll()
      const onPreload = vi.fn().mockResolvedValue(undefined)

      handlePredictiveLoad('up', 5, onPreload)

      expect(onPreload).not.toHaveBeenCalled()
    })

    it('should not trigger preload when distance is 10 or more', () => {
      const { handlePredictiveLoad } = useConversationVirtualScroll()
      const onPreload = vi.fn().mockResolvedValue(undefined)

      handlePredictiveLoad('down', 10, onPreload)

      expect(onPreload).not.toHaveBeenCalled()
    })

    it('should not trigger preload when smart preload is disabled', () => {
      const { handlePredictiveLoad } = useConversationVirtualScroll({
        enableSmartPreload: false
      })
      const onPreload = vi.fn().mockResolvedValue(undefined)

      handlePredictiveLoad('down', 5, onPreload)

      expect(onPreload).not.toHaveBeenCalled()
    })

    it('should not trigger preload when already preloading', () => {
      const { handlePredictiveLoad, isPreloading } = useConversationVirtualScroll()
      isPreloading.value = true

      const onPreload = vi.fn().mockResolvedValue(undefined)
      handlePredictiveLoad('down', 5, onPreload)

      expect(onPreload).not.toHaveBeenCalled()
    })

    it('should not trigger preload when reachedEnd is true', () => {
      const { handlePredictiveLoad, reachedEnd } = useConversationVirtualScroll()
      reachedEnd.value = true

      const onPreload = vi.fn().mockResolvedValue(undefined)
      handlePredictiveLoad('down', 5, onPreload)

      expect(onPreload).not.toHaveBeenCalled()
    })

    it('should not trigger preload when no callback provided', () => {
      const { handlePredictiveLoad, isPreloading } = useConversationVirtualScroll()

      handlePredictiveLoad('down', 5)

      expect(isPreloading.value).toBe(false)
    })

    it('should reset isPreloading after successful preload', async () => {
      const { handlePredictiveLoad, isPreloading } = useConversationVirtualScroll()
      const onPreload = vi.fn().mockResolvedValue(undefined)

      handlePredictiveLoad('down', 5, onPreload)

      await vi.waitFor(() => {
        expect(isPreloading.value).toBe(false)
      })
    })

    it('should reset isPreloading after failed preload', async () => {
      const { handlePredictiveLoad, isPreloading } = useConversationVirtualScroll()
      const onPreload = vi.fn().mockRejectedValue(new Error('preload failed'))

      handlePredictiveLoad('down', 5, onPreload)

      await vi.waitFor(() => {
        expect(isPreloading.value).toBe(false)
      })
    })
  })

  describe('resetScroll', () => {
    it('should reset visibleRange to initial values', () => {
      const { resetScroll, visibleRange } = useConversationVirtualScroll()
      visibleRange.value = { startIndex: 10, endIndex: 30 }

      resetScroll()

      expect(visibleRange.value).toEqual({ startIndex: 0, endIndex: 0 })
    })

    it('should reset isPreloading to false', () => {
      const { resetScroll, isPreloading } = useConversationVirtualScroll()
      isPreloading.value = true

      resetScroll()

      expect(isPreloading.value).toBe(false)
    })

    it('should reset reachedEnd to false', () => {
      const { resetScroll, reachedEnd } = useConversationVirtualScroll()
      reachedEnd.value = true

      resetScroll()

      expect(reachedEnd.value).toBe(false)
    })
  })

  describe('setReachedEnd', () => {
    it('should set reachedEnd to true', () => {
      const { setReachedEnd, reachedEnd } = useConversationVirtualScroll()

      setReachedEnd(true)

      expect(reachedEnd.value).toBe(true)
    })

    it('should set reachedEnd to false', () => {
      const { setReachedEnd, reachedEnd } = useConversationVirtualScroll()
      reachedEnd.value = true

      setReachedEnd(false)

      expect(reachedEnd.value).toBe(false)
    })
  })

  describe('return interface', () => {
    it('should return all expected properties and methods', () => {
      const result = useConversationVirtualScroll()

      expect(result).toHaveProperty('visibleRange')
      expect(result).toHaveProperty('scrollConfig')
      expect(result).toHaveProperty('isPreloading')
      expect(result).toHaveProperty('reachedEnd')
      expect(result).toHaveProperty('handleVisibleRangeChange')
      expect(result).toHaveProperty('handleReachBottom')
      expect(result).toHaveProperty('handlePredictiveLoad')
      expect(result).toHaveProperty('resetScroll')
      expect(result).toHaveProperty('setReachedEnd')
    })
  })
})
