import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { ActivityLog } from '@/api/activities'

// Mock icons used transitively through utils.ts
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

import ActivityTimeline from './ActivityTimeline.vue'

let idCounter = 0

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  idCounter++
  return {
    id: idCounter,
    userId: `user-${idCounter}`,
    userName: `User ${idCounter}`,
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

// Stubs for child components
const ActivityTimelineItemStub = defineComponent({
  name: 'ActivityTimelineItem',
  props: ['activity'],
  setup(props) {
    return () =>
      h('div', { class: 'activity-timeline-item-stub', 'data-id': String(props.activity.id) })
  },
})

const ActivityDetailPanelStub = defineComponent({
  name: 'ActivityDetailPanel',
  props: ['entries', 'show'],
  setup() {
    return () => h('div', { class: 'activity-detail-panel-stub' })
  },
})

function mountTimeline(activities: ActivityLog[]) {
  return mount(ActivityTimeline, {
    props: { activities },
    global: {
      stubs: {
        ActivityTimelineItem: ActivityTimelineItemStub,
        ActivityDetailPanel: ActivityDetailPanelStub,
      },
    },
  })
}

describe('ActivityTimeline', () => {
  beforeEach(() => {
    idCounter = 0
    vi.useFakeTimers()
    vi.setSystemTime('2026-03-20T12:00:00Z')
  })

  it('renders date group headers (.timeline__date-header)', () => {
    const activities = [
      makeActivity({ createdAt: '2026-03-20T10:00:00Z' }),
      makeActivity({ createdAt: '2026-03-19T10:00:00Z' }),
    ]
    const wrapper = mountTimeline(activities)
    const headers = wrapper.findAll('.timeline__date-header')
    expect(headers).toHaveLength(2)
  })

  it('renders correct number of timeline items', () => {
    const activities = [
      makeActivity({ createdAt: '2026-03-20T10:00:00Z' }),
      makeActivity({ createdAt: '2026-03-20T09:00:00Z' }),
      makeActivity({ createdAt: '2026-03-19T10:00:00Z' }),
    ]
    const wrapper = mountTimeline(activities)
    const items = wrapper.findAll('.activity-timeline-item-stub')
    expect(items).toHaveLength(3)
  })

  it('empty activities renders nothing inside the container', () => {
    const wrapper = mountTimeline([])
    expect(wrapper.find('.activity-timeline').exists()).toBe(true)
    expect(wrapper.find('.timeline__date-header').exists()).toBe(false)
    expect(wrapper.find('.activity-timeline-item-stub').exists()).toBe(false)
  })

  it('dividers appear between items within same date group', () => {
    const activities = [
      makeActivity({ createdAt: '2026-03-20T10:00:00Z' }),
      makeActivity({ createdAt: '2026-03-20T09:00:00Z' }),
      makeActivity({ createdAt: '2026-03-20T08:00:00Z' }),
    ]
    const wrapper = mountTimeline(activities)
    const dividers = wrapper.findAll('.timeline__divider')
    // 3 items in one group → 2 dividers (between item 1-2 and item 2-3)
    expect(dividers).toHaveLength(2)
  })

  it('no divider after last item in a date group', () => {
    const activities = [
      makeActivity({ createdAt: '2026-03-20T10:00:00Z' }),
    ]
    const wrapper = mountTimeline(activities)
    const dividers = wrapper.findAll('.timeline__divider')
    expect(dividers).toHaveLength(0)
  })

  it('dividers do not span across date groups', () => {
    // 2 items on day1, 2 items on day2 → 1 divider per group = 2 total
    const activities = [
      makeActivity({ createdAt: '2026-03-20T10:00:00Z' }),
      makeActivity({ createdAt: '2026-03-20T09:00:00Z' }),
      makeActivity({ createdAt: '2026-03-19T10:00:00Z' }),
      makeActivity({ createdAt: '2026-03-19T09:00:00Z' }),
    ]
    const wrapper = mountTimeline(activities)
    const dividers = wrapper.findAll('.timeline__divider')
    expect(dividers).toHaveLength(2)
  })
})
