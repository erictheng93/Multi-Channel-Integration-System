import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mocks are available before module-level imports
const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}))

// Mock the base API client
vi.mock('./base', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  },
}))

import {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  getSchedules,
  saveSchedules,
  getLogs,
} from './autoReply'

// ===========================================================================
// getRules
// ===========================================================================

describe('getRules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /auto-reply/rules with no query string when no params', async () => {
    const mockData = {
      items: [{ id: 1, name: 'Welcome Rule', triggerType: 'welcome' }],
      pagination: { page: 1, limit: 20, total: 1 },
    }
    mockGet.mockResolvedValue({ success: true, data: mockData, message: 'ok' })

    const result = await getRules()

    expect(mockGet).toHaveBeenCalledWith('/auto-reply/rules')
    expect(result.success).toBe(true)
    expect(result.data.items).toHaveLength(1)
    expect(result.data.pagination).toEqual({ page: 1, limit: 20, total: 1 })
  })

  it('appends query params when provided', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { items: [], pagination: { page: 2, limit: 10, total: 0 } },
      message: 'ok',
    })

    await getRules({ teamId: 1, page: 2, pageSize: 10 })

    const url = (mockGet.mock.calls[0] as [string])[0]
    expect(url).toContain('/auto-reply/rules?')
    expect(url).toContain('teamId=1')
    expect(url).toContain('page=2')
    expect(url).toContain('pageSize=10')
  })

  it('throws when API returns success: false', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'Unauthorized', data: null })

    await expect(getRules()).rejects.toThrow('Unauthorized')
  })

  it('propagates network errors thrown by apiClient.get', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))

    await expect(getRules()).rejects.toThrow('Network error')
  })
})

// ===========================================================================
// createRule
// ===========================================================================

describe('createRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls POST /auto-reply/rules with body and returns created rule', async () => {
    const requestData = {
      name: 'Keyword Rule',
      triggerType: 'keyword' as const,
      priority: 10,
      conditions: [{ conditionType: 'contains' as const, value: 'hello' }],
      actions: [{ actionType: 'reply_text' as const, content: '{"text":"Hi!"}' }],
    }
    const mockRule = { id: 1, ...requestData, teamId: 1, isActive: true }
    mockPost.mockResolvedValue({ success: true, data: mockRule, message: 'created' })

    const result = await createRule(requestData)

    expect(mockPost).toHaveBeenCalledWith('/auto-reply/rules', requestData)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockRule)
  })

  it('throws when API returns failure', async () => {
    mockPost.mockResolvedValue({ success: false, error: 'Validation error', data: null })

    await expect(
      createRule({ name: '', triggerType: 'keyword' })
    ).rejects.toThrow('Validation error')
  })
})

// ===========================================================================
// updateRule
// ===========================================================================

describe('updateRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls PUT /auto-reply/rules/:id with body and returns updated rule', async () => {
    const updateData = { name: 'Updated Rule', priority: 5 }
    const mockRule = { id: 1, name: 'Updated Rule', priority: 5, teamId: 1 }
    mockPut.mockResolvedValue({ success: true, data: mockRule, message: 'updated' })

    const result = await updateRule(1, updateData)

    expect(mockPut).toHaveBeenCalledWith('/auto-reply/rules/1', updateData)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockRule)
  })

  it('throws when API returns failure', async () => {
    mockPut.mockResolvedValue({ success: false, error: 'Rule not found', data: null })

    await expect(updateRule(999, { name: 'X' })).rejects.toThrow('Rule not found')
  })
})

// ===========================================================================
// deleteRule
// ===========================================================================

describe('deleteRule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls DELETE /auto-reply/rules/:id and returns success', async () => {
    mockDelete.mockResolvedValue({ success: true, message: 'deleted' })

    const result = await deleteRule(1)

    expect(mockDelete).toHaveBeenCalledWith('/auto-reply/rules/1')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Auto-reply rule deleted successfully')
  })

  it('throws when API returns failure', async () => {
    mockDelete.mockResolvedValue({ success: false, error: 'Rule not found' })

    await expect(deleteRule(999)).rejects.toThrow('Rule not found')
  })
})

// ===========================================================================
// getSchedules
// ===========================================================================

describe('getSchedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /auto-reply/schedules and returns schedule array', async () => {
    const mockSchedules = [
      { id: 1, teamId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '18:00', timezone: 'Asia/Taipei', isActive: true },
    ]
    mockGet.mockResolvedValue({ success: true, data: mockSchedules, message: 'ok' })

    const result = await getSchedules()

    expect(mockGet).toHaveBeenCalledWith('/auto-reply/schedules')
    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockSchedules)
  })

  it('appends teamId query param when provided', async () => {
    mockGet.mockResolvedValue({ success: true, data: [], message: 'ok' })

    await getSchedules({ teamId: 1 })

    expect(mockGet).toHaveBeenCalledWith('/auto-reply/schedules?teamId=1')
  })
})

// ===========================================================================
// saveSchedules
// ===========================================================================

describe('saveSchedules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls POST /auto-reply/schedules with body and returns saved schedules', async () => {
    const requestData = {
      timezone: 'Asia/Taipei',
      schedules: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isActive: true },
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isActive: true },
      ],
    }
    const mockSaved = [
      { id: 1, teamId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '18:00', timezone: 'Asia/Taipei', isActive: true },
      { id: 2, teamId: 1, dayOfWeek: 2, startTime: '09:00', endTime: '18:00', timezone: 'Asia/Taipei', isActive: true },
    ]
    mockPost.mockResolvedValue({ success: true, data: mockSaved, message: 'saved' })

    const result = await saveSchedules(requestData)

    expect(mockPost).toHaveBeenCalledWith('/auto-reply/schedules', requestData)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
  })
})

// ===========================================================================
// getLogs
// ===========================================================================

describe('getLogs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appends filter query params when provided', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 2, limit: 20, total: 0 },
      },
      message: 'ok',
    })

    await getLogs({ ruleId: 1, platform: 'line', page: 2 })

    const url = (mockGet.mock.calls[0] as [string])[0]
    expect(url).toContain('/auto-reply/logs?')
    expect(url).toContain('ruleId=1')
    expect(url).toContain('platform=line')
    expect(url).toContain('page=2')
  })
})
