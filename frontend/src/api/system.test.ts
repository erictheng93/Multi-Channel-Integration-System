import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

import { credentialsApi, feedbackApi, systemApi } from './system'
import { apiClient } from './base'

describe('system API clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates system settings', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ success: true })

    await systemApi.updateSettings({ general: { systemName: 'MCIS' } })

    expect(apiClient.put).toHaveBeenCalledWith('/system/settings', {
      general: { systemName: 'MCIS' }
    })
  })

  it('tests platform integrations', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true, data: { status: 'ok' } })

    await systemApi.testIntegration('line', { channelId: 'channel-1' })

    expect(apiClient.post).toHaveBeenCalledWith('/system/integrations/line/test', {
      channelId: 'channel-1'
    })
  })

  it('builds system logs query string', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: { logs: [], total: 0 } })

    await systemApi.getLogs({ level: 'error', startDate: '2026-01-01', limit: 50 })

    expect(apiClient.get).toHaveBeenCalledWith(
      '/system/logs?level=error&startDate=2026-01-01&limit=50'
    )
  })

  it('stores credentials', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true })

    await credentialsApi.storeCredential('facebook', 'pageToken', 'secret')

    expect(apiClient.post).toHaveBeenCalledWith('/credentials', {
      platform: 'facebook',
      type: 'pageToken',
      value: 'secret'
    })
  })

  it('builds feedback list pagination query', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: { feedback: [] } })

    await feedbackApi.getFeedbackList({ page: 2, pageSize: 25 })

    expect(apiClient.get).toHaveBeenCalledWith('/feedback?page=2&pageSize=25')
  })
})
