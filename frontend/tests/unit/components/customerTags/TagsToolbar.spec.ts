import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import TagsToolbar from '@/components/customerTags/TagsToolbar.vue'

vi.mock('@/components/icons', () => ({
  SearchIcon: { template: '<span class="mock-search-icon" />' },
  TrashIcon: { template: '<span class="mock-trash-icon" />' },
  XIcon: { template: '<span class="mock-x-icon" />' },
}))

function createWrapper(props: Partial<{
  searchQuery: string
  hasSelection: boolean
  selectionCount: number
  isSearching: boolean
  filteredCount: number
  totalCount: number
}> = {}) {
  return shallowMount(TagsToolbar, {
    props: {
      searchQuery: '',
      hasSelection: false,
      selectionCount: 0,
      isSearching: false,
      filteredCount: 0,
      totalCount: 0,
      ...props,
    },
  })
}

describe('TagsToolbar', () => {
  describe('Rendering', () => {
    it('renders search input with correct placeholder', () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')
      expect(input.exists()).toBe(true)
      expect(input.attributes('placeholder')).toBe('搜尋標籤名稱或描述...')
    })

    it('does not show clear button when localSearchQuery is empty', () => {
      const wrapper = createWrapper({ searchQuery: '' })
      const clearBtn = wrapper.find('.search-clear')
      expect(clearBtn.exists()).toBe(false)
    })

    it('shows clear button when localSearchQuery is non-empty', () => {
      const wrapper = createWrapper({ searchQuery: 'test' })
      const clearBtn = wrapper.find('.search-clear')
      expect(clearBtn.exists()).toBe(true)
      expect(clearBtn.text()).toContain('✕')
    })

    it('does not show search stats when isSearching is false', () => {
      const wrapper = createWrapper({ isSearching: false, filteredCount: 3, totalCount: 10 })
      expect(wrapper.find('.search-stats').exists()).toBe(false)
    })

    it('shows search stats with correct format when isSearching is true', () => {
      const wrapper = createWrapper({ isSearching: true, filteredCount: 3, totalCount: 10 })
      const stats = wrapper.find('.search-stats')
      expect(stats.exists()).toBe(true)
      expect(stats.text()).toContain('3')
      expect(stats.text()).toContain('10')
    })

    it('does not show selection indicator when hasSelection is false', () => {
      const wrapper = createWrapper({ hasSelection: false, selectionCount: 0 })
      expect(wrapper.find('.selection-indicator').exists()).toBe(false)
    })

    it('shows selection indicator with correct count when hasSelection is true', () => {
      const wrapper = createWrapper({ hasSelection: true, selectionCount: 5 })
      const indicator = wrapper.find('.selection-indicator')
      expect(indicator.exists()).toBe(true)
      expect(indicator.text()).toContain('已選擇 5 個標籤')
    })
  })

  describe('Search interaction', () => {
    it('typing in input emits update:search-query', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input')
      await input.setValue('hello')
      expect(wrapper.emitted('update:search-query')).toBeTruthy()
      const emitted = wrapper.emitted('update:search-query')!
      expect(emitted[emitted.length - 1]).toEqual(['hello'])
    })

    it('clear button click resets and emits empty string', async () => {
      const wrapper = createWrapper({ searchQuery: 'test' })
      const clearBtn = wrapper.find('.search-clear')
      expect(clearBtn.exists()).toBe(true)

      await clearBtn.trigger('click')

      const emitted = wrapper.emitted('update:search-query')!
      expect(emitted[emitted.length - 1]).toEqual([''])
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
    })

    it('Escape key triggers handleClear', async () => {
      const wrapper = createWrapper({ searchQuery: 'test' })
      const input = wrapper.find('input')

      await input.trigger('keydown.escape')

      const emitted = wrapper.emitted('update:search-query')!
      expect(emitted[emitted.length - 1]).toEqual([''])
      expect((input.element as HTMLInputElement).value).toBe('')
    })
  })

  describe('Props sync', () => {
    it('localSearchQuery syncs when props.searchQuery changes externally', async () => {
      const wrapper = createWrapper({ searchQuery: 'initial' })
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('initial')

      await wrapper.setProps({ searchQuery: 'updated' })
      await wrapper.vm.$nextTick()

      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('updated')
    })
  })

  describe('Bulk actions', () => {
    it('delete button emits bulk-delete', async () => {
      const wrapper = createWrapper({ hasSelection: true, selectionCount: 2 })
      const deleteBtn = wrapper.find('.btn-danger')
      expect(deleteBtn.exists()).toBe(true)

      await deleteBtn.trigger('click')
      expect(wrapper.emitted('bulk-delete')).toBeTruthy()
    })

    it('cancel button emits clear-selection', async () => {
      const wrapper = createWrapper({ hasSelection: true, selectionCount: 2 })
      const cancelBtn = wrapper.find('.btn-secondary')
      expect(cancelBtn.exists()).toBe(true)

      await cancelBtn.trigger('click')
      expect(wrapper.emitted('clear-selection')).toBeTruthy()
    })
  })
})
