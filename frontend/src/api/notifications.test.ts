import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

import { notificationApi } from './notifications'
import { apiClient } from './base'

describe('notificationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds list query parameters', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: { items: [] } })

    await notificationApi.list({
      page: 2,
      pageSize: 25,
      type: 'new_message',
      priority: 'high',
      isRead: false,
      dateFrom: '2026-01-01',
      dateTo: '2026-02-01'
    })

    expect(apiClient.get).toHaveBeenCalledWith(
      '/notifications?page=2&pageSize=25&type=new_message&priority=high&isRead=false&dateFrom=2026-01-01&dateTo=2026-02-01'
    )
  })

  it('validates notification creation request', async () => {
    const result = await notificationApi.create({
      type: 'system',
      title: '',
      content: 'Body'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('標題不能為空')
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('marks all notifications as read with optional type body', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ success: true, data: { updated: 3 } })

    await notificationApi.markAllAsRead('system')

    expect(apiClient.put).toHaveBeenCalledWith('/notifications/mark-all-read', { type: 'system' })
  })

  it('gets unread count with optional type query', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: { count: 1, type: 'system' } })

    await notificationApi.getUnreadCount('system')

    expect(apiClient.get).toHaveBeenCalledWith('/notifications/unread-count?type=system')
  })

  it('updates notification settings', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ success: true })

    await notificationApi.updateSettings({ soundEnabled: false })

    expect(apiClient.put).toHaveBeenCalledWith('/notifications/settings', { soundEnabled: false })
  })
})
