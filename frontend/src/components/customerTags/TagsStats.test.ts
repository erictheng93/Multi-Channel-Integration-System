import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TagsStats from './TagsStats.vue'
import type { Tag } from '@/types/tag'

const tag = (id: number, name: string, conversationCount: number): Tag => ({
  id,
  name,
  color: '#3b82f6',
  description: '',
  conversationCount,
} as unknown as Tag)

const tags = [tag(1, 'VIP 客戶', 28), tag(2, '經銷商', 34), tag(3, '樣品申請', 0)]

function mountStats(activeTagId: number | null = null) {
  return mount(TagsStats, {
    props: { stats: { totalTags: 3, totalConversations: 62, activeTags: 2 }, tags, activeTagId },
  })
}

describe('TagsStats -- tag map', () => {
  it('draws a tile for every tag in use and lists the unused ones apart', () => {
    const wrapper = mountStats()
    expect(wrapper.findAll('.tile')).toHaveLength(2)
    expect(wrapper.find('.map-unused').text()).toContain('樣品申請')
    expect(wrapper.find('.lead-facts').text()).toContain('經銷商')
  })

  it('names each tile with its tag and conversation count', () => {
    const wrapper = mountStats()
    const labels = wrapper.findAll('.tile').map((t) => t.attributes('aria-label'))
    expect(labels).toContain('經銷商，34 個對話')
    expect(labels).toContain('VIP 客戶，28 個對話')
  })

  it('marks the open tag and emits the tag id on click', async () => {
    const wrapper = mountStats(1)
    const tiles = wrapper.findAll('.tile')
    expect(tiles.filter((t) => t.classes('is-active'))).toHaveLength(1)
    await tiles[0]?.trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([2])
  })

  it('explains an empty map', () => {
    const wrapper = mount(TagsStats, {
      props: { stats: { totalTags: 1, totalConversations: 0, activeTags: 0 }, tags: [tag(3, '樣品申請', 0)] },
    })
    expect(wrapper.find('.map-empty').exists()).toBe(true)
    expect(wrapper.findAll('.tile')).toHaveLength(0)
  })

  it('folds tags too small to read into one other tile and keeps every count visible', () => {
    const many = [tag(1, 'A', 120), tag(2, 'B', 60), tag(3, 'C', 40), tag(4, 'D', 2), tag(5, 'E', 1)]
    const wrapper = mount(TagsStats, {
      props: { stats: { totalTags: 5, totalConversations: 223, activeTags: 5 }, tags: many },
    })
    const other = wrapper.find('.tile.is-other')
    expect(other.exists()).toBe(true)
    expect(other.text()).toContain('3')
    expect(wrapper.findAll('.tile').every((t) => t.find('.tile-n').exists())).toBe(true)
  })
})
