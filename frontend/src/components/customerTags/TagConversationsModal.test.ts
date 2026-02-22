import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TagConversationsModal from './TagConversationsModal.vue'
import type { Tag } from '@/types/tag'
import type { TagConversation } from '@/api/tags'

// ---------------------------------------------------------------------------
// Mock getTagConversations
// ---------------------------------------------------------------------------
const mockGetTagConversations = vi.fn()

vi.mock('@/api/tags', () => ({
  getTagConversations: (...args: unknown[]) => mockGetTagConversations(...args),
}))

// ---------------------------------------------------------------------------
// Mock icon and UI components
// ---------------------------------------------------------------------------
vi.mock('@/components/icons', () => ({
  XIcon: { template: '<span class="icon-x" />' },
  MessageCircleIcon: { template: '<span class="icon-message" />' },
  ExternalLinkIcon: { template: '<span class="icon-external-link" />' },
}))

vi.mock('@/components/ui', () => ({
  LoadingSpinner: { template: '<div class="loading-spinner" />' },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockTag: Tag = {
  id: 1,
  name: 'VIP',
  color: '#FF5733',
  isActive: true,
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
  conversationCount: 2,
}

function makeConversation(overrides: Partial<TagConversation> = {}): TagConversation {
  return {
    id: 'conv-001',
    status: 'active',
    channel: 'line',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    customer_name: 'Alice',
    customer_avatar: null,
    customer_platform: 'line',
    assigned_at: '2026-01-10T09:00:00Z',
    assigned_by: 'agent-001',
    ...overrides,
  }
}

function makePagination(overrides = {}) {
  return { page: 1, limit: 20, total: 0, totalPages: 0, ...overrides }
}

function makeApiResponse(conversations: TagConversation[], pagination = {}) {
  return {
    success: true,
    data: {
      conversations,
      pagination: makePagination(pagination),
    },
    message: 'ok',
  }
}

/**
 * Mount the modal with Teleport stubbed so content renders inside the wrapper.
 * This is the standard approach for testing <Teleport> components in Vue Test Utils.
 *
 * NOTE: The component uses a lazy watch (not `{ immediate: true }`), so the data
 * loading watch only fires on prop CHANGES. Tests that need data must open the
 * modal by transitioning visible: false → true (via `openModal` helper below).
 */
function mountModal(props: { visible: boolean; tag: Tag | null }) {
  return mount(TagConversationsModal, {
    props,
    global: {
      stubs: {
        // Stub Teleport to render inline — allows wrapper.find() to work
        Teleport: true,
        RouterLink: { template: '<a class="view-link"><slot /></a>', props: ['to'] },
      },
    },
  })
}

/**
 * Mount closed, then open — triggers the lazy watch that loads conversations.
 * Call `await flushPromises()` after this to let API calls settle.
 */
async function openModal(tag: Tag = mockTag) {
  const wrapper = mountModal({ visible: false, tag })
  await wrapper.setProps({ visible: true })
  return wrapper
}

// ===========================================================================
// Tests
// ===========================================================================

describe('TagConversationsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  // =========================================================================
  // Visibility
  // =========================================================================

  describe('visibility', () => {
    it('renders nothing (no overlay) when visible is false', () => {
      const wrapper = mountModal({ visible: false, tag: mockTag })
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('renders the modal overlay when visible is true', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })
  })

  // =========================================================================
  // Loading state
  // =========================================================================

  describe('loading state', () => {
    it('shows loading spinner while API call is in progress', async () => {
      // Resolve on demand so we can check mid-flight
      let resolve!: (_v: unknown) => void
      mockGetTagConversations.mockReturnValue(new Promise(r => { resolve = r }))
      const wrapper = await openModal()
      // At this point loadPage has been called (watch fired) but hasn't resolved
      // loading.value should be true
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
      resolve(makeApiResponse([]))
    })

    it('hides loading spinner after API call completes', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.loading-spinner').exists()).toBe(false)
    })
  })

  // =========================================================================
  // Empty state
  // =========================================================================

  describe('empty state', () => {
    it('shows empty message when there are no conversations', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.text()).toContain('此標籤尚未被應用到任何對話')
    })

    it('does not show empty message when conversations exist', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([makeConversation()]))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.text()).not.toContain('此標籤尚未被應用到任何對話')
    })
  })

  // =========================================================================
  // Conversation list
  // =========================================================================

  describe('conversation list', () => {
    it('renders a list item for each conversation', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([
        makeConversation({ id: 'c1', customer_name: 'Alice' }),
        makeConversation({ id: 'c2', customer_name: 'Bob', status: 'closed' }),
      ]))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.findAll('.conversation-item')).toHaveLength(2)
    })

    it('renders customer name for each conversation', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([
        makeConversation({ customer_name: 'Charlie' }),
      ]))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.customer-name').text()).toBe('Charlie')
    })

    it('renders active status badge with 進行中 label', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([
        makeConversation({ status: 'active' }),
      ]))
      const wrapper = await openModal()
      await flushPromises()
      const badge = wrapper.find('.status-badge')
      expect(badge.text()).toBe('進行中')
      expect(badge.classes()).toContain('status-active')
    })

    it('renders closed status badge with 已關閉 label', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([
        makeConversation({ status: 'closed' }),
      ]))
      const wrapper = await openModal()
      await flushPromises()
      const badge = wrapper.find('.status-badge')
      expect(badge.text()).toBe('已關閉')
      expect(badge.classes()).toContain('status-closed')
    })

    it('shows LINE platform label', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([
        makeConversation({ customer_platform: 'line' }),
      ]))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.platform-badge').text()).toBe('LINE')
    })

    it('shows avatar fallback initial when customer_avatar is null', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([
        makeConversation({ customer_name: 'Diana', customer_avatar: null }),
      ]))
      const wrapper = await openModal()
      await flushPromises()
      const fallback = wrapper.find('.avatar-fallback')
      expect(fallback.exists()).toBe(true)
      expect(fallback.text()).toBe('D')
    })

    it('shows avatar img when customer_avatar is provided', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([
        makeConversation({ customer_avatar: 'https://example.com/avatar.png' }),
      ]))
      const wrapper = await openModal()
      await flushPromises()
      const img = wrapper.find('.avatar-img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://example.com/avatar.png')
    })
  })

  // =========================================================================
  // Pagination
  // =========================================================================

  describe('pagination', () => {
    it('does not show pagination when totalPages <= 1', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse(
        [makeConversation()],
        { total: 5, totalPages: 1 }
      ))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.pagination').exists()).toBe(false)
    })

    it('shows pagination controls when totalPages > 1', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse(
        [makeConversation()],
        { page: 1, total: 50, totalPages: 3 }
      ))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.pagination').exists()).toBe(true)
    })

    it('disables previous button on first page', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse(
        [makeConversation()],
        { page: 1, total: 50, totalPages: 3 }
      ))
      const wrapper = await openModal()
      await flushPromises()
      const btns = wrapper.findAll('.pagination-btn')
      expect((btns[0]!.element as HTMLButtonElement).disabled).toBe(true)
    })

    it('disables next button on last page', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse(
        [makeConversation()],
        { page: 3, total: 50, totalPages: 3 }
      ))
      const wrapper = await openModal()
      await flushPromises()
      const btns2 = wrapper.findAll('.pagination-btn')
      expect((btns2[1]!.element as HTMLButtonElement).disabled).toBe(true)
    })

    it('calls getTagConversations with page 2 when next button clicked', async () => {
      mockGetTagConversations.mockResolvedValueOnce(makeApiResponse(
        [makeConversation()],
        { page: 1, total: 50, totalPages: 3 }
      ))
      mockGetTagConversations.mockResolvedValueOnce(makeApiResponse(
        [makeConversation({ id: 'conv-021' })],
        { page: 2, total: 50, totalPages: 3 }
      ))

      const wrapper = await openModal()
      await flushPromises()

      const btns3 = wrapper.findAll('.pagination-btn')
      await btns3[1]!.trigger('click')
      await flushPromises()

      expect(mockGetTagConversations).toHaveBeenCalledTimes(2)
      expect(mockGetTagConversations).toHaveBeenNthCalledWith(2, mockTag.id, { page: 2, limit: 20 })
    })
  })

  // =========================================================================
  // Watch — reset on open
  // =========================================================================

  describe('watch behavior', () => {
    it('loads conversations when modal becomes visible', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = mountModal({ visible: false, tag: mockTag })
      expect(mockGetTagConversations).not.toHaveBeenCalled()

      await wrapper.setProps({ visible: true })
      await flushPromises()
      expect(mockGetTagConversations).toHaveBeenCalledOnce()
    })

    it('does not call API when visible becomes false', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()

      vi.clearAllMocks()
      await wrapper.setProps({ visible: false })
      await flushPromises()
      expect(mockGetTagConversations).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Close / dismiss
  // =========================================================================

  describe('close behavior', () => {
    it('emits update:visible false when close button is clicked', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()

      await wrapper.find('.close-btn').trigger('click')
      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    })

    it('emits update:visible false when overlay backdrop is clicked', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()

      await wrapper.find('.modal-overlay').trigger('click')
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    })
  })

  // =========================================================================
  // Escape key handling
  // The second watch (for scroll lock + Escape) fires on visible change.
  // handleKeydown is registered when visible becomes true.
  // =========================================================================

  describe('Escape key', () => {
    it('emits update:visible false when Escape is pressed', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    })

    it('does not emit when a non-Escape key is pressed', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await flushPromises()

      expect(wrapper.emitted('update:visible')).toBeFalsy()
    })
  })

  // =========================================================================
  // Scroll lock
  // =========================================================================

  describe('scroll lock', () => {
    it('sets body overflow hidden when visible becomes true', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      await openModal()
      await flushPromises()
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restores body overflow when visible becomes false', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([]))
      const wrapper = await openModal()
      await flushPromises()
      expect(document.body.style.overflow).toBe('hidden')

      await wrapper.setProps({ visible: false })
      await flushPromises()
      expect(document.body.style.overflow).toBe('')
    })
  })

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('shows empty state when API call fails', async () => {
      mockGetTagConversations.mockRejectedValue(new Error('Network error'))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.loading-spinner').exists()).toBe(false)
      expect(wrapper.text()).toContain('此標籤尚未被應用到任何對話')
    })
  })

  // =========================================================================
  // Header content
  // =========================================================================

  describe('header', () => {
    it('displays tag name in modal title', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse([], { total: 0 }))
      const premiumTag = { ...mockTag, name: 'Premium' }
      const wrapper = mountModal({ visible: false, tag: premiumTag })
      await wrapper.setProps({ visible: true })
      await flushPromises()
      expect(wrapper.find('.modal-title').text()).toBe('Premium')
    })

    it('displays total count in the badge', async () => {
      mockGetTagConversations.mockResolvedValue(makeApiResponse(
        [makeConversation()],
        { total: 42, totalPages: 3 }
      ))
      const wrapper = await openModal()
      await flushPromises()
      expect(wrapper.find('.conversation-count-badge').text()).toContain('42')
    })
  })
})
