import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ActivityLog from './ActivityLog.vue'
import { activitiesApi } from '@/api/activities'
import { apiClient } from '@/api'
import { useWebSocketStore } from '@/stores/websocket'

const routePath = vi.hoisted(() => ({ value: '/activities' }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: routePath.value }),
}))

vi.mock('@/api/activities', () => ({
  activitiesApi: {
    list: vi.fn(),
    getOverview: vi.fn(),
    export: vi.fn(),
  },
}))

vi.mock('@/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

vi.mock('@/components/icons', () => ({
  LoginIcon: { template: '<svg />', props: ['size'] },
  LogoutIcon: { template: '<svg />', props: ['size'] },
  ChatIcon: { template: '<svg />', props: ['size'] },
  UsersIcon: { template: '<svg />', props: ['size'] },
  ForwardIcon: { template: '<svg />', props: ['size'] },
  XIcon: { template: '<svg />', props: ['size'] },
  RefreshIcon: { template: '<svg />', props: ['size', 'spinning'] },
  CogIcon: { template: '<svg />', props: ['size'] },
  UserPlusIcon: { template: '<svg />', props: ['size'] },
  UserIcon: { template: '<svg />', props: ['size'] },
  FileIcon: { template: '<svg />', props: ['size'] },
  DownloadIcon: { template: '<svg />', props: ['size'] },
}))

const AppLayoutStub = { template: '<main><slot /></main>' }
const ActivityStatsCardsStub = { template: '<section />', props: ['overview', 'loading'] }
const ActivityFilterPillsStub = { template: '<section />', props: ['filters', 'dateRange', 'customDateRange', 'users'] }
const ActivityPaginationStub = { template: '<nav />', props: ['currentPage', 'totalPages', 'totalRecords', 'loading'] }
const ActivityEmptyStateStub = { template: '<section class="empty-state-stub" />', props: ['variant'] }
const ActivityTimelineStub = {
  template: '<button class="timeline-stub" @click="$emit(\'restored\', 5)" />',
  props: ['activities'],
  emits: ['restored'],
}

function mountView() {
  return mount(ActivityLog, {
    global: {
      stubs: {
        AppLayout: AppLayoutStub,
        ActivityStatsCards: ActivityStatsCardsStub,
        ActivityFilterPills: ActivityFilterPillsStub,
        ActivityTimeline: ActivityTimelineStub,
        ActivityPagination: ActivityPaginationStub,
        ActivityEmptyState: ActivityEmptyStateStub,
      },
    },
  })
}

describe('ActivityLog restore refresh integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(activitiesApi.list).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 5,
            userId: 'agent-1',
            userName: 'Alice',
            userRole: 'agent',
            action: 'tag_delete',
            resourceType: 'tag',
            createdAt: '2026-05-26T10:00:00.000Z',
          },
        ],
        page: 2,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      },
    } as Awaited<ReturnType<typeof activitiesApi.list>>)
    vi.mocked(activitiesApi.getOverview).mockResolvedValue({ success: true, data: null } as never)
    vi.mocked(apiClient.get).mockResolvedValue({ success: true, data: [] } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads the current page when the timeline emits restored', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.timeline-stub').trigger('click')
    await flushPromises()

    expect(activitiesApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 50 }),
    )
  })

  it('subscribes to activity channel and reloads on resource.restored websocket messages', async () => {
    const ws = useWebSocketStore()
    const subscribeSpy = vi.spyOn(ws, 'subscribe')
    const unsubscribeSpy = vi.spyOn(ws, 'unsubscribe')
    const wrapper = mountView()
    await flushPromises()

    expect(subscribeSpy).toHaveBeenCalledWith('activity', expect.any(Function))
    const handler = subscribeSpy.mock.calls[0]?.[1]

    handler?.({ type: 'resource.restored' })
    await flushPromises()

    expect(activitiesApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 50 }),
    )

    wrapper.unmount()
    expect(unsubscribeSpy).toHaveBeenCalled()
  })
})
