/**
 * Unit Tests for useNotificationFilters
 *
 * Tests notification filtering logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNotificationFilters } from '@/composables/notification/useNotificationFilters'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationsStore } from '@/stores/notifications'

describe('useNotificationFilters', () => {
  beforeEach(() => {
    // Setup Pinia
    setActivePinia(createPinia())
  })

  describe('initialization', () => {
    it('should initialize with empty filters', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      expect(filters.selectedType.value).toBe('')
      expect(filters.selectedPriority.value).toBe('')
      expect(filters.selectedReadStatus.value).toBeUndefined()
    })

    it('should provide notification types configuration', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      expect(filters.notificationTypes).toBeDefined()
      expect(Array.isArray(filters.notificationTypes)).toBe(true)
      expect(filters.notificationTypes.length).toBeGreaterThan(0)

      // Verify structure
      filters.notificationTypes.forEach(type => {
        expect(type).toHaveProperty('value')
        expect(type).toHaveProperty('label')
      })
    })

    it('should provide priorities configuration', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      expect(filters.priorities).toBeDefined()
      expect(Array.isArray(filters.priorities)).toBe(true)
      expect(filters.priorities).toEqual([
        { value: 'urgent', label: '緊急' },
        { value: 'high', label: '高' },
        { value: 'normal', label: '一般' },
        { value: 'low', label: '低' }
      ])
    })
  })

  describe('hasActiveFilters', () => {
    it('should return false when no filters are active', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      expect(filters.hasActiveFilters.value).toBe(false)
    })

    it('should return true when type filter is set', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      filters.selectedType.value = 'new_message'

      expect(filters.hasActiveFilters.value).toBe(true)
    })

    it('should return true when priority filter is set', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      filters.selectedPriority.value = 'urgent'

      expect(filters.hasActiveFilters.value).toBe(true)
    })

    it('should return true when read status filter is set', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      filters.selectedReadStatus.value = false

      expect(filters.hasActiveFilters.value).toBe(true)
    })

    it('should return true when multiple filters are set', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      filters.selectedType.value = 'new_message'
      filters.selectedPriority.value = 'urgent'
      filters.selectedReadStatus.value = false

      expect(filters.hasActiveFilters.value).toBe(true)
    })
  })

  describe('applyFilters', () => {
    it('should call store fetchNotifications with empty filters', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const fetchSpy = vi.spyOn(store, 'fetchNotifications')

      filters.applyFilters()

      expect(fetchSpy).toHaveBeenCalledWith({
        type: undefined,
        priority: undefined,
        isRead: undefined
      })
    })

    it('should call store fetchNotifications with type filter', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const fetchSpy = vi.spyOn(store, 'fetchNotifications')

      filters.selectedType.value = 'new_message'
      filters.applyFilters()

      expect(fetchSpy).toHaveBeenCalledWith({
        type: 'new_message',
        priority: undefined,
        isRead: undefined
      })
    })

    it('should call store fetchNotifications with priority filter', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const fetchSpy = vi.spyOn(store, 'fetchNotifications')

      filters.selectedPriority.value = 'urgent'
      filters.applyFilters()

      expect(fetchSpy).toHaveBeenCalledWith({
        type: undefined,
        priority: 'urgent',
        isRead: undefined
      })
    })

    it('should call store fetchNotifications with read status filter', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const fetchSpy = vi.spyOn(store, 'fetchNotifications')

      filters.selectedReadStatus.value = false
      filters.applyFilters()

      expect(fetchSpy).toHaveBeenCalledWith({
        type: undefined,
        priority: undefined,
        isRead: false
      })
    })

    it('should call store fetchNotifications with multiple filters', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const fetchSpy = vi.spyOn(store, 'fetchNotifications')

      filters.selectedType.value = 'new_message'
      filters.selectedPriority.value = 'urgent'
      filters.selectedReadStatus.value = false
      filters.applyFilters()

      expect(fetchSpy).toHaveBeenCalledWith({
        type: 'new_message',
        priority: 'urgent',
        isRead: false
      })
    })

    it('should convert empty string to undefined for type', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const fetchSpy = vi.spyOn(store, 'fetchNotifications')

      filters.selectedType.value = ''
      filters.applyFilters()

      expect(fetchSpy).toHaveBeenCalledWith({
        type: undefined,
        priority: undefined,
        isRead: undefined
      })
    })

    it('should convert empty string to undefined for priority', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const fetchSpy = vi.spyOn(store, 'fetchNotifications')

      filters.selectedPriority.value = ''
      filters.applyFilters()

      expect(fetchSpy).toHaveBeenCalledWith({
        type: undefined,
        priority: undefined,
        isRead: undefined
      })
    })
  })

  describe('clearFilters', () => {
    it('should reset all filter values', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      // Set some filters
      filters.selectedType.value = 'new_message'
      filters.selectedPriority.value = 'urgent'
      filters.selectedReadStatus.value = false

      // Clear filters
      filters.clearFilters()

      expect(filters.selectedType.value).toBe('')
      expect(filters.selectedPriority.value).toBe('')
      expect(filters.selectedReadStatus.value).toBeUndefined()
    })

    it('should call store clearFilters', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const clearSpy = vi.spyOn(store, 'clearFilters')

      filters.clearFilters()

      expect(clearSpy).toHaveBeenCalled()
    })

    it('should update hasActiveFilters to false after clearing', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      // Set some filters
      filters.selectedType.value = 'new_message'
      expect(filters.hasActiveFilters.value).toBe(true)

      // Clear filters
      filters.clearFilters()

      expect(filters.hasActiveFilters.value).toBe(false)
    })
  })

  describe('reactivity', () => {
    it('should update hasActiveFilters when filters change', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      expect(filters.hasActiveFilters.value).toBe(false)

      filters.selectedType.value = 'new_message'
      expect(filters.hasActiveFilters.value).toBe(true)

      filters.selectedType.value = ''
      expect(filters.hasActiveFilters.value).toBe(false)
    })
  })

  describe('notification types configuration', () => {
    it('should include all required notification types', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      const expectedTypes = [
        'new_message',
        'conversation_assigned',
        'conversation_transferred',
        'mention',
        'system',
        'priority_changed',
        'customer_responded',
        'task_reminder'
      ]

      const actualValues = filters.notificationTypes.map(t => t.value)

      expectedTypes.forEach(type => {
        expect(actualValues).toContain(type)
      })
    })

    it('should have labels for all notification types', () => {
      const store = useNotificationsStore()
      const filters = useNotificationFilters(store)

      filters.notificationTypes.forEach(type => {
        expect(type.label).toBeTruthy()
        expect(typeof type.label).toBe('string')
        expect(type.label.length).toBeGreaterThan(0)
      })
    })
  })
})
