/**
 * MemberListSection Component Unit Tests
 *
 * Focused on search bar + pagination functionality (newly added features).
 * Does NOT exhaustively test drag-and-drop or selection mode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MemberListSection from '@/components/team/MemberListSection.vue'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('vue-draggable-plus', () => ({
  VueDraggable: {
    name: 'VueDraggable',
    template: '<div class="vue-draggable-stub"><slot /></div>',
    props: ['modelValue', 'disabled', 'animation', 'handle', 'ghostClass', 'chosenClass', 'dragClass'],
    emits: ['update:modelValue', 'start', 'end'],
  },
}))

vi.mock('@/components/ui/HamsterLoader.vue', () => ({
  default: { name: 'HamsterLoader', template: '<div class="hamster-loader-stub" />', props: ['message'] },
}))

vi.mock('@/components/ui/EmptyState.vue', () => ({
  default: { name: 'EmptyState', template: '<div class="empty-state-stub"><slot name="icon" /><slot name="actions" /></div>', props: ['title', 'description'] },
}))

vi.mock('@/components/ui/PaginationControls.vue', () => ({
  default: { name: 'PaginationControls', template: '<div class="pagination-controls-stub" />', props: ['pagination', 'visiblePages'], emits: ['change-page'] },
}))

vi.mock('@/components/team/TeamMemberCard.vue', () => ({
  default: {
    name: 'TeamMemberCard',
    template: '<div class="team-member-card-stub" />',
    props: ['member', 'allTeams', 'currentUserId', 'loading', 'isSelectionMode', 'isSelected'],
    emits: ['update-role', 'toggle-status', 'reset-password', 'remove-member', 'toggle-selection'],
  },
}))

vi.mock('@/components/ui/PrimaryActionButton.vue', () => ({
  default: { name: 'PrimaryActionButton', template: '<div class="primary-action-btn-stub" />', props: ['text', 'icon', 'loading'], emits: ['click'] },
}))

vi.mock('@/components/ui/SortDropdown.vue', () => ({
  default: {
    name: 'SortDropdown',
    template: '<div class="sort-dropdown-stub" />',
    props: ['options', 'currentField', 'currentLabel', 'sortOrder', 'isCustomMode'],
    emits: ['select', 'toggle-order', 'reset-to-auto'],
  },
}))

// Mock all icons — inline stubs because vi.mock is hoisted before variable declarations
vi.mock('@/components/icons/UsersIcon.vue', () => ({ default: { template: '<span class="icon-stub" />' } }))
vi.mock('@/components/icons/PlusIcon.vue', () => ({ default: { template: '<span class="icon-stub" />' } }))
vi.mock('@/components/icons/CheckSquareIcon.vue', () => ({ default: { template: '<span class="icon-stub" />' } }))
vi.mock('@/components/icons/SquareIcon.vue', () => ({ default: { template: '<span class="icon-stub" />' } }))
vi.mock('@/components/icons/TrashIcon.vue', () => ({ default: { template: '<span class="icon-stub" />' } }))
vi.mock('@/components/icons/EditIcon.vue', () => ({ default: { template: '<span class="icon-stub" />' } }))
vi.mock('@/components/icons', () => ({ SearchIcon: { template: '<span class="icon-stub" />' } }))

// ── Types ──────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  loginId: string
  name?: string
  email?: string
  role: 'admin' | 'agent'
  status: 'active' | 'inactive' | 'pending'
  primaryTeamName?: string
  createdAt: string
  updatedAt: string
}

// ── Helpers ────────────────────────────────────────────────────────

function makeMembers(count: number): TeamMember[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${i + 1}`,
    loginId: `user${i + 1}`,
    name: `Member ${i + 1}`,
    email: `member${i + 1}@test.com`,
    role: 'agent' as const,
    status: 'active' as const,
    primaryTeamName: `Team ${(i % 3) + 1}`,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }))
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    members: makeMembers(5),
    allTeams: [],
    loading: false,
    sortOptions: [{ field: 'name', label: 'Name' }],
    sortState: { field: 'name', order: 'asc' as const },
    currentSortLabel: 'Name',
    sortMode: 'auto' as const,
    ...overrides,
  }
}

function mountComponent(overrides: Record<string, unknown> = {}) {
  return mount(MemberListSection, {
    props: defaultProps(overrides) as InstanceType<typeof MemberListSection>['$props'],
  })
}

async function flushDebounce() {
  await nextTick()
  vi.advanceTimersByTime(300)
  await nextTick()
}

// ── Tests ──────────────────────────────────────────────────────────

describe('MemberListSection.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. Search bar visibility ────────────────────────────────────

  describe('Search bar visibility', () => {
    it('hides search bar when loading=true', () => {
      const wrapper = mountComponent({ loading: true })
      expect(wrapper.find('.search-bar').exists()).toBe(false)
    })

    it('hides search bar when members=[]', () => {
      const wrapper = mountComponent({ members: [] })
      expect(wrapper.find('.search-bar').exists()).toBe(false)
    })

    it('shows search bar when members exist and not loading', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.search-bar').exists()).toBe(true)
    })
  })

  // ── 2. Search filtering ─────────────────────────────────────────

  describe('Search filtering', () => {
    it('filters members by name', async () => {
      const members = makeMembers(5)
      members[0].name = 'Alice Wonderland'
      const wrapper = mountComponent({ members })

      await wrapper.find('.search-input').setValue('Alice')
      await flushDebounce()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(1)
    })

    it('filters members by email', async () => {
      const members = makeMembers(5)
      members[2].email = 'unique-email@example.com'
      const wrapper = mountComponent({ members })

      await wrapper.find('.search-input').setValue('unique-email')
      await flushDebounce()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(1)
    })

    it('filters members by loginId', async () => {
      const members = makeMembers(5)
      members[1].loginId = 'speciallogin'
      const wrapper = mountComponent({ members })

      await wrapper.find('.search-input').setValue('speciallogin')
      await flushDebounce()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(1)
    })

    it('filters members by primaryTeamName', async () => {
      const members = makeMembers(5)
      members[3].primaryTeamName = 'UniqueTeamXYZ'
      const wrapper = mountComponent({ members })

      await wrapper.find('.search-input').setValue('UniqueTeamXYZ')
      await flushDebounce()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(1)
    })

    it('returns all members when query is empty', async () => {
      const wrapper = mountComponent({ members: makeMembers(5) })

      // Type something then clear
      await wrapper.find('.search-input').setValue('test')
      await flushDebounce()
      await wrapper.find('.search-input').setValue('')
      await flushDebounce()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(5)
    })
  })

  // ── 3. Search UI ────────────────────────────────────────────────

  describe('Search UI', () => {
    it('input has correct placeholder', () => {
      const wrapper = mountComponent()
      const input = wrapper.find('.search-input')
      expect(input.attributes('placeholder')).toBe('搜尋成員 (姓名、信箱、帳號)...')
    })

    it('clear button hidden when query is empty', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('.search-clear').exists()).toBe(false)
    })

    it('clear button visible when query is non-empty', async () => {
      const wrapper = mountComponent()
      await wrapper.find('.search-input').setValue('test')
      expect(wrapper.find('.search-clear').exists()).toBe(true)
    })

    it('shows stats counter "找到 X / Y" when searching', async () => {
      const members = makeMembers(5)
      members[0].name = 'Alice Special'
      const wrapper = mountComponent({ members })

      await wrapper.find('.search-input').setValue('Alice Special')
      await flushDebounce()

      const stats = wrapper.find('.search-stats')
      expect(stats.exists()).toBe(true)
      expect(stats.text()).toContain('找到')
      expect(stats.text()).toContain('1')
      expect(stats.text()).toContain('5')
    })
  })

  // ── 4. Pagination ───────────────────────────────────────────────

  describe('Pagination', () => {
    it('PAGE_SIZE is 10 — shows max 10 items per page', async () => {
      const wrapper = mountComponent({ members: makeMembers(15) })
      await nextTick()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(10)
    })

    it('shows all items when count <= 10', async () => {
      const wrapper = mountComponent({ members: makeMembers(8) })
      await nextTick()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(8)
    })

    it('renders PaginationControls when >10 items', async () => {
      const wrapper = mountComponent({ members: makeMembers(15) })
      await nextTick()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.exists()).toBe(true)
      expect(pagination.props('pagination')).toMatchObject({
        total: 15,
        totalPages: 2,
      })
    })

    it('renders PaginationControls with totalPages=1 when <=10 items', async () => {
      const wrapper = mountComponent({ members: makeMembers(8) })
      await nextTick()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.exists()).toBe(true)
      expect(pagination.props('pagination')).toMatchObject({
        total: 8,
        totalPages: 1,
      })
    })

    it('pagination info reflects correct page and total', async () => {
      const wrapper = mountComponent({ members: makeMembers(25) })
      await nextTick()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination')).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      })
    })
  })

  // ── 5. Search + Pagination interaction ──────────────────────────

  describe('Search + pagination interaction', () => {
    it('search resets to page 1 (pagination total updates)', async () => {
      const members = makeMembers(15)
      // Give 3 members a unique name for search
      members[0].name = 'SpecialAlpha'
      members[5].name = 'SpecialBeta'
      members[10].name = 'SpecialGamma'

      const wrapper = mountComponent({ members })
      await nextTick()

      // Search for 'Special'
      await wrapper.find('.search-input').setValue('Special')
      await flushDebounce()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination')).toMatchObject({
        page: 1,
        total: 3,
        totalPages: 1,
      })
    })

    it('pagination total updates when filter changes', async () => {
      const members = makeMembers(20)
      members[0].name = 'UniqueXYZ'
      const wrapper = mountComponent({ members })
      await nextTick()

      // Initially 20 items
      let pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').total).toBe(20)

      // Search narrows to 1
      await wrapper.find('.search-input').setValue('UniqueXYZ')
      await flushDebounce()

      pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').total).toBe(1)
    })

    it('filtered + paginated works together', async () => {
      // Create 15 members, 12 with name containing "Alpha"
      const members = makeMembers(15)
      for (let i = 0; i < 12; i++) {
        members[i].name = `Alpha Person ${i + 1}`
      }
      members[12].name = 'Beta One'
      members[13].name = 'Beta Two'
      members[14].name = 'Beta Three'

      const wrapper = mountComponent({ members })
      await nextTick()

      // Search for "Alpha" — should get 12 results, page 1 shows 10
      await wrapper.find('.search-input').setValue('Alpha')
      await flushDebounce()

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(10)

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination')).toMatchObject({
        total: 12,
        totalPages: 2,
      })
    })
  })

  // ── 6. Drag disabled during search ──────────────────────────────

  describe('Drag disabled during search', () => {
    it('VueDraggable is disabled when searching', async () => {
      const wrapper = mountComponent({ members: makeMembers(5) })

      await wrapper.find('.search-input').setValue('Member')
      await flushDebounce()

      const draggable = wrapper.findComponent({ name: 'VueDraggable' })
      expect(draggable.props('disabled')).toBe(true)
    })

    it('VueDraggable is enabled when not searching', async () => {
      const wrapper = mountComponent({ members: makeMembers(5) })
      await nextTick()

      const draggable = wrapper.findComponent({ name: 'VueDraggable' })
      expect(draggable.props('disabled')).toBe(false)
    })
  })

  // ── 7. Loading / empty states ───────────────────────────────────

  describe('Loading and empty states', () => {
    it('shows loader when loading', () => {
      const wrapper = mountComponent({ loading: true })
      const loader = wrapper.findComponent({ name: 'HamsterLoader' })
      expect(loader.exists()).toBe(true)
    })

    it('shows empty state when no members', () => {
      const wrapper = mountComponent({ members: [], loading: false })
      const empty = wrapper.findComponent({ name: 'EmptyState' })
      expect(empty.exists()).toBe(true)
    })

    it('shows member list when members exist', () => {
      const wrapper = mountComponent({ members: makeMembers(3) })
      const draggable = wrapper.findComponent({ name: 'VueDraggable' })
      expect(draggable.exists()).toBe(true)

      const cards = wrapper.findAllComponents({ name: 'TeamMemberCard' })
      expect(cards.length).toBe(3)
    })
  })

  // ── 8. Clear search ─────────────────────────────────────────────

  describe('Clear search', () => {
    it('clicking clear button resets search and shows all members', async () => {
      const members = makeMembers(5)
      members[0].name = 'UniqueOnly'
      const wrapper = mountComponent({ members })

      // Search
      await wrapper.find('.search-input').setValue('UniqueOnly')
      await flushDebounce()
      expect(wrapper.findAllComponents({ name: 'TeamMemberCard' }).length).toBe(1)

      // Clear
      await wrapper.find('.search-clear').trigger('click')
      await flushDebounce()

      expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('')
      expect(wrapper.findAllComponents({ name: 'TeamMemberCard' }).length).toBe(5)
    })
  })
})
