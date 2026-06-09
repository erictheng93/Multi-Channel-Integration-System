import { describe, expect, it, vi } from 'vitest'
import { callApiContract } from './contract-client'
import { apiClient } from './base'
import {
  activityContracts,
  authContracts,
  channelContracts,
  defineApiContract,
  messageContracts,
  tagContracts,
  teamMembershipContracts
} from '@shared/api-contracts'
import type { CreateChannelResponse, ListChannelsResponse } from '@shared/api-contracts'

vi.mock('./base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    request: vi.fn()
  }
}))

describe('callApiContract', () => {
  it('uses the shared contract path and response type for GET endpoints', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: true,
      data: [{ teamId: 1, roleInTeam: 'member', isPrimary: true }]
    })

    const response = await callApiContract(teamMembershipContracts.getAgentTeams, {
      agentId: 'agent-1'
    })

    expect(apiClient.get).toHaveBeenCalledWith('/teams/agent-teams/agent-1')
    expect(response.data?.[0]?.roleInTeam).toBe('member')
  })

  it('uses the shared contract method, path, and body for POST endpoints', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      data: { teamId: 2, roleInTeam: 'lead', isPrimary: false }
    })

    await callApiContract(
      teamMembershipContracts.joinTeam,
      { agentId: 'agent-1' },
      { teamId: 2, roleInTeam: 'lead' }
    )

    expect(apiClient.post).toHaveBeenCalledWith('/teams/agent-teams/agent-1/join', {
      teamId: 2,
      roleInTeam: 'lead'
    })
  })

  it('uses auth contracts for login request and response shape', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      data: {
        token: 'token-1',
        refreshToken: 'refresh-1',
        agent: {
          id: 'agent-1',
          email: 'agent@example.com',
          name: 'Agent',
          displayName: 'Agent',
          role: 'agent',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      }
    })

    const response = await callApiContract(authContracts.login, {}, {
      email: 'agent@example.com',
      password: 'secret'
    })

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'agent@example.com',
      password: 'secret'
    })
    expect(response.data?.agent.email).toBe('agent@example.com')
  })

  it('preserves non-standard top-level channel list response fields', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: true,
      data: [],
      count: 0
    } as ListChannelsResponse)

    const response = await callApiContract(channelContracts.list, { platform: 'line' })

    expect(apiClient.get).toHaveBeenCalledWith('/channels?platform=line')
    expect(response.count).toBe(0)
  })

  it('preserves non-standard channel creation response fields', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      webhookUrl: 'https://example.com/webhook',
      data: {
        id: 1,
        teamId: 1,
        platform: 'line',
        isActive: true,
        isVerified: false,
        errorCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    } as CreateChannelResponse)

    const response = await callApiContract(channelContracts.create, {}, {
      platform: 'line',
      lineConfig: {
        channelId: 'channel-1',
        channelAccessToken: 'token',
        channelSecret: 'secret'
      }
    })

    expect(apiClient.post).toHaveBeenCalledWith('/channels', {
      platform: 'line',
      lineConfig: {
        channelId: 'channel-1',
        channelAccessToken: 'token',
        channelSecret: 'secret'
      }
    })
    expect(response.webhookUrl).toBe('https://example.com/webhook')
  })

  it('uses activity contracts with sanitized query parameters', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
    })

    await callApiContract(activityContracts.list, {
      page: 1,
      pageSize: 20,
      action: 'LOGIN'
    })

    expect(apiClient.get).toHaveBeenCalledWith('/activities?page=1&pageSize=20&action=LOGIN')
  })

  it('uses message contracts for delayed-message requests', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      data: {
        messageId: 'message-1',
        scheduledSendTime: '2026-01-01T00:00:00.000Z',
        recallDeadline: '2026-01-01T00:01:00.000Z'
      }
    })

    await callApiContract(messageContracts.sendDelayedMessage, {}, {
      conversationId: 'conversation-1',
      content: 'Hello',
      delaySeconds: 60,
      senderId: 'agent-1',
      recipientPlatformId: 'customer-1',
      platform: 'line'
    })

    expect(apiClient.post).toHaveBeenCalledWith('/messages/delayed', {
      conversationId: 'conversation-1',
      content: 'Hello',
      delaySeconds: 60,
      senderId: 'agent-1',
      recipientPlatformId: 'customer-1',
      platform: 'line'
    })
  })

  it('passes request options through to bodyless contracts', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true })

    await callApiContract(authContracts.changePassword, {}, {
      currentPassword: 'old',
      newPassword: 'new'
    }, {
      redirectOnUnauthorized: false
    })

    expect(apiClient.post).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'old',
      newPassword: 'new'
    }, {
      redirectOnUnauthorized: false
    })
  })

  it('uses request transport for DELETE contracts with a body', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ success: true })

    await callApiContract(tagContracts.removeTagsFromCustomer, { customerId: 42 }, { tagIds: [1, 2] })

    expect(apiClient.request).toHaveBeenCalledWith('DELETE', '/customers/42/tags', {
      tagIds: [1, 2]
    })
  })

  it('uses upload transport for FormData contracts', async () => {
    const formData = new globalThis.FormData()
    formData.append('file', new Blob(['data']), 'test.txt')
    vi.mocked(apiClient.uploadFile).mockResolvedValueOnce({
      success: true,
      data: { url: 'https://files.example/test.txt' }
    })

    const uploadContract = defineApiContract<Record<string, never>, globalThis.FormData, { url: string }>({
      method: 'POST',
      transport: 'upload',
      path: () => '/files/upload'
    })

    const response = await callApiContract(uploadContract, {}, formData)

    expect(apiClient.uploadFile).toHaveBeenCalledWith('/files/upload', formData)
    expect(response.data?.url).toBe('https://files.example/test.txt')
  })

  it('uses download transport for file download contracts', async () => {
    const blob = new Blob(['report'])
    const downloadContract = defineApiContract<
      { reportId: string },
      void,
      never,
      { blob: Blob; filename: string; contentType: string }
    >({
      method: 'GET',
      transport: 'download',
      path: ({ reportId }) => `/reports/${reportId}/download`
    })
    vi.mocked(apiClient.downloadFile).mockResolvedValueOnce({
      blob,
      filename: 'report.json',
      contentType: 'application/json'
    })

    const response = await callApiContract(downloadContract, { reportId: 'report-1' })

    expect(apiClient.downloadFile).toHaveBeenCalledWith('/reports/report-1/download')
    expect(response.filename).toBe('report.json')
  })
})
