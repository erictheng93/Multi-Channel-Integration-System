import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { ActivityLog } from '@/api/activities'
import { useAuthStore } from '@/stores/auth'

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

const restoreFlag = vi.hoisted(() => ({ enabled: true }))
const restoreMock = vi.hoisted(() => ({
  isRestoring: undefined as unknown as ReturnType<typeof ref<boolean>>,
  isOptimisticallyRestored: vi.fn(() => false),
  attemptRestore: vi.fn(),
}))

vi.mock('@/config/runtime', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    isActivityRestoreEnabled: () => restoreFlag.enabled,
  }
})

vi.mock('@/composables/useRestoreActivity', () => ({
  useRestoreActivity: () => restoreMock,
}))

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

function setCurrentAgent(id = 'user-1', role = 'agent') {
  const auth = useAuthStore()
  auth.currentAgent = {
    id,
    email: `${id}@example.test`,
    name: id,
    displayName: id,
    role: role as 'admin' | 'agent',
    isActive: true,
    createdAt: Date.now(),
  } as ReturnType<typeof useAuthStore>['currentAgent']
}

function makeReversibleActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return makeActivity({
    id: 5,
    userId: 'agent-1',
    userName: 'Alice',
    userRole: 'agent',
    action: 'tag_delete',
    resourceType: 'tag',
    resourceId: '42',
    createdAt: '2026-03-20T11:55:00Z',
    details: {
      reversible: true,
      restoreHandler: 'tag.delete',
      previousState: { id: 42 },
      newState: { id: 42, deleted_at: '2026-03-20T11:55:00Z' },
      restorePolicy: {
        expiresAt: '2026-03-20T13:00:00.000Z',
        requiresAdmin: false,
      },
      restoredByActivityId: null,
    },
    ...overrides,
  })
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
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime('2026-03-20T12:00:00Z')
    restoreFlag.enabled = true
    restoreMock.isRestoring = ref(false)
    restoreMock.isOptimisticallyRestored.mockReturnValue(false)
    restoreMock.attemptRestore.mockReset()
    setCurrentAgent('user-1', 'agent')
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
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

  it('shows restore button when activity is reversible and caller is original actor', () => {
    setCurrentAgent('agent-1', 'agent')

    const wrapper = mountItem(makeReversibleActivity())

    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="restore-button"]').text()).toContain('還原')
  })

  it('shows expired indicator when restorePolicy.expiresAt is in the past', () => {
    setCurrentAgent('agent-1', 'agent')
    const wrapper = mountItem(
      makeReversibleActivity({
        details: {
          reversible: true,
          restoreHandler: 'tag.delete',
          previousState: {},
          newState: {},
          restorePolicy: { expiresAt: '2026-03-20T11:59:59.000Z', requiresAdmin: false },
          restoredByActivityId: null,
        },
      }),
    )

    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="restore-expired"]').text()).toContain('已過期')
  })

  it('shows irreversible indicator when activity.details.reversible is false', () => {
    const wrapper = mountItem(
      makeReversibleActivity({
        details: { reversible: false, irreversibleReason: 'message_sent' },
      }),
    )

    expect(wrapper.find('[data-test="restore-irreversible"]').text()).toContain('不可還原')
  })

  it('hides button when caller is neither original actor nor admin', () => {
    setCurrentAgent('agent-other', 'agent')

    const wrapper = mountItem(makeReversibleActivity())

    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(false)
  })

  it('shows button for admin even when not original actor', () => {
    setCurrentAgent('admin-1', 'admin')

    const wrapper = mountItem(makeReversibleActivity())

    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(true)
  })

  it('hides restore status zone when feature flag is off', () => {
    restoreFlag.enabled = false
    setCurrentAgent('agent-1', 'agent')

    const wrapper = mountItem(makeReversibleActivity())

    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="restore-expired"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="restore-irreversible"]').exists()).toBe(false)
  })

  it('opens modal and emits restored on successful confirm', async () => {
    setCurrentAgent('agent-1', 'agent')
    restoreMock.attemptRestore.mockResolvedValueOnce({
      kind: 'success',
      restoredByActivityId: 99,
    })
    const wrapper = mountItem(makeReversibleActivity())

    await wrapper.find('[data-test="restore-button"]').trigger('click')
    await nextTick()
    expect(wrapper.findComponent({ name: 'RestoreConfirmModal' }).props('open')).toBe(true)

    await wrapper.findComponent({ name: 'RestoreConfirmModal' }).vm.$emit('confirm', { force: false })
    await nextTick()
    await flushPromises()

    expect(restoreMock.attemptRestore).toHaveBeenCalledWith(5, false)
    expect(wrapper.emitted('restored')?.[0]).toEqual([5])
  })

  it('keeps modal open with conflict changes when restore reports conflict', async () => {
    setCurrentAgent('agent-1', 'agent')
    restoreMock.attemptRestore.mockResolvedValueOnce({
      kind: 'conflict',
      midChanges: [
        { field: 'name', valueAtOriginalAction: 'A', valueNow: 'B', valueAfterRestore: 'A' },
      ],
    })
    const wrapper = mountItem(makeReversibleActivity())

    await wrapper.find('[data-test="restore-button"]').trigger('click')
    await nextTick()
    await wrapper.findComponent({ name: 'RestoreConfirmModal' }).vm.$emit('confirm', { force: false })
    await nextTick()

    const modal = wrapper.findComponent({ name: 'RestoreConfirmModal' })
    expect(modal.props('open')).toBe(true)
    expect(modal.props('midChanges')).toHaveLength(1)
  })
})
