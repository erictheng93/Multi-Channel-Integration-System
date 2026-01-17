import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useNewMessageNotification } from '@/composables/useNewMessageNotification'

describe('useNewMessageNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with hidden state', () => {
      const notification = useNewMessageNotification()

      expect(notification.isVisible.value).toBe(false)
    })

    it('should accept custom options', () => {
      const mockScroll = vi.fn()
      const mockCount = ref(0)

      const notification = useNewMessageNotification({
        scrollToBottom: mockScroll,
        newMessageCount: mockCount,
        autoHide: false,
        autoHideDelay: 500,
      })

      expect(notification.isVisible.value).toBe(false)
    })
  })

  describe('Show and hide', () => {
    it('should show notification', () => {
      const notification = useNewMessageNotification()

      notification.show()

      expect(notification.isVisible.value).toBe(true)
    })

    it('should hide notification', () => {
      const notification = useNewMessageNotification()

      notification.show()
      expect(notification.isVisible.value).toBe(true)

      notification.hide()
      expect(notification.isVisible.value).toBe(false)
    })

    it('should be idempotent - showing twice should work', () => {
      const notification = useNewMessageNotification()

      notification.show()
      notification.show()

      expect(notification.isVisible.value).toBe(true)
    })

    it('should be idempotent - hiding twice should work', () => {
      const notification = useNewMessageNotification()

      notification.show()
      notification.hide()
      notification.hide()

      expect(notification.isVisible.value).toBe(false)
    })
  })

  describe('Scroll to newest', () => {
    it('should call scrollToBottom when scrollToNewest is invoked', () => {
      const mockScrollToBottom = vi.fn()
      const notification = useNewMessageNotification({
        scrollToBottom: mockScrollToBottom,
      })

      notification.show()
      notification.scrollToNewest()

      expect(mockScrollToBottom).toHaveBeenCalledTimes(1)
    })

    it('should hide notification after delay', () => {
      const notification = useNewMessageNotification({
        autoHideDelay: 300,
      })

      notification.show()
      notification.scrollToNewest()

      expect(notification.isVisible.value).toBe(true) // Still visible

      vi.advanceTimersByTime(300)

      expect(notification.isVisible.value).toBe(false) // Hidden after delay
    })

    it('should hide notification immediately if autoHideDelay is 0', () => {
      const notification = useNewMessageNotification({
        autoHideDelay: 0,
      })

      notification.show()
      notification.scrollToNewest()

      expect(notification.isVisible.value).toBe(false) // Hidden immediately
    })

    it('should work without scrollToBottom callback', () => {
      const notification = useNewMessageNotification()

      notification.show()

      // Should not throw
      expect(() => {
        notification.scrollToNewest()
      }).not.toThrow()
    })
  })

  describe('Dismiss', () => {
    it('should hide notification without scrolling', () => {
      const mockScrollToBottom = vi.fn()
      const notification = useNewMessageNotification({
        scrollToBottom: mockScrollToBottom,
      })

      notification.show()
      notification.dismiss()

      expect(notification.isVisible.value).toBe(false)
      expect(mockScrollToBottom).not.toHaveBeenCalled() // Should NOT scroll
    })

    it('should hide immediately without delay', () => {
      const notification = useNewMessageNotification({
        autoHideDelay: 300,
      })

      notification.show()
      notification.dismiss()

      expect(notification.isVisible.value).toBe(false) // Hidden immediately
      vi.advanceTimersByTime(300)
      expect(notification.isVisible.value).toBe(false) // Still hidden
    })
  })

  describe('Handle scroll', () => {
    it('should auto-hide when scrolled to bottom', () => {
      const notification = useNewMessageNotification({
        autoHide: true,
      })

      notification.show()
      expect(notification.isVisible.value).toBe(true)

      notification.handleScroll(true) // At bottom

      expect(notification.isVisible.value).toBe(false)
    })

    it('should not hide when scrolled to bottom if autoHide is false', () => {
      const notification = useNewMessageNotification({
        autoHide: false,
      })

      notification.show()
      notification.handleScroll(true)

      expect(notification.isVisible.value).toBe(true) // Still visible
    })

    it('should not hide when not at bottom', () => {
      const notification = useNewMessageNotification({
        autoHide: true,
      })

      notification.show()
      notification.handleScroll(false) // Not at bottom

      expect(notification.isVisible.value).toBe(true) // Still visible
    })
  })

  describe('Message count watcher', () => {
    it('should hide notification when message count drops to 0', async () => {
      const messageCount = ref(5)
      const notification = useNewMessageNotification({
        newMessageCount: messageCount,
      })

      notification.show()
      expect(notification.isVisible.value).toBe(true)

      // Reduce count to 0
      messageCount.value = 0

      // Wait for watcher
      await vi.waitFor(() => {
        expect(notification.isVisible.value).toBe(false)
      })
    })

    it('should not hide if count changes but is still > 0', async () => {
      const messageCount = ref(5)
      const notification = useNewMessageNotification({
        newMessageCount: messageCount,
      })

      notification.show()

      messageCount.value = 3 // Still > 0

      // With fake timers, advance time instead of using setTimeout
      await vi.advanceTimersByTimeAsync(50)

      expect(notification.isVisible.value).toBe(true) // Still visible
    })

    it('should not hide if already hidden when count drops to 0', async () => {
      const messageCount = ref(5)
      const notification = useNewMessageNotification({
        newMessageCount: messageCount,
      })

      // Not shown
      expect(notification.isVisible.value).toBe(false)

      messageCount.value = 0

      // With fake timers, advance time instead of using setTimeout
      await vi.advanceTimersByTimeAsync(50)

      expect(notification.isVisible.value).toBe(false) // Still hidden
    })

    it('should work without newMessageCount option', () => {
      const notification = useNewMessageNotification()

      notification.show()

      // Should not throw
      expect(() => {
        notification.hide()
      }).not.toThrow()
    })
  })

  describe('Integration scenarios', () => {
    it('should support full workflow: show -> scroll -> auto-hide', () => {
      const mockScrollToBottom = vi.fn()
      const notification = useNewMessageNotification({
        scrollToBottom: mockScrollToBottom,
        autoHideDelay: 300,
      })

      // 1. New message arrives while scrolled up
      notification.show()
      expect(notification.isVisible.value).toBe(true)

      // 2. User clicks notification
      notification.scrollToNewest()
      expect(mockScrollToBottom).toHaveBeenCalled()
      expect(notification.isVisible.value).toBe(true) // Still visible

      // 3. After delay, notification hides
      vi.advanceTimersByTime(300)
      expect(notification.isVisible.value).toBe(false)
    })

    it('should support manual scroll workflow', () => {
      const notification = useNewMessageNotification({
        autoHide: true,
      })

      // 1. New message arrives
      notification.show()
      expect(notification.isVisible.value).toBe(true)

      // 2. User manually scrolls to bottom
      notification.handleScroll(true)
      expect(notification.isVisible.value).toBe(false) // Auto-hidden
    })

    it('should support dismiss workflow', () => {
      const mockScrollToBottom = vi.fn()
      const notification = useNewMessageNotification({
        scrollToBottom: mockScrollToBottom,
      })

      // 1. New message arrives
      notification.show()
      expect(notification.isVisible.value).toBe(true)

      // 2. User dismisses notification
      notification.dismiss()
      expect(notification.isVisible.value).toBe(false)
      expect(mockScrollToBottom).not.toHaveBeenCalled() // No scroll
    })

    it('should handle multiple new messages', async () => {
      // Start with some messages (simulating multiple unread messages)
      const messageCount = ref(3)
      const notification = useNewMessageNotification({
        newMessageCount: messageCount,
      })

      // Show notification when user scrolls up
      notification.show()
      expect(notification.isVisible.value).toBe(true)

      // More messages arrive while user is scrolled up
      messageCount.value = 5
      expect(notification.isVisible.value).toBe(true) // Still visible

      // User reads all messages (count drops to 0)
      messageCount.value = 0

      // Wait for watcher to process (Vue's async scheduler)
      await vi.waitFor(() => {
        expect(notification.isVisible.value).toBe(false)
      })
    })

    it('should handle rapid show/hide cycles', () => {
      const notification = useNewMessageNotification()

      for (let i = 0; i < 10; i++) {
        notification.show()
        expect(notification.isVisible.value).toBe(true)
        notification.hide()
        expect(notification.isVisible.value).toBe(false)
      }
    })
  })
})
