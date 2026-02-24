import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mocks are available before module-level imports
const { mockGet, mockPost, mockPut, mockDelete, mockRequest } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockRequest: vi.fn(),
}))

// Mock the base API client
vi.mock('./base', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
    request: mockRequest,
  },
}))

import {
  getTags,
  createTag,
  getTagById,
  updateTag,
  deleteTag,
  getTagConversations,
  getTagUsageStats,
  bulkOperateTags,
  getTagCustomers,
  getCustomerTags,
  addTagsToCustomer,
  removeTagsFromCustomer,
  setCustomerTags,
  type TagConversation,
  type TagCustomer,
} from './tags'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockConversation: TagConversation = {
  id: 'conv-001',
  status: 'active',
  channel: 'line',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-15T12:00:00Z',
  customer_name: 'Alice',
  customer_avatar: null,
  customer_platform: 'line',
  assigned_at: '2026-01-10T09:00:00Z',
  assigned_by: 'agent-001',
}

const mockPagination = { page: 1, limit: 20, total: 1, totalPages: 1 }

// ===========================================================================
// getTagConversations
// ===========================================================================

describe('getTagConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls GET /tags/:id/conversations and returns data', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { conversations: [mockConversation], pagination: mockPagination },
      message: 'Tag conversations retrieved successfully',
    })

    const result = await getTagConversations(42)

    expect(mockGet).toHaveBeenCalledWith('/tags/42/conversations')
    expect(result.success).toBe(true)
    expect(result.data.conversations).toHaveLength(1)
    expect(result.data.conversations[0]).toEqual(mockConversation)
    expect(result.data.pagination).toEqual(mockPagination)
  })

  it('appends page and limit query params when provided', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { conversations: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } },
      message: 'ok',
    })

    await getTagConversations(7, { page: 2, limit: 10 })

    expect(mockGet).toHaveBeenCalledWith('/tags/7/conversations?page=2&limit=10')
  })

  it('omits query string when no params provided', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { conversations: [], pagination: mockPagination },
      message: 'ok',
    })

    await getTagConversations(1)

    expect(mockGet).toHaveBeenCalledWith('/tags/1/conversations')
  })

  it('handles assigned_by being null (nullable field)', async () => {
    const convNullAgent: TagConversation = { ...mockConversation, assigned_by: null }
    mockGet.mockResolvedValue({
      success: true,
      data: { conversations: [convNullAgent], pagination: mockPagination },
      message: 'ok',
    })

    const result = await getTagConversations(1)
    expect(result.data.conversations[0]?.assigned_by).toBeNull()
  })

  it('throws when API returns success: false', async () => {
    mockGet.mockResolvedValue({
      success: false,
      error: 'Not Found',
      data: null,
    })

    await expect(getTagConversations(9999)).rejects.toThrow('Not Found')
  })

  it('throws when API returns success: true but data is null', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: null,
      message: 'ok',
    })

    await expect(getTagConversations(1)).rejects.toThrow('Failed to fetch tag conversations')
  })

  it('propagates network errors thrown by apiClient.get', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))

    await expect(getTagConversations(1)).rejects.toThrow('Network error')
  })

  it('returns empty conversations array when tag has no conversations', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        conversations: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
      message: 'ok',
    })

    const result = await getTagConversations(1)
    expect(result.data.conversations).toEqual([])
    expect(result.data.pagination.total).toBe(0)
  })
})

// ===========================================================================
// Smoke tests for pre-existing tag functions (basic coverage)
// ===========================================================================

describe('getTags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /customers/tags/available', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      message: 'ok',
    })

    await getTags()
    expect(mockGet).toHaveBeenCalledWith('/customers/tags/available')
  })

  it('appends query params when provided', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      message: 'ok',
    })

    await getTags({ search: 'VIP', page: 2 })
    const url = (mockGet.mock.calls[0] as [string])[0]
    expect(url).toContain('/customers/tags/available?')
    expect(url).toContain('search=VIP')
    expect(url).toContain('page=2')
  })

  it('throws when API returns failure', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'Unauthorized', data: null })
    await expect(getTags()).rejects.toThrow('Unauthorized')
  })
})

describe('createTag', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls POST /tags with the provided data', async () => {
    const mockTag = { id: 1, name: 'VIP', color: '#FF0000' }
    mockPost.mockResolvedValue({ success: true, data: mockTag, message: 'created' })

    const result = await createTag({ name: 'VIP', color: '#FF0000' })
    expect(mockPost).toHaveBeenCalledWith('/tags', { name: 'VIP', color: '#FF0000' })
    expect(result.data).toEqual(mockTag)
  })

  it('throws when API returns failure', async () => {
    mockPost.mockResolvedValue({ success: false, error: 'Conflict', data: null })
    await expect(createTag({ name: 'Dup' })).rejects.toThrow('Conflict')
  })
})

describe('getTagById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /tags/:id', async () => {
    const mockTag = { id: 5, name: 'Test' }
    mockGet.mockResolvedValue({ success: true, data: mockTag, message: 'ok' })

    const result = await getTagById(5)
    expect(mockGet).toHaveBeenCalledWith('/tags/5')
    expect(result.data).toEqual(mockTag)
  })
})

describe('updateTag', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls PUT /tags/:id with update data', async () => {
    const mockTag = { id: 3, name: 'Updated', color: '#000' }
    mockPut.mockResolvedValue({ success: true, data: mockTag, message: 'ok' })

    const result = await updateTag(3, { name: 'Updated' })
    expect(mockPut).toHaveBeenCalledWith('/tags/3', { name: 'Updated' })
    expect(result.data).toEqual(mockTag)
  })
})

describe('deleteTag', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls DELETE /tags/:id', async () => {
    mockDelete.mockResolvedValue({ success: true, message: 'deleted' })

    const result = await deleteTag(10)
    expect(mockDelete).toHaveBeenCalledWith('/tags/10')
    expect(result.success).toBe(true)
  })

  it('throws when deletion fails', async () => {
    mockDelete.mockResolvedValue({ success: false, error: 'Not found' })
    await expect(deleteTag(99)).rejects.toThrow('Not found')
  })
})

// ===========================================================================
// getTagUsageStats
// ===========================================================================

describe('getTagUsageStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /tags/:id/stats and returns usage statistics', async () => {
    const mockStats = {
      tagInfo: { id: 1, name: 'VIP', color: '#FF0000' },
      customers: { total: 5, byPlatform: { line: 3, facebook: 2 } },
      conversations: { total: 10, active: 7, closed: 3 },
      usageTrend: [{ date: '2026-01-15', assignments: 3 }],
      topAssigners: [{ name: 'Admin', assignments: 5 }],
    }
    mockGet.mockResolvedValue({ success: true, data: mockStats, message: 'ok' })

    const result = await getTagUsageStats(1)
    expect(mockGet).toHaveBeenCalledWith('/tags/1/stats')
    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockStats)
  })

  it('throws when API returns failure', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'Tag not found', data: null })
    await expect(getTagUsageStats(999)).rejects.toThrow('Tag not found')
  })

  it('throws when data is null', async () => {
    mockGet.mockResolvedValue({ success: true, data: null, message: 'ok' })
    await expect(getTagUsageStats(1)).rejects.toThrow('Failed to fetch tag stats')
  })
})

// ===========================================================================
// bulkOperateTags
// ===========================================================================

describe('bulkOperateTags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls POST /tags/bulk with activate operation', async () => {
    mockPost.mockResolvedValue({ success: true, message: 'ok' })

    const result = await bulkOperateTags({
      operation: 'activate',
      tagIds: [1, 2, 3],
    })
    expect(mockPost).toHaveBeenCalledWith('/tags/bulk', {
      operation: 'activate',
      tagIds: [1, 2, 3],
    })
    expect(result.success).toBe(true)
  })

  it('calls POST /tags/bulk with deactivate operation', async () => {
    mockPost.mockResolvedValue({ success: true, message: 'ok' })

    await bulkOperateTags({ operation: 'deactivate', tagIds: [4, 5] })
    expect(mockPost).toHaveBeenCalledWith('/tags/bulk', {
      operation: 'deactivate',
      tagIds: [4, 5],
    })
  })

  it('calls POST /tags/bulk with update_color operation and data', async () => {
    mockPost.mockResolvedValue({ success: true, message: 'ok' })

    await bulkOperateTags({
      operation: 'update_color',
      tagIds: [1],
      data: { color: '#00FF00' },
    })
    expect(mockPost).toHaveBeenCalledWith('/tags/bulk', {
      operation: 'update_color',
      tagIds: [1],
      data: { color: '#00FF00' },
    })
  })

  it('throws when API returns failure', async () => {
    mockPost.mockResolvedValue({ success: false, error: 'Invalid operation' })
    await expect(
      bulkOperateTags({ operation: 'activate', tagIds: [] })
    ).rejects.toThrow('Invalid operation')
  })
})

// ===========================================================================
// getTagCustomers
// ===========================================================================

const mockCustomer: TagCustomer = {
  id: 1,
  platform: 'line',
  platform_user_id: 'U123',
  display_name: 'Alice',
  avatar_url: null,
  email: 'alice@example.com',
  phone: null,
  created_at: '2026-01-01T00:00:00Z',
  assigned_at: '2026-01-10T00:00:00Z',
  assigned_by: 'agent-001',
  assigned_by_name: null,
}

describe('getTagCustomers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /tags/:id/customers and returns data', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        customers: [mockCustomer],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      },
      message: 'ok',
    })

    const result = await getTagCustomers(42)
    expect(mockGet).toHaveBeenCalledWith('/tags/42/customers')
    expect(result.data.customers).toHaveLength(1)
    expect(result.data.customers[0]).toEqual(mockCustomer)
  })

  it('appends page and limit query params when provided', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        customers: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      },
      message: 'ok',
    })

    await getTagCustomers(5, { page: 2, limit: 10 })
    expect(mockGet).toHaveBeenCalledWith('/tags/5/customers?page=2&limit=10')
  })

  it('omits query string when no params provided', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        customers: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      },
      message: 'ok',
    })

    await getTagCustomers(1)
    expect(mockGet).toHaveBeenCalledWith('/tags/1/customers')
  })

  it('throws when API returns failure', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'Not Found', data: null })
    await expect(getTagCustomers(999)).rejects.toThrow('Not Found')
  })

  it('throws when data is null', async () => {
    mockGet.mockResolvedValue({ success: true, data: null })
    await expect(getTagCustomers(1)).rejects.toThrow('Failed to fetch tag customers')
  })
})

// ===========================================================================
// getCustomerTags
// ===========================================================================

describe('getCustomerTags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /customers/:id/tags and returns tags array', async () => {
    const tags = [{ id: 1, name: 'VIP', color: '#FF0000' }]
    mockGet.mockResolvedValue({ success: true, data: tags })

    const result = await getCustomerTags(100)
    expect(mockGet).toHaveBeenCalledWith('/customers/100/tags')
    expect(result.data).toEqual(tags)
  })

  it('returns empty array when customer has no tags', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] })

    const result = await getCustomerTags(1)
    expect(result.data).toEqual([])
  })

  it('throws when API returns failure', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'Customer not found', data: null })
    await expect(getCustomerTags(999)).rejects.toThrow('Customer not found')
  })
})

// ===========================================================================
// addTagsToCustomer
// ===========================================================================

describe('addTagsToCustomer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls POST /customers/:id/tags with tagIds', async () => {
    mockPost.mockResolvedValue({ success: true, message: 'ok' })

    const result = await addTagsToCustomer(100, [1, 2, 3])
    expect(mockPost).toHaveBeenCalledWith('/customers/100/tags', { tagIds: [1, 2, 3] })
    expect(result.success).toBe(true)
  })

  it('throws when API returns failure', async () => {
    mockPost.mockResolvedValue({ success: false, error: 'Invalid tag IDs' })
    await expect(addTagsToCustomer(1, [999])).rejects.toThrow('Invalid tag IDs')
  })
})

// ===========================================================================
// removeTagsFromCustomer
// ===========================================================================

describe('removeTagsFromCustomer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls DELETE /customers/:id/tags via request method with tagIds', async () => {
    mockRequest.mockResolvedValue({ success: true, message: 'ok' })

    const result = await removeTagsFromCustomer(100, [1, 2])
    expect(mockRequest).toHaveBeenCalledWith('DELETE', '/customers/100/tags', { tagIds: [1, 2] })
    expect(result.success).toBe(true)
  })

  it('throws when API returns failure', async () => {
    mockRequest.mockResolvedValue({ success: false, error: 'Failed to remove' })
    await expect(removeTagsFromCustomer(1, [1])).rejects.toThrow('Failed to remove')
  })
})

// ===========================================================================
// setCustomerTags
// ===========================================================================

describe('setCustomerTags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls PUT /customers/:id/tags with tagIds to replace all', async () => {
    mockPut.mockResolvedValue({ success: true, message: 'ok' })

    const result = await setCustomerTags(100, [5, 6, 7])
    expect(mockPut).toHaveBeenCalledWith('/customers/100/tags', { tagIds: [5, 6, 7] })
    expect(result.success).toBe(true)
  })

  it('allows empty tagIds array to clear all tags', async () => {
    mockPut.mockResolvedValue({ success: true, message: 'ok' })

    const result = await setCustomerTags(100, [])
    expect(mockPut).toHaveBeenCalledWith('/customers/100/tags', { tagIds: [] })
    expect(result.success).toBe(true)
  })

  it('throws when API returns failure', async () => {
    mockPut.mockResolvedValue({ success: false, error: 'Customer not found' })
    await expect(setCustomerTags(999, [1])).rejects.toThrow('Customer not found')
  })
})
