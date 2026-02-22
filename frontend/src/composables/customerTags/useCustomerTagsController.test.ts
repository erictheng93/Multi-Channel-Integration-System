/**
 * useCustomerTagsController — Unit Tests
 *
 * Focuses on the state managed directly by the controller:
 *   - Conversation modal open/close (the new feature)
 *   - All other modal open/close flows
 *   - Stats computed property
 *   - Lifecycle (initialize / cleanup)
 *
 * Sub-composables (useTagSearch, useTagActions, useTagSelection,
 * useTagKeyboard) are stubbed out so this file only tests controller logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Tag } from '@/types/tag'

// ---------------------------------------------------------------------------
// Captured mock fns — declared before vi.mock() factories
// ---------------------------------------------------------------------------

const mockLoadTags = vi.fn()
const mockKeyboardCleanup = vi.fn()
const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()

// Mutable tags array for store mock — change before each test as needed
let mockStoreTags: Tag[] = []

// ---------------------------------------------------------------------------
// vi.mock() — must be at module scope (hoisted by Vitest)
// ---------------------------------------------------------------------------

vi.mock('@/stores/tags', () => ({
  useTagsStore: vi.fn(() => ({
    get tags() { return mockStoreTags },
    loading: false,
    error: null,
    fetchTags: vi.fn().mockResolvedValue({ data: [] }),
    $reset: vi.fn(),
  })),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}))

vi.mock('./useTagSearch', () => ({
  useTagSearch: vi.fn(() => ({
    searchQuery: { value: '' },
    loadTags: mockLoadTags,
    clearSearch: vi.fn(),
    cleanup: vi.fn(),
  })),
}))

vi.mock('./useTagActions', () => ({
  useTagActions: vi.fn(() => ({
    saveTag: vi.fn(),
    executeDelete: vi.fn(),
    executeBulkDelete: vi.fn(),
  })),
}))

vi.mock('./useTagSelection', () => ({
  useTagSelection: vi.fn(() => ({
    selectedTags: { value: [] as Tag[] },
    hasSelection: { value: false },
    selectionCount: { value: 0 },
    isTagSelected: vi.fn(() => false),
    toggleTagSelection: vi.fn(),
    clearSelection: vi.fn(),
    selectTags: vi.fn(),
    selectAll: vi.fn(),
  })),
}))

vi.mock('./useTagKeyboard', () => ({
  useTagKeyboard: vi.fn(() => ({
    handleKeyboardShortcuts: vi.fn(),
    initialize: vi.fn(),
    cleanup: mockKeyboardCleanup,
  })),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useCustomerTagsController } from './useCustomerTagsController'

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

// ===========================================================================
// Tests
// ===========================================================================

describe('useCustomerTagsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockStoreTags = []
    mockLoadTags.mockResolvedValue(undefined)
  })

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('initial state', () => {
    it('showConversationsModal starts as false', () => {
      const ctrl = useCustomerTagsController()
      expect(ctrl.showConversationsModal.value).toBe(false)
    })

    it('conversationsTag starts as null', () => {
      const ctrl = useCustomerTagsController()
      expect(ctrl.conversationsTag.value).toBeNull()
    })

    it('all modal visibility flags start as false', () => {
      const ctrl = useCustomerTagsController()
      expect(ctrl.showCreateModal.value).toBe(false)
      expect(ctrl.showEditModal.value).toBe(false)
      expect(ctrl.showDeleteModal.value).toBe(false)
      expect(ctrl.showBulkDeleteModal.value).toBe(false)
      expect(ctrl.showStatsModal.value).toBe(false)
      expect(ctrl.showConversationsModal.value).toBe(false)
      expect(ctrl.showBulkMenu.value).toBe(false)
    })

    it('all modal data refs start as null', () => {
      const ctrl = useCustomerTagsController()
      expect(ctrl.editingTag.value).toBeNull()
      expect(ctrl.deletingTag.value).toBeNull()
      expect(ctrl.statsTag.value).toBeNull()
      expect(ctrl.conversationsTag.value).toBeNull()
    })
  })

  // =========================================================================
  // openConversationsModal — new feature
  // =========================================================================

  describe('openConversationsModal', () => {
    it('sets showConversationsModal to true', () => {
      const ctrl = useCustomerTagsController()
      ctrl.openConversationsModal(makeTag())
      expect(ctrl.showConversationsModal.value).toBe(true)
    })

    it('stores the tag in conversationsTag', () => {
      const ctrl = useCustomerTagsController()
      const tag = makeTag({ id: 42, name: 'Enterprise' })
      ctrl.openConversationsModal(tag)
      expect(ctrl.conversationsTag.value).toEqual(tag)
    })

    it('updates conversationsTag when called again with a different tag', () => {
      const ctrl = useCustomerTagsController()
      ctrl.openConversationsModal(makeTag({ id: 1, name: 'First' }))
      ctrl.openConversationsModal(makeTag({ id: 2, name: 'Second' }))
      expect(ctrl.conversationsTag.value?.id).toBe(2)
      expect(ctrl.conversationsTag.value?.name).toBe('Second')
    })

    it('does not affect other modal flags', () => {
      const ctrl = useCustomerTagsController()
      ctrl.openConversationsModal(makeTag())
      expect(ctrl.showCreateModal.value).toBe(false)
      expect(ctrl.showEditModal.value).toBe(false)
      expect(ctrl.showDeleteModal.value).toBe(false)
    })
  })

  // =========================================================================
  // closeModals — resets all modals including conversations modal
  // =========================================================================

  describe('closeModals', () => {
    it('sets showConversationsModal back to false', () => {
      const ctrl = useCustomerTagsController()
      ctrl.openConversationsModal(makeTag())
      ctrl.closeModals()
      expect(ctrl.showConversationsModal.value).toBe(false)
    })

    it('sets conversationsTag back to null', () => {
      const ctrl = useCustomerTagsController()
      ctrl.openConversationsModal(makeTag())
      ctrl.closeModals()
      expect(ctrl.conversationsTag.value).toBeNull()
    })

    it('resets every modal visibility flag', () => {
      const ctrl = useCustomerTagsController()
      ctrl.openConversationsModal(makeTag())
      ctrl.openEditModal(makeTag())
      ctrl.openDeleteModal(makeTag())
      ctrl.openStatsModal(makeTag())

      ctrl.closeModals()

      expect(ctrl.showCreateModal.value).toBe(false)
      expect(ctrl.showEditModal.value).toBe(false)
      expect(ctrl.showDeleteModal.value).toBe(false)
      expect(ctrl.showBulkDeleteModal.value).toBe(false)
      expect(ctrl.showStatsModal.value).toBe(false)
      expect(ctrl.showConversationsModal.value).toBe(false)
      expect(ctrl.showBulkMenu.value).toBe(false)
    })

    it('resets every modal data ref', () => {
      const ctrl = useCustomerTagsController()
      ctrl.openConversationsModal(makeTag())
      ctrl.openEditModal(makeTag())
      ctrl.openDeleteModal(makeTag())
      ctrl.openStatsModal(makeTag())

      ctrl.closeModals()

      expect(ctrl.editingTag.value).toBeNull()
      expect(ctrl.deletingTag.value).toBeNull()
      expect(ctrl.statsTag.value).toBeNull()
      expect(ctrl.conversationsTag.value).toBeNull()
    })

    it('resets formData to defaults', () => {
      const ctrl = useCustomerTagsController()
      ctrl.formData.value.name = 'Modified'
      ctrl.formData.value.color = '#123456'
      ctrl.closeModals()
      expect(ctrl.formData.value.name).toBe('')
      expect(ctrl.formData.value.color).toBe('#3B82F6')
      expect(ctrl.formData.value.description).toBe('')
    })
  })

  // =========================================================================
  // Other modal helpers (smoke tests — not new feature but ensure no regression)
  // =========================================================================

  describe('openEditModal', () => {
    it('sets showEditModal to true and stores the tag', () => {
      const ctrl = useCustomerTagsController()
      const tag = makeTag({ id: 10, name: 'Editable' })
      ctrl.openEditModal(tag)
      expect(ctrl.showEditModal.value).toBe(true)
      expect(ctrl.editingTag.value).toEqual(tag)
    })

    it('pre-fills formData with tag values', () => {
      const ctrl = useCustomerTagsController()
      const tag = makeTag({ name: 'TestTag', color: '#ABCDEF', description: 'A desc' })
      ctrl.openEditModal(tag)
      expect(ctrl.formData.value.name).toBe('TestTag')
      expect(ctrl.formData.value.color).toBe('#ABCDEF')
      expect(ctrl.formData.value.description).toBe('A desc')
    })
  })

  describe('openDeleteModal', () => {
    it('sets showDeleteModal to true and stores the tag', () => {
      const ctrl = useCustomerTagsController()
      const tag = makeTag({ id: 99 })
      ctrl.openDeleteModal(tag)
      expect(ctrl.showDeleteModal.value).toBe(true)
      expect(ctrl.deletingTag.value).toEqual(tag)
    })
  })

  describe('openStatsModal', () => {
    it('sets showStatsModal to true and stores the tag', () => {
      const ctrl = useCustomerTagsController()
      const tag = makeTag({ id: 7 })
      ctrl.openStatsModal(tag)
      expect(ctrl.showStatsModal.value).toBe(true)
      expect(ctrl.statsTag.value).toEqual(tag)
    })
  })

  // =========================================================================
  // openBulkDeleteModal — guards on selection
  // =========================================================================

  describe('openBulkDeleteModal', () => {
    it('does nothing when no tags are selected', () => {
      // mockSelectedTags defaults to empty from useTagSelection mock
      const ctrl = useCustomerTagsController()
      ctrl.openBulkDeleteModal()
      expect(ctrl.showBulkDeleteModal.value).toBe(false)
    })
  })

  // =========================================================================
  // stats computed — totalConversations sums conversationCount across tags
  // =========================================================================

  describe('stats.totalConversations', () => {
    it('is 0 when there are no tags', () => {
      mockStoreTags = []
      const ctrl = useCustomerTagsController()
      expect(ctrl.stats.value.totalConversations).toBe(0)
    })

    it('sums conversationCount across all tags', () => {
      mockStoreTags = [
        makeTag({ conversationCount: 3 }),
        makeTag({ id: 2, conversationCount: 7 }),
        makeTag({ id: 3, conversationCount: 0 }),
      ]
      const ctrl = useCustomerTagsController()
      expect(ctrl.stats.value.totalConversations).toBe(10)
    })

    it('treats undefined conversationCount as 0', () => {
      mockStoreTags = [
        makeTag({ conversationCount: undefined }),
        makeTag({ id: 2, conversationCount: 4 }),
      ]
      const ctrl = useCustomerTagsController()
      expect(ctrl.stats.value.totalConversations).toBe(4)
    })
  })

  describe('stats.totalTags', () => {
    it('reflects the number of tags in the store', () => {
      mockStoreTags = [makeTag(), makeTag({ id: 2 })]
      const ctrl = useCustomerTagsController()
      expect(ctrl.stats.value.totalTags).toBe(2)
    })
  })

  // =========================================================================
  // Lifecycle
  // =========================================================================

  describe('initialize', () => {
    it('calls search.loadTags', async () => {
      const ctrl = useCustomerTagsController()
      await ctrl.initialize()
      expect(mockLoadTags).toHaveBeenCalledOnce()
    })

    it('sets loading to false after successful initialization', async () => {
      const ctrl = useCustomerTagsController()
      await ctrl.initialize()
      expect(ctrl.loading.value).toBe(false)
    })

    it('sets loading to false even when loadTags rejects', async () => {
      mockLoadTags.mockRejectedValueOnce(new Error('load failed'))
      const ctrl = useCustomerTagsController()
      await ctrl.initialize()
      expect(ctrl.loading.value).toBe(false)
    })

    it('calls showError when initialization fails', async () => {
      mockLoadTags.mockRejectedValueOnce(new Error('load failed'))
      const ctrl = useCustomerTagsController()
      await ctrl.initialize()
      expect(mockShowError).toHaveBeenCalledOnce()
    })
  })

  describe('cleanup', () => {
    it('delegates to keyboard.cleanup', () => {
      const ctrl = useCustomerTagsController()
      ctrl.cleanup()
      expect(mockKeyboardCleanup).toHaveBeenCalledOnce()
    })
  })
})
