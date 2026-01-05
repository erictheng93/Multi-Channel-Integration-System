/**
 * Unit Tests for useNotificationActions
 *
 * Tests notification action handlers (mark as read, delete, etc.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNotificationActions } from '@/composables/notification/useNotificationActions'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useNotificationsStore } from '@/stores/notifications'
import type { Notification } from '@/stores/notifications'

describe('useNotificationActions', () => {
  let router: ReturnType<typeof createRouter>
  let showSuccess: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Setup Pinia
    setActivePinia(createPinia())

    // Setup Router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/conversations/:id', component: { template: '<div>Conversation</div>' } }
      ]
    })

    // Mock showSuccess
    showSuccess = vi.fn()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      expect(actions.markingAllRead.value).toBe(false)
    })

    it('should provide action methods', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      expect(actions.handleMarkRead).toBeInstanceOf(Function)
      expect(actions.handleMarkAllRead).toBeInstanceOf(Function)
      expect(actions.handleDelete).toBeInstanceOf(Function)
      expect(actions.handleLoadMore).toBeInstanceOf(Function)
      expect(actions.handleNotificationClick).toBeInstanceOf(Function)
    })
  })

  describe('handleMarkRead', () => {
    it('should mark notification as read and show success message', async () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      vi.spyOn(store, 'markAsRead').mockResolvedValue(true)

      await actions.handleMarkRead('123')

      expect(store.markAsRead).toHaveBeenCalledWith('123')
      expect(showSuccess).toHaveBeenCalledWith('已標記為已讀')
    })

    it('should not show success message on failure', async () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      vi.spyOn(store, 'markAsRead').mockResolvedValue(false)

      await actions.handleMarkRead('123')

      expect(store.markAsRead).toHaveBeenCalledWith('123')
      expect(showSuccess).not.toHaveBeenCalled()
    })
  })

  describe('handleMarkAllRead', () => {
    it('should mark all notifications as read', async () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      vi.spyOn(store, 'markAllAsRead').mockResolvedValue(true)

      await actions.handleMarkAllRead()

      expect(store.markAllAsRead).toHaveBeenCalled()
      expect(showSuccess).toHaveBeenCalledWith('已將所有通知標記為已讀')
      expect(actions.markingAllRead.value).toBe(false)
    })

    it('should set markingAllRead state during operation', async () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      let promiseResolver: () => void
      const markAllAsReadPromise = new Promise<boolean>((resolve) => {
        promiseResolver = () => resolve(true)
      })

      vi.spyOn(store, 'markAllAsRead').mockReturnValue(markAllAsReadPromise)

      const markAllReadPromise = actions.handleMarkAllRead()

      // Should be true during operation
      expect(actions.markingAllRead.value).toBe(true)

      // Resolve the operation
      promiseResolver!()
      await markAllReadPromise

      // Should be false after operation
      expect(actions.markingAllRead.value).toBe(false)
    })

    it('should reset markingAllRead state even on error', async () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      vi.spyOn(store, 'markAllAsRead').mockRejectedValue(new Error('Network error'))

      await expect(actions.handleMarkAllRead()).rejects.toThrow()

      expect(actions.markingAllRead.value).toBe(false)
    })
  })

  describe('handleDelete', () => {
    it('should delete notification and show success message', async () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      vi.spyOn(store, 'deleteNotification').mockResolvedValue(true)

      await actions.handleDelete('123')

      expect(store.deleteNotification).toHaveBeenCalledWith('123')
      expect(showSuccess).toHaveBeenCalledWith('通知已刪除')
    })

    it('should not show success message on failure', async () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      vi.spyOn(store, 'deleteNotification').mockResolvedValue(false)

      await actions.handleDelete('123')

      expect(store.deleteNotification).toHaveBeenCalledWith('123')
      expect(showSuccess).not.toHaveBeenCalled()
    })
  })

  describe('handleLoadMore', () => {
    it('should call store loadMoreNotifications', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      const loadMoreSpy = vi.spyOn(store, 'loadMoreNotifications')

      actions.handleLoadMore()

      expect(loadMoreSpy).toHaveBeenCalled()
    })
  })

  describe('handleNotificationClick', () => {
    it('should mark unread notification as read', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      const markAsReadSpy = vi.spyOn(store, 'markAsRead')

      const notification: Notification = {
        id: '123',
        type: 'new_message',
        title: 'Test',
        message: 'Test message',
        isRead: false,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        data: { conversationId: '456' }
      }

      actions.handleNotificationClick(notification)

      expect(markAsReadSpy).toHaveBeenCalledWith('123')
    })

    it('should not mark already read notification', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      const markAsReadSpy = vi.spyOn(store, 'markAsRead')

      const notification: Notification = {
        id: '123',
        type: 'new_message',
        title: 'Test',
        message: 'Test message',
        isRead: true,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        data: { conversationId: '456' }
      }

      actions.handleNotificationClick(notification)

      expect(markAsReadSpy).not.toHaveBeenCalled()
    })

    it('should navigate to conversation for message notifications', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      const pushSpy = vi.spyOn(router, 'push')

      const notification: Notification = {
        id: '123',
        type: 'new_message',
        title: 'Test',
        message: 'Test message',
        isRead: false,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        data: { conversationId: '456' }
      }

      actions.handleNotificationClick(notification)

      expect(pushSpy).toHaveBeenCalledWith('/conversations/456')
    })

    it('should navigate for all supported notification types', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      const pushSpy = vi.spyOn(router, 'push')

      const supportedTypes = [
        'new_message',
        'customer_responded',
        'conversation_assigned',
        'conversation_transferred',
        'priority_changed',
        'mention',
        'task_reminder'
      ] as const

      supportedTypes.forEach(type => {
        const notification: Notification = {
          id: `${type}-123`,
          type,
          title: 'Test',
          message: 'Test message',
          isRead: false,
          priority: 'normal',
          createdAt: new Date().toISOString(),
          data: { conversationId: '456' }
        }

        actions.handleNotificationClick(notification)
      })

      expect(pushSpy).toHaveBeenCalledTimes(supportedTypes.length)
    })

    it('should not navigate if no conversationId in data', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      const pushSpy = vi.spyOn(router, 'push')

      const notification: Notification = {
        id: '123',
        type: 'new_message',
        title: 'Test',
        message: 'Test message',
        isRead: false,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        data: {}
      }

      actions.handleNotificationClick(notification)

      expect(pushSpy).not.toHaveBeenCalled()
    })

    it('should not navigate for system notifications', () => {
      const store = useNotificationsStore()
      const actions = useNotificationActions(store, showSuccess, router)

      const pushSpy = vi.spyOn(router, 'push')

      const notification: Notification = {
        id: '123',
        type: 'system',
        title: 'System notification',
        message: 'Test message',
        isRead: false,
        priority: 'normal',
        createdAt: new Date().toISOString(),
        data: {}
      }

      actions.handleNotificationClick(notification)

      expect(pushSpy).not.toHaveBeenCalled()
    })
  })
})
