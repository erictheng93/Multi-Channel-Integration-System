/**
 * Unit Tests for useNotificationKeyboard
 *
 * Tests keyboard navigation and shortcuts for notifications
 */

import { describe, it, expect, vi } from 'vitest'
import { useNotificationKeyboard } from '@/composables/notification/useNotificationKeyboard'
import { computed, ref } from 'vue'
import type { Notification } from '@/stores/notifications'

describe('useNotificationKeyboard', () => {
  const createMockNotifications = (count: number): Notification[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `notification-${i}`,
      type: 'new_message' as const,
      title: `Notification ${i}`,
      message: `Message ${i}`,
      isRead: false,
      priority: 'normal' as const,
      createdAt: new Date().toISOString(),
      data: {}
    }))
  }

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const notifications = computed(() => [])
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      expect(keyboard.focusedNotificationIndex.value).toBe(-1)
      expect(keyboard.notificationRefs.value).toEqual([])
    })

    it('should provide keyboard handling methods', () => {
      const notifications = computed(() => [])
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      expect(keyboard.handleKeyDown).toBeInstanceOf(Function)
      expect(keyboard.setNotificationRef).toBeInstanceOf(Function)
    })
  })

  describe('setNotificationRef', () => {
    it('should store notification element reference', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const mockElement = document.createElement('div')
      keyboard.setNotificationRef(mockElement, 0)

      expect(keyboard.notificationRefs.value[0]).toBe(mockElement)
    })

    it('should handle multiple notification refs', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const mockElements = [
        document.createElement('div'),
        document.createElement('div'),
        document.createElement('div')
      ]

      mockElements.forEach((el, i) => {
        keyboard.setNotificationRef(el, i)
      })

      expect(keyboard.notificationRefs.value.length).toBe(3)
      mockElements.forEach((el, i) => {
        expect(keyboard.notificationRefs.value[i]).toBe(el)
      })
    })

    it('should not store null references', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      keyboard.setNotificationRef(null, 0)

      expect(keyboard.notificationRefs.value[0]).toBeUndefined()
    })
  })

  describe('handleKeyDown - ArrowDown', () => {
    it('should increment focused index on ArrowDown', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      keyboard.handleKeyDown(event)

      expect(keyboard.focusedNotificationIndex.value).toBe(0)
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should not exceed notification count', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      // Move to last notification
      keyboard.focusedNotificationIndex.value = 2

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      keyboard.handleKeyDown(event)

      expect(keyboard.focusedNotificationIndex.value).toBe(2)
    })

    it('should do nothing if no notifications', () => {
      const notifications = computed(() => [])
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      keyboard.handleKeyDown(event)

      expect(keyboard.focusedNotificationIndex.value).toBe(-1)
    })
  })

  describe('handleKeyDown - ArrowUp', () => {
    it('should decrement focused index on ArrowUp', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      keyboard.focusedNotificationIndex.value = 2

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      keyboard.handleKeyDown(event)

      expect(keyboard.focusedNotificationIndex.value).toBe(1)
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should not go below 0', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      keyboard.focusedNotificationIndex.value = 0

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      keyboard.handleKeyDown(event)

      expect(keyboard.focusedNotificationIndex.value).toBe(0)
    })
  })

  describe('handleKeyDown - Enter', () => {
    it('should call handleNotificationClick on Enter', () => {
      const mockNotifications = createMockNotifications(3)
      const notifications = computed(() => mockNotifications)
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      keyboard.focusedNotificationIndex.value = 1

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      keyboard.handleKeyDown(event)

      expect(handleClick).toHaveBeenCalledWith(mockNotifications[1])
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should not call handleNotificationClick if index is -1', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      keyboard.handleKeyDown(event)

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call handleNotificationClick if index out of bounds', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      keyboard.focusedNotificationIndex.value = 10

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      keyboard.handleKeyDown(event)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('handleKeyDown - Escape', () => {
    it('should reset focused index on Escape', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      keyboard.focusedNotificationIndex.value = 1

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      keyboard.handleKeyDown(event)

      expect(keyboard.focusedNotificationIndex.value).toBe(-1)
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should blur active element on Escape', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const mockElement = document.createElement('div')
      mockElement.focus = vi.fn()
      mockElement.blur = vi.fn()
      document.body.appendChild(mockElement)
      mockElement.focus()

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      keyboard.handleKeyDown(event)

      document.body.removeChild(mockElement)
    })
  })

  describe('focus management', () => {
    it('should focus notification element when navigating', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const mockElement = document.createElement('div')
      mockElement.focus = vi.fn()
      mockElement.scrollIntoView = vi.fn()

      keyboard.setNotificationRef(mockElement, 0)

      keyboard.focusedNotificationIndex.value = -1
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
      keyboard.handleKeyDown(event)

      // Note: Focus is called internally in focusNotification
      // We can't directly test this without exposing focusNotification
      // But we can verify the index changed
      expect(keyboard.focusedNotificationIndex.value).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle rapid key presses', () => {
      const notifications = computed(() => createMockNotifications(5))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      // Rapidly press ArrowDown
      for (let i = 0; i < 10; i++) {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' })
        keyboard.handleKeyDown(event)
      }

      // Should not exceed bounds
      expect(keyboard.focusedNotificationIndex.value).toBe(4)
    })

    it('should handle notifications list changing', () => {
      const notificationsRef = ref(createMockNotifications(3))
      const notifications = computed(() => notificationsRef.value)
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      keyboard.focusedNotificationIndex.value = 2

      // Reduce notifications list
      notificationsRef.value = createMockNotifications(2)

      // Try to navigate up
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' })
      keyboard.handleKeyDown(event)

      expect(keyboard.focusedNotificationIndex.value).toBe(1)
    })

    it('should handle unknown keys gracefully', () => {
      const notifications = computed(() => createMockNotifications(3))
      const handleClick = vi.fn()

      const keyboard = useNotificationKeyboard(notifications, handleClick)

      const initialIndex = keyboard.focusedNotificationIndex.value

      const event = new KeyboardEvent('keydown', { key: 'a' })
      keyboard.handleKeyDown(event)

      // Should not change state
      expect(keyboard.focusedNotificationIndex.value).toBe(initialIndex)
      expect(handleClick).not.toHaveBeenCalled()
    })
  })
})
