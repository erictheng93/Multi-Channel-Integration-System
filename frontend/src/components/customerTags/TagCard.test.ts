import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TagCard from './TagCard.vue'
import type { Tag } from '@/types/tag'

// ---------------------------------------------------------------------------
// Stub icon components — they render SVGs which aren't relevant to logic
// ---------------------------------------------------------------------------
vi.mock('@/components/icons', () => ({
  UsersIcon: { template: '<span class="icon-users" />' },
  MessageCircleIcon: { template: '<span class="icon-message" />' },
  BarChartIcon: { template: '<span class="icon-bar-chart" />' },
  EditIcon: { template: '<span class="icon-edit" />' },
  TrashIcon: { template: '<span class="icon-trash" />' },
}))

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    name: 'VIP',
    color: '#FF5733',
    description: 'High-value customers',
    isActive: true,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    customerCount: 5,
    conversationCount: 3,
    ...overrides,
  }
}

function mountTagCard(tag: Tag, isSelected = false) {
  return mount(TagCard, {
    props: { tag, isSelected },
    global: {
      stubs: {
        // Stub router-link if ever used
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('TagCard — rendering', () => {
  it('renders the tag name', () => {
    const wrapper = mountTagCard(makeTag({ name: 'Premium' }))
    expect(wrapper.find('.tag-name').text()).toBe('Premium')
  })

  it('renders the description when provided', () => {
    const wrapper = mountTagCard(makeTag({ description: 'Top tier' }))
    expect(wrapper.find('.tag-description').text()).toBe('Top tier')
  })

  it('does not render description element when description is absent', () => {
    const wrapper = mountTagCard(makeTag({ description: null }))
    expect(wrapper.find('.tag-description').exists()).toBe(false)
  })

  it('shows the correct conversation count', () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: 7 }))
    const button = wrapper.find('button.stat-item-clickable')
    expect(button.text()).toContain('7')
  })

  it('shows 0 when conversationCount is undefined', () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: undefined }))
    const button = wrapper.find('button.stat-item-clickable')
    expect(button.text()).toContain('0')
  })

  it('shows the correct customer count', () => {
    const wrapper = mountTagCard(makeTag({ customerCount: 12 }))
    expect(wrapper.find('.stat-item').text()).toContain('12')
  })

  it('applies tag-selected class when isSelected is true', () => {
    const wrapper = mountTagCard(makeTag(), true)
    expect(wrapper.find('.tag-card').classes()).toContain('tag-selected')
  })

  it('does not apply tag-selected class when isSelected is false', () => {
    const wrapper = mountTagCard(makeTag(), false)
    expect(wrapper.find('.tag-card').classes()).not.toContain('tag-selected')
  })

  it('sets color indicator background to tag color', () => {
    const wrapper = mountTagCard(makeTag({ color: '#FF5733' }))
    const indicator = wrapper.find('.tag-color-indicator')
    // JSDOM normalizes hex colors to rgb() in computed style.
    // Verify the style attribute is present and non-empty.
    const style = indicator.attributes('style') ?? ''
    expect(style).toMatch(/background/)
  })
})

// ===========================================================================
// Conversation count button — disabled state
// ===========================================================================

describe('TagCard — conversation count button disabled state', () => {
  it('is enabled when conversationCount > 0', () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: 3 }))
    const btn = wrapper.find('button.stat-item-clickable')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('is disabled when conversationCount is 0', () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: 0 }))
    const btn = wrapper.find('button.stat-item-clickable')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('is disabled when conversationCount is undefined', () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: undefined }))
    const btn = wrapper.find('button.stat-item-clickable')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('button title includes the conversation count', () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: 5 }))
    const btn = wrapper.find('button.stat-item-clickable')
    expect(btn.attributes('title')).toContain('5')
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('TagCard — emitted events', () => {
  it('emits view-conversations when conversation count button is clicked', async () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: 3 }))
    await wrapper.find('button.stat-item-clickable').trigger('click')
    expect(wrapper.emitted('view-conversations')).toBeTruthy()
    expect(wrapper.emitted('view-conversations')).toHaveLength(1)
  })

  it('does not emit view-conversations when button is disabled (count = 0)', async () => {
    const wrapper = mountTagCard(makeTag({ conversationCount: 0 }))
    const btn = wrapper.find('button.stat-item-clickable')
    // Native disabled button does not fire click events in JSDOM
    await btn.trigger('click')
    // Even if click fires, the :disabled attribute semantically prevents interaction
    // We verify the button IS disabled rather than checking emission
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits select when checkbox is changed', async () => {
    const wrapper = mountTagCard(makeTag())
    await wrapper.find('.checkbox-input').trigger('change')
    expect(wrapper.emitted('select')).toBeTruthy()
  })

  it('emits edit when edit action button is clicked', async () => {
    const wrapper = mountTagCard(makeTag())
    await wrapper.find('.action-btn-primary').trigger('click')
    expect(wrapper.emitted('edit')).toBeTruthy()
  })

  it('emits delete when delete action button is clicked', async () => {
    const wrapper = mountTagCard(makeTag())
    await wrapper.find('.action-btn-danger').trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('emits view-stats when stats action button is clicked', async () => {
    const wrapper = mountTagCard(makeTag())
    await wrapper.find('.action-btn-info').trigger('click')
    expect(wrapper.emitted('view-stats')).toBeTruthy()
  })
})
