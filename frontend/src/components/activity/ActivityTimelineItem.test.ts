import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { ActivityLog } from '@/api/activities'

// Mock all icons used by utils.ts and ActivityTimelineItem.vue
vi.mock('@/components/icons', () => {
  const stub = defineComponent({
    name: 'IconStub',
    props: { size: { type: Number, default: 24 } },
    setup() {
      return () => h('svg', { class: 'icon-stub' })
    },
  })
  return {
    LoginIcon: stub,
    LogoutIcon: stub,
    ChatIcon: stub,
    UsersIcon: stub,
    ForwardIcon: stub,
    XIcon: stub,
    RefreshIcon: stub,
    CogIcon: stub,
    UserPlusIcon: stub,
    UserIcon: stub,
    FileIcon: stub,
  }
})

// Import after mocks are set up
import ActivityTimelineItem from './ActivityTimelineItem.vue'

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    userId: 'user-1',
    userName: 'Alice Wang',
    userRole: 'agent',
    action: 'message_send',
    resourceType: 'message',
    resourceId: undefined,
    details: undefined,
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function mountItem(activity: ActivityLog) {
  return mount(ActivityTimelineItem, {
    props: { activity },
    global: {
      stubs: {
        ActivityDetailPanel: {
          name: 'ActivityDetailPanel',
          template: '<div class="activity-detail-panel-stub" />',
          props: ['entries', 'show'],
        },
      },
    },
  })
}

describe('ActivityTimelineItem', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-03-20T12:00:00Z')
  })

  it('renders user name', () => {
    const wrapper = mountItem(makeActivity({ userName: 'Alice Wang' }))
    expect(wrapper.find('.timeline-item__user').text()).toBe('Alice Wang')
  })

  it('renders role badge (.timeline-item__role exists)', () => {
    const wrapper = mountItem(makeActivity({ userRole: 'agent' }))
    expect(wrapper.find('.timeline-item__role').exists()).toBe(true)
  })

  it('renders activity description (.timeline-item__description exists)', () => {
    const wrapper = mountItem(makeActivity({ action: 'message_send' }))
    expect(wrapper.find('.timeline-item__description').exists()).toBe(true)
  })

  it('shows details toggle when activity has details', () => {
    const wrapper = mountItem(makeActivity({
      action: 'user_login',
      details: { ipAddress: '10.0.0.1' },
    }))
    expect(wrapper.find('.timeline-item__details-toggle').exists()).toBe(true)
  })

  it('does NOT show details toggle when no details', () => {
    const wrapper = mountItem(makeActivity({ details: undefined }))
    expect(wrapper.find('.timeline-item__details-toggle').exists()).toBe(false)
  })

  it('toggles detail panel on click', async () => {
    const wrapper = mountItem(makeActivity({
      action: 'user_login',
      details: { ipAddress: '10.0.0.1' },
    }))
    const toggle = wrapper.find('.timeline-item__details-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })

  it('applies correct icon background for message actions (classes contain green)', () => {
    const wrapper = mountItem(makeActivity({ action: 'message_send' }))
    const iconEl = wrapper.find('.timeline-item__icon')
    expect(iconEl.classes().join(' ')).toContain('green')
  })

  it('renders relative time (.timeline-item__time exists)', () => {
    const wrapper = mountItem(makeActivity({
      createdAt: new Date('2026-03-20T11:55:00Z').toISOString(),
    }))
    expect(wrapper.find('.timeline-item__time').exists()).toBe(true)
  })

  it('sets aria-expanded on details toggle (false initially, true after click)', async () => {
    const wrapper = mountItem(makeActivity({
      action: 'settings_update',
      details: { field: 'name', oldValue: 'A', newValue: 'B' },
    }))
    const toggle = wrapper.find('.timeline-item__details-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('has aria-label on role badge', () => {
    const wrapper = mountItem(makeActivity({ userRole: 'admin' }))
    const badge = wrapper.find('.timeline-item__role')
    expect(badge.attributes('aria-label')).toBeTruthy()
  })
})
