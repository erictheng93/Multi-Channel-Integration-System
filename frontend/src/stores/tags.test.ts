import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Tag } from '@/types/tag'

// ---------------------------------------------------------------------------
// Mock getTags API
// ---------------------------------------------------------------------------

const mockGetTags = vi.fn()

vi.mock('@/api/tags', () => ({
  getTags: (...args: unknown[]) => mockGetTags(...args),
}))

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    name: 'VIP',
    color: '#FF5733',
    isActive: true,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    conversationCount: 5,
    customerCount: 3,
    ...overrides,
  }
}

function makeApiResponse(tags: Tag[], paginationOverrides = {}) {
  return {
    data: tags,
    pagination: { page: 1, limit: 50, total: tags.length, totalPages: 1, ...paginationOverrides },
    message: 'ok',
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('useTagsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('initial state', () => {
    it('starts with an empty tags array', async () => {
      const { useTagsStore } = await import('./tags')
      const store = useTagsStore()
      expect(store.tags).toEqual([])
    })

    it('starts with loading = false', async () => {
      const { useTagsStore } = await import('./tags')
      const store = useTagsStore()
      expect(store.loading).toBe(false)
    })

    it('starts with error = null', async () => {
      const { useTagsStore } = await import('./tags')
      const store = useTagsStore()
      expect(store.error).toBeNull()
    })
  })

  // =========================================================================
  // fetchTags — happy path
  // =========================================================================

  describe('fetchTags — success', () => {
    it('populates tags with the API response', async () => {
      const { useTagsStore } = await import('./tags')
      const tags = [makeTag({ id: 1 }), makeTag({ id: 2, name: 'Premium' })]
      mockGetTags.mockResolvedValue(makeApiResponse(tags))

      const store = useTagsStore()
      await store.fetchTags()

      expect(store.tags).toEqual(tags)
    })

    it('returns the full API response', async () => {
      const { useTagsStore } = await import('./tags')
      const response = makeApiResponse([makeTag()])
      mockGetTags.mockResolvedValue(response)

      const store = useTagsStore()
      const result = await store.fetchTags()

      expect(result).toEqual(response)
    })

    it('passes params to getTags', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockResolvedValue(makeApiResponse([]))

      const store = useTagsStore()
      await store.fetchTags({ search: 'VIP', page: 2 })

      expect(mockGetTags).toHaveBeenCalledWith({ search: 'VIP', page: 2 })
    })

    it('calls getTags with no arguments when no params given', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockResolvedValue(makeApiResponse([]))

      const store = useTagsStore()
      await store.fetchTags()

      expect(mockGetTags).toHaveBeenCalledWith(undefined)
    })

    it('clears any previous error before fetching', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockResolvedValue(makeApiResponse([]))

      const store = useTagsStore()
      // Manually inject an existing error
      store.error = 'stale error'

      await store.fetchTags()

      expect(store.error).toBeNull()
    })
  })

  // =========================================================================
  // fetchTags — loading state
  // =========================================================================

  describe('fetchTags — loading state', () => {
    it('sets loading = true while the API call is in flight', async () => {
      const { useTagsStore } = await import('./tags')
      let resolveApi!: (_v: unknown) => void
      mockGetTags.mockReturnValue(new Promise(r => { resolveApi = r }))

      const store = useTagsStore()
      const pending = store.fetchTags()

      expect(store.loading).toBe(true)

      resolveApi(makeApiResponse([]))
      await pending
    })

    it('sets loading = false after the API call succeeds', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockResolvedValue(makeApiResponse([]))

      const store = useTagsStore()
      await store.fetchTags()

      expect(store.loading).toBe(false)
    })

    it('sets loading = false even when the API call fails', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockRejectedValue(new Error('Network error'))

      const store = useTagsStore()
      try { await store.fetchTags() } catch { /* expected */ }

      expect(store.loading).toBe(false)
    })
  })

  // =========================================================================
  // fetchTags — error handling
  // =========================================================================

  describe('fetchTags — error handling', () => {
    it('records the error message when the API throws an Error', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockRejectedValue(new Error('Server unavailable'))

      const store = useTagsStore()
      await expect(store.fetchTags()).rejects.toThrow('Server unavailable')

      expect(store.error).toBe('Server unavailable')
    })

    it('records a generic message when a non-Error is thrown', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockRejectedValue('plain string rejection')

      const store = useTagsStore()
      await expect(store.fetchTags()).rejects.toBe('plain string rejection')

      expect(store.error).toBe('Failed to fetch tags')
    })

    it('re-throws the rejection so callers can handle it', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockRejectedValue(new Error('fail'))

      const store = useTagsStore()
      await expect(store.fetchTags()).rejects.toThrow('fail')
    })
  })

  // =========================================================================
  // $reset
  // =========================================================================

  describe('$reset', () => {
    it('clears tags back to an empty array', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockResolvedValue(makeApiResponse([makeTag()]))

      const store = useTagsStore()
      await store.fetchTags()
      expect(store.tags).toHaveLength(1)

      store.$reset()
      expect(store.tags).toEqual([])
    })

    it('resets loading to false', async () => {
      const { useTagsStore } = await import('./tags')
      const store = useTagsStore()
      store.$reset()
      expect(store.loading).toBe(false)
    })

    it('resets error to null', async () => {
      const { useTagsStore } = await import('./tags')
      mockGetTags.mockRejectedValue(new Error('fail'))

      const store = useTagsStore()
      try { await store.fetchTags() } catch { /* expected */ }
      expect(store.error).not.toBeNull()

      store.$reset()
      expect(store.error).toBeNull()
    })
  })
})
