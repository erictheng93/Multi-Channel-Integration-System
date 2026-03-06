import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount as vtuMount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TeamListSection from '@/components/team/TeamListSection.vue'

// ── Hoisted stubs (available inside vi.mock factories) ──

const { VueDraggableStub, TeamCardStub } = vi.hoisted(() => {
  const { defineComponent: dc } = require('vue')

  const VueDraggableStub = dc({
    name: 'VueDraggable',
    props: ['modelValue', 'disabled', 'animation', 'ghostClass', 'chosenClass', 'dragClass'],
    emits: ['update:modelValue', 'start', 'end'],
    template: '<div class="vue-draggable-stub"><slot /></div>',
  })

  const TeamCardStub = dc({
    name: 'TeamCard',
    props: ['team', 'loading'],
    template: '<div class="team-card-stub" :data-team-id="team?.id" />',
  })

  return { VueDraggableStub, TeamCardStub }
})

// ── Mocks ──

vi.mock('vue-draggable-plus', () => ({
  VueDraggable: VueDraggableStub,
}))

vi.mock('@/components/team/TeamCard.vue', () => ({
  default: TeamCardStub,
}))

vi.mock('@/components/ui/HamsterLoader.vue', () => ({
  default: {
    name: 'HamsterLoader',
    props: ['message'],
    template: '<div class="hamster-loader-stub" />',
  },
}))

vi.mock('@/components/ui/EmptyState.vue', () => ({
  default: {
    name: 'EmptyState',
    props: ['title', 'description'],
    template: '<div class="empty-state-stub"><slot name="icon" /><slot name="actions" /></div>',
  },
}))

vi.mock('@/components/ui/PaginationControls.vue', () => ({
  default: {
    name: 'PaginationControls',
    props: ['pagination', 'visiblePages'],
    emits: ['change-page'],
    template: '<div class="pagination-controls-stub" />',
  },
}))

vi.mock('@/components/ui/PrimaryActionButton.vue', () => ({
  default: {
    name: 'PrimaryActionButton',
    props: ['text', 'icon', 'loading'],
    template: '<button class="primary-action-button-stub"><slot /></button>',
  },
}))

vi.mock('@/components/ui/SortDropdown.vue', () => ({
  default: {
    name: 'SortDropdown',
    props: ['options', 'currentField', 'currentLabel', 'sortOrder', 'isCustomMode'],
    emits: ['select', 'toggle-order', 'reset-to-auto'],
    template: '<div class="sort-dropdown-stub" />',
  },
}))

vi.mock('@/components/icons/TeamsIcon.vue', () => ({
  default: { template: '<span class="teams-icon" />' },
}))

vi.mock('@/components/icons/PlusIcon.vue', () => ({
  default: { template: '<span class="plus-icon" />' },
}))

vi.mock('@/components/icons', () => ({
  SearchIcon: { template: '<span class="search-icon-stub" />' },
}))

// ── Types ──

interface Team {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ── Helpers ──

function makeTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Team ${i + 1}`,
    description: `Description ${i + 1}`,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }))
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    teams: makeTeams(5),
    loading: false,
    sortOptions: [{ field: 'name', label: 'Name' }],
    sortState: { field: 'name', order: 'asc' as const },
    currentSortLabel: 'Name',
    sortMode: 'auto' as const,
    ...overrides,
  }
}

function createWrapper(overrides: Record<string, unknown> = {}) {
  return vtuMount(TeamListSection, {
    props: defaultProps(overrides),
    shallow: true,
    global: {
      stubs: {
        VueDraggable: VueDraggableStub,
        TeamCard: TeamCardStub,
      },
    },
  })
}

/**
 * Flush the 300ms debounce timer and allow Vue reactivity to settle.
 */
async function flushDebounce() {
  await nextTick()
  vi.advanceTimersByTime(300)
  await nextTick()
  await nextTick()
  await nextTick()
}

function findSearchInput(wrapper: ReturnType<typeof createWrapper>) {
  return wrapper.find('input.search-input')
}

// ── Tests ──

describe('TeamListSection — search bar + pagination', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── 1. Search bar visibility ───

  describe('search bar visibility', () => {
    it('is hidden when loading=true', () => {
      const wrapper = createWrapper({ loading: true })
      expect(wrapper.find('.search-bar').exists()).toBe(false)
    })

    it('is hidden when teams is empty', () => {
      const wrapper = createWrapper({ teams: [] })
      expect(wrapper.find('.search-bar').exists()).toBe(false)
    })

    it('is visible when teams exist and not loading', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.search-bar').exists()).toBe(true)
    })
  })

  // ─── 2. Search filtering ───

  describe('search filtering', () => {
    it('filters teams by name', async () => {
      const teams = [
        { id: 1, name: 'Alpha', description: 'Desc A', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 2, name: 'Beta', description: 'Desc B', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 3, name: 'Gamma', description: 'Desc C', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ]
      const wrapper = createWrapper({ teams })

      await findSearchInput(wrapper).setValue('Alpha')
      await flushDebounce()

      const cards = wrapper.findAllComponents(TeamCardStub)
      expect(cards).toHaveLength(1)
    })

    it('filters teams by description', async () => {
      const teams = [
        { id: 1, name: 'Team A', description: 'Engineering', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 2, name: 'Team B', description: 'Marketing', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ]
      const wrapper = createWrapper({ teams })

      await findSearchInput(wrapper).setValue('Marketing')
      await flushDebounce()

      const cards = wrapper.findAllComponents(TeamCardStub)
      expect(cards).toHaveLength(1)
    })

    it('returns all teams when query is empty', async () => {
      const teams = makeTeams(4)
      const wrapper = createWrapper({ teams })

      await findSearchInput(wrapper).setValue('')
      await flushDebounce()

      const cards = wrapper.findAllComponents(TeamCardStub)
      expect(cards).toHaveLength(4)
    })

    it('is case-insensitive', async () => {
      const teams = [
        { id: 1, name: 'Alpha Team', description: '', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 2, name: 'Beta Team', description: '', isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ]
      const wrapper = createWrapper({ teams })

      await findSearchInput(wrapper).setValue('alpha')
      await flushDebounce()

      const cards = wrapper.findAllComponents(TeamCardStub)
      expect(cards).toHaveLength(1)
    })
  })

  // ─── 3. Search UI ───

  describe('search UI elements', () => {
    it('has correct placeholder text', () => {
      const wrapper = createWrapper()
      const input = findSearchInput(wrapper)
      expect(input.attributes('placeholder')).toBe('搜尋團隊 (名稱、描述)...')
    })

    it('clear button is hidden when search is empty', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.search-clear').exists()).toBe(false)
    })

    it('clear button is visible when search has value', async () => {
      const wrapper = createWrapper()
      await findSearchInput(wrapper).setValue('test')
      await nextTick()

      expect(wrapper.find('.search-clear').exists()).toBe(true)
    })

    it('shows search stats when searching', async () => {
      const teams = makeTeams(5)
      const wrapper = createWrapper({ teams })

      await findSearchInput(wrapper).setValue('Team 1')
      await flushDebounce()

      const stats = wrapper.find('.search-stats')
      expect(stats.exists()).toBe(true)
      expect(stats.text()).toContain('找到')
    })
  })

  // ─── 4. Pagination ───

  describe('pagination', () => {
    it('shows max 10 items per page', async () => {
      const teams = makeTeams(15)
      const wrapper = createWrapper({ teams })
      await nextTick()

      const cards = wrapper.findAllComponents(TeamCardStub)
      expect(cards.length).toBeLessThanOrEqual(10)
    })

    it('renders PaginationControls with totalPages > 1 when more than 10 items', async () => {
      const teams = makeTeams(15)
      const wrapper = createWrapper({ teams })
      await nextTick()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.exists()).toBe(true)
      expect(pagination.props('pagination').totalPages).toBeGreaterThan(1)
    })

    it('renders PaginationControls with totalPages=1 when 10 or fewer items', async () => {
      const teams = makeTeams(10)
      const wrapper = createWrapper({ teams })
      await nextTick()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').totalPages).toBe(1)
    })

    it('renders PaginationControls with totalPages=1 when fewer than 10 items', async () => {
      const teams = makeTeams(5)
      const wrapper = createWrapper({ teams })
      await nextTick()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').totalPages).toBe(1)
    })
  })

  // ─── 5. Search + pagination interaction ───

  describe('search + pagination interaction', () => {
    it('resets to page 1 on search', async () => {
      const teams = makeTeams(15)
      const wrapper = createWrapper({ teams })
      await nextTick()

      await findSearchInput(wrapper).setValue('Team 1')
      await flushDebounce()

      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').page).toBe(1)
    })

    it('updates total count on filter', async () => {
      const teams = makeTeams(15)
      const wrapper = createWrapper({ teams })
      await nextTick()

      // Initially total = 15
      let pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').total).toBe(15)

      // Search narrows results
      await findSearchInput(wrapper).setValue('Team 1')
      await flushDebounce()

      pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').total).toBeLessThan(15)
    })

    it('search and pagination work together correctly', async () => {
      const teams = makeTeams(25)
      const wrapper = createWrapper({ teams })
      await nextTick()

      // Initially shows 10 out of 25
      let cards = wrapper.findAllComponents(TeamCardStub)
      expect(cards).toHaveLength(10)

      // Search for something that matches many — all 25 contain "Team"
      await findSearchInput(wrapper).setValue('Team')
      await flushDebounce()

      // Should still be paginated (max 10 per page)
      cards = wrapper.findAllComponents(TeamCardStub)
      expect(cards.length).toBeLessThanOrEqual(10)
    })
  })

  // ─── 6. Drag disabled when searching ───

  describe('drag behavior during search', () => {
    it('disables drag when searching', async () => {
      const wrapper = createWrapper()

      await findSearchInput(wrapper).setValue('test')
      await flushDebounce()

      const draggable = wrapper.findComponent(VueDraggableStub)
      expect(draggable.exists()).toBe(true)
      expect(draggable.props('disabled')).toBe(true)
    })

    it('enables drag when not searching', async () => {
      const wrapper = createWrapper()
      await nextTick()

      const draggable = wrapper.findComponent(VueDraggableStub)
      expect(draggable.exists()).toBe(true)
      expect(draggable.props('disabled')).toBe(false)
    })
  })

  // ─── 7. Loading and empty states ───

  describe('loading and empty states', () => {
    it('shows loader when loading', () => {
      const wrapper = createWrapper({ loading: true })
      const loader = wrapper.findComponent({ name: 'HamsterLoader' })
      expect(loader.exists()).toBe(true)
    })

    it('shows empty state when no teams and not loading', () => {
      const wrapper = createWrapper({ teams: [], loading: false })
      const empty = wrapper.findComponent({ name: 'EmptyState' })
      expect(empty.exists()).toBe(true)
    })
  })
})
