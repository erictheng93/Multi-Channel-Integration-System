import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import TagsList from '@/components/customerTags/TagsList.vue'

vi.mock('@/components/icons', () => ({
  TagIcon: { template: '<span />' },
}))

interface Tag {
  id: number
  name: string
  color: string
  description?: string
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  conversationCount?: number
  customerCount?: number
}

function makeTags(count: number): Tag[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Tag ${i + 1}`,
    color: '#FF0000',
    isActive: true,
    createdBy: 'admin',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    conversationCount: i,
    customerCount: i,
  }))
}

const PAGE_SIZE = 24

function factory(props: Partial<{ tags: Tag[]; loading: boolean; isSelected: (_id: number) => boolean }> = {}) {
  return shallowMount(TagsList, {
    props: {
      tags: [],
      loading: false,
      isSelected: () => false,
      ...props,
    },
  })
}

describe('TagsList', () => {
  describe('Empty state', () => {
    it('shows empty state when tags=[] and loading=false', () => {
      const wrapper = factory({ tags: [], loading: false })
      expect(wrapper.text()).toContain('暫無標籤')
    })

    it('empty state has title "暫無標籤"', () => {
      const wrapper = factory({ tags: [], loading: false })
      const text = wrapper.text()
      expect(text).toContain('暫無標籤')
    })

    it('does not render TagCard when tags is empty', () => {
      const wrapper = factory({ tags: [], loading: false })
      const tagCards = wrapper.findAllComponents({ name: 'TagCard' })
      expect(tagCards).toHaveLength(0)
    })

    it('does not render PaginationControls when tags is empty', () => {
      const wrapper = factory({ tags: [], loading: false })
      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.exists()).toBe(false)
    })
  })

  describe('Tags grid rendering', () => {
    it('renders TagCard for each tag (up to PAGE_SIZE)', () => {
      const tags = makeTags(10)
      const wrapper = factory({ tags })
      const tagCards = wrapper.findAllComponents({ name: 'TagCard' })
      expect(tagCards).toHaveLength(10)
    })

    it('passes correct props to TagCard', () => {
      const tags = makeTags(2)
      const isSelected = (id: number) => id === 1
      const wrapper = factory({ tags, isSelected })
      const tagCards = wrapper.findAllComponents({ name: 'TagCard' })

      expect(tagCards[0].props('tag')).toEqual(tags[0])
      expect(tagCards[0].props('isSelected')).toBe(true)
      expect(tagCards[1].props('tag')).toEqual(tags[1])
      expect(tagCards[1].props('isSelected')).toBe(false)
    })
  })

  describe('Pagination', () => {
    it('PaginationControls rendered when tags exist (even <= 24)', () => {
      // PaginationControls is always in the v-else block (tags.length > 0)
      const wrapper = factory({ tags: makeTags(PAGE_SIZE) })
      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.exists()).toBe(true)
    })

    it('PaginationControls rendered when tags.length > 24', () => {
      const wrapper = factory({ tags: makeTags(PAGE_SIZE + 1) })
      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.exists()).toBe(true)
    })

    it('pagination shows totalPages=1 when tags.length <= 24', () => {
      const wrapper = factory({ tags: makeTags(PAGE_SIZE) })
      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').totalPages).toBe(1)
    })

    it('pagination shows totalPages=2 when tags.length > 24', () => {
      const wrapper = factory({ tags: makeTags(30) })
      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      expect(pagination.props('pagination').totalPages).toBe(2)
    })

    it('only first 24 tags shown on page 1', () => {
      const tags = makeTags(30)
      const wrapper = factory({ tags })
      const tagCards = wrapper.findAllComponents({ name: 'TagCard' })
      expect(tagCards).toHaveLength(PAGE_SIZE)
      expect(tagCards[0].props('tag')).toEqual(tags[0])
      expect(tagCards[PAGE_SIZE - 1].props('tag')).toEqual(tags[PAGE_SIZE - 1])
    })

    it('changing page shows next batch', async () => {
      const tags = makeTags(30)
      const wrapper = factory({ tags })
      const pagination = wrapper.findComponent({ name: 'PaginationControls' })

      // Emit the correct event name: change-page
      await pagination.vm.$emit('change-page', 2)
      await wrapper.vm.$nextTick()

      const tagCards = wrapper.findAllComponents({ name: 'TagCard' })
      expect(tagCards).toHaveLength(30 - PAGE_SIZE)
      expect(tagCards[0].props('tag')).toEqual(tags[PAGE_SIZE])
    })
  })

  describe('Props change', () => {
    it('when tags.length changes, resets to page 1 and updates total', async () => {
      const wrapper = factory({ tags: makeTags(30) })

      // Navigate to page 2
      const pagination = wrapper.findComponent({ name: 'PaginationControls' })
      await pagination.vm.$emit('change-page', 2)
      await wrapper.vm.$nextTick()

      // Now change the tags prop
      await wrapper.setProps({ tags: makeTags(50) })
      await wrapper.vm.$nextTick()

      // Should reset to page 1 — first 24 tags shown
      const tagCards = wrapper.findAllComponents({ name: 'TagCard' })
      expect(tagCards).toHaveLength(PAGE_SIZE)
      expect(tagCards[0].props('tag').id).toBe(1)

      // Pagination should reflect new total
      const paginationAfter = wrapper.findComponent({ name: 'PaginationControls' })
      expect(paginationAfter.props('pagination').total).toBe(50)
    })
  })

  describe('Events', () => {
    it('bubbles select-tag event from TagCard', async () => {
      const tags = makeTags(3)
      const wrapper = factory({ tags })
      const tagCard = wrapper.findAllComponents({ name: 'TagCard' })[1]

      await tagCard.vm.$emit('select')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select-tag')).toBeTruthy()
      expect(wrapper.emitted('select-tag')![0]).toEqual([tags[1].id])
    })

    it('bubbles edit-tag event from TagCard', async () => {
      const tags = makeTags(3)
      const wrapper = factory({ tags })
      const tagCard = wrapper.findAllComponents({ name: 'TagCard' })[0]

      await tagCard.vm.$emit('edit')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('edit-tag')).toBeTruthy()
      expect(wrapper.emitted('edit-tag')![0]).toEqual([tags[0]])
    })

    it('bubbles delete-tag event from TagCard', async () => {
      const tags = makeTags(3)
      const wrapper = factory({ tags })
      const tagCard = wrapper.findAllComponents({ name: 'TagCard' })[2]

      await tagCard.vm.$emit('delete')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('delete-tag')).toBeTruthy()
      expect(wrapper.emitted('delete-tag')![0]).toEqual([tags[2]])
    })

    it('bubbles view-stats event from TagCard', async () => {
      const tags = makeTags(2)
      const wrapper = factory({ tags })
      const tagCard = wrapper.findAllComponents({ name: 'TagCard' })[0]

      await tagCard.vm.$emit('view-stats')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('view-stats')).toBeTruthy()
      expect(wrapper.emitted('view-stats')![0]).toEqual([tags[0]])
    })

    it('bubbles view-conversations event from TagCard', async () => {
      const tags = makeTags(2)
      const wrapper = factory({ tags })
      const tagCard = wrapper.findAllComponents({ name: 'TagCard' })[1]

      await tagCard.vm.$emit('view-conversations')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('view-conversations')).toBeTruthy()
      expect(wrapper.emitted('view-conversations')![0]).toEqual([tags[1]])
    })
  })
})
