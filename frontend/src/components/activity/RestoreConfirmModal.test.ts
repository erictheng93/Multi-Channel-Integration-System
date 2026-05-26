import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RestoreConfirmModal from '@/components/activity/RestoreConfirmModal.vue'
import type { ActivityLog } from '@/api/activities'
import type { MidChange } from '@/components/activity/types'

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 5,
    userId: 'a1',
    userName: 'Alice',
    userRole: 'admin',
    action: 'tag_delete',
    resourceType: 'tag',
    resourceId: '42',
    createdAt: '2026-05-26T10:00:00.000Z',
    ...overrides,
  } as ActivityLog
}

const midChanges: MidChange[] = [
  {
    field: 'name',
    valueAtOriginalAction: 'Old',
    valueNow: 'Current',
    valueAfterRestore: 'Old',
  },
]

describe('RestoreConfirmModal', () => {
  function mountModal(props: InstanceType<typeof RestoreConfirmModal>['$props']) {
    return mount(RestoreConfirmModal, {
      attachTo: document.body,
      props,
    })
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing when closed', () => {
    const wrapper = mountModal({
      open: false,
      activity: makeActivity(),
      midChanges: null,
      loading: false,
    })

    expect(wrapper.text()).toBe('')
  })

  it('renders simple confirmation when there is no conflict', () => {
    mountModal({
      open: true,
      activity: makeActivity(),
      midChanges: null,
      loading: false,
    })

    expect(document.body.textContent).toContain('確認還原')
    expect(document.body.textContent).not.toContain('衝突')
    expect(document.body.querySelector('[data-test="restore-confirm"]')?.textContent).toContain(
      '確認還原',
    )
    expect(document.body.querySelector('[data-test="restore-force"]')).toBeNull()
  })

  it('emits confirm event without force when user clicks confirm', async () => {
    const wrapper = mountModal({
      open: true,
      activity: makeActivity(),
      midChanges: null,
      loading: false,
    })

    document.querySelector<HTMLButtonElement>('[data-test="restore-confirm"]')?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ force: false }])
  })

  it('emits cancel when user clicks cancel', async () => {
    const wrapper = mountModal({
      open: true,
      activity: makeActivity(),
      midChanges: null,
      loading: false,
    })

    document.querySelector<HTMLButtonElement>('[data-test="restore-cancel"]')?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('renders conflict diff table when midChanges are present', () => {
    mountModal({
      open: true,
      activity: makeActivity(),
      midChanges,
      loading: false,
    })

    expect(document.body.textContent).toContain('還原衝突')
    expect(document.body.textContent).toContain('原始值')
    expect(document.body.textContent).toContain('目前值')
    expect(document.body.textContent).toContain('還原後')
    expect(document.body.querySelector('[data-test="restore-force"]')).toBeTruthy()
  })

  it('emits confirm with force=true when user clicks force restore', async () => {
    const wrapper = mountModal({
      open: true,
      activity: makeActivity(),
      midChanges,
      loading: false,
    })

    document.querySelector<HTMLButtonElement>('[data-test="restore-force"]')?.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ force: true }])
  })

  it('disables actions while loading', () => {
    mountModal({
      open: true,
      activity: makeActivity(),
      midChanges: null,
      loading: true,
    })

    expect(document.querySelector<HTMLButtonElement>('[data-test="restore-confirm"]')?.disabled).toBe(
      true,
    )
    expect(document.querySelector<HTMLButtonElement>('[data-test="restore-cancel"]')?.disabled).toBe(
      true,
    )
  })
})
