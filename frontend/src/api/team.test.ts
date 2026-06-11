import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn()
  }
}))

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-06-09T00:00:00.000Z')
}))

import { teamApi } from './team'
import { apiClient } from './base'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)
const mockDelete = vi.mocked(apiClient.delete)

describe('teamApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockDelete.mockReset()
  })

  it('fetches team members through the shared contract path', async () => {
    const members = [{ id: 'agent-1', loginId: 'agent-1', role: 'agent', status: 'active' }]
    mockGet.mockResolvedValue({ success: true, data: members })

    const result = await teamApi.getMembers()

    expect(result.data).toEqual(members)
    expect(mockGet).toHaveBeenCalledWith('/teams/members')
  })

  it('encodes email checks through the contract path', async () => {
    mockGet.mockResolvedValue({ success: true, data: { exists: false } })

    await teamApi.checkEmail('a+b@example.com')

    expect(mockGet).toHaveBeenCalledWith('/teams/members/check-email?email=a%2Bb%40example.com')
  })

  it('maps addMember form data to backend payload', async () => {
    const created = { id: 'agent-1', loginId: 'agent-1', role: 'agent', status: 'active' }
    mockPost.mockResolvedValue({ success: true, data: created })

    const result = await teamApi.addMember({
      loginId: 'agent-1',
      name: 'Agent One',
      email: '',
      password: 'secret',
      role: 'agent',
      group: '42',
      isActive: true
    })

    expect(result.data).toEqual(created)
    expect(mockPost).toHaveBeenCalledWith('/teams/members', {
      email: 'agent-1',
      password: 'secret',
      displayName: 'Agent One',
      role: 'agent',
      isActive: true,
      teamId: 42
    })
  })

  it('includes includeInactive when fetching all teams', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] })

    await teamApi.getTeams(true)

    expect(mockGet).toHaveBeenCalledWith('/teams?includeInactive=true')
  })

  it('generates LIFF QR codes through the team scoped endpoint', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: {
        id: 'qr-1',
        liffUrl: 'https://liff.example',
        qrCodeUrl: 'https://qr.example',
        scanCount: 0,
        isActive: true
      }
    })

    await teamApi.generateLiffQR(7)

    expect(mockPost).toHaveBeenCalledWith('/teams/7/qr-code/liff')
  })

  it('uses the multi-team membership contract for addMemberToTeam', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { teamId: 7, roleInTeam: 'member', isPrimary: false }
    })

    const result = await teamApi.addMemberToTeam(7, 'agent-1')

    expect(mockPost).toHaveBeenCalledWith('/teams/agent-teams/agent-1/join', {
      teamId: 7,
      roleInTeam: 'member',
      isPrimary: false
    })
    expect(result).toMatchObject({
      success: true,
      data: {
        id: 'agent-1',
        loginId: 'agent-1',
        role: 'agent',
        status: 'active',
        teamId: 7
      }
    })
  })

  it('validates batchAddMembersToTeam before calling transport', async () => {
    const result = await teamApi.batchAddMembersToTeam(7, [])

    expect(result).toEqual({ success: false, error: '成員 ID 列表不能為空' })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('posts batchAddMembersToTeam through the contract path', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { added: ['agent-1'], skipped: [], errors: [], addedCount: 1 }
    })

    await teamApi.batchAddMembersToTeam(7, ['agent-1'], 'lead')

    expect(mockPost).toHaveBeenCalledWith('/teams/7/members/batch', {
      agentIds: ['agent-1'],
      roleInTeam: 'lead'
    })
  })

  it('updates member status using the backend boolean payload', async () => {
    mockPut.mockResolvedValue({ success: true })

    await teamApi.updateMemberStatus('agent-1', 'inactive')

    expect(mockPut).toHaveBeenCalledWith('/teams/members/agent-1/status', {
      isActive: false
    })
  })

  it('removes members from a team through the membership contract', async () => {
    mockDelete.mockResolvedValue({ success: true })

    await teamApi.removeMemberFromTeam(7, 'agent-1')

    expect(mockDelete).toHaveBeenCalledWith('/teams/agent-teams/agent-1/leave/7')
  })
})
