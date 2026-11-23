import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationsStore } from './notifications'
import type { Notification, NotificationType } from '@/api/notifications'

const make = (id: string, type: NotificationType): Notification => ({
  id,
  userId: 'u1',
  type,
  title: 't',
  content: 'c',
  priority: 'normal',
  isRead: false,
  createdAt: '2026-01-01T00:00:00.000Z'
})

describe('notifications store informational types', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not bump unreadCount for new_conversation or customer_followed', () => {
    const store = useNotificationsStore()
    store.addNotification(make('1', 'new_conversation'))
    store.addNotification(make('2', 'customer_followed'))
    expect(store.unreadCount).toBe(0)
    expect(store.notifications).toHaveLength(2)

    store.addNotification(make('3', 'new_message'))
    expect(store.unreadCount).toBe(1)
  })
})
