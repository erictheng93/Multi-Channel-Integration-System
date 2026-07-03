import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BroadcastDetailModal from '@/components/broadcast/BroadcastDetailModal.vue'
import BroadcastHistoryList from '@/components/broadcast/BroadcastHistoryList.vue'
import type { BroadcastRecord, BroadcastRecipientListResult } from '@/api/broadcasts'

const broadcast: BroadcastRecord = {
  id: 'broadcast-1',
  title: 'Campaign',
  contentType: 'text',
  content: 'Hello',
  tagIds: [1],
  matchMode: 'any',
  status: 'completed',
  totalRecipients: 25,
  sentCount: 20,
  failedCount: 3,
  skippedCount: 2,
  createdBy: 'agent-1',
  sentAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null
}

const recipients: BroadcastRecipientListResult = {
  items: [{
    id: 1,
    broadcastId: 'broadcast-1',
    customerId: 1,
    platform: 'line',
    platformUserId: 'U1',
    resolvedTeamId: 1,
    status: 'sent',
    errorReason: null,
    sentAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    customerDisplayName: 'Customer One',
    customerAvatarUrl: null
  }],
  page: 1,
  pageSize: 20,
  total: 25,
  totalPages: 2
}

describe('broadcast pagination controls', () => {
  it('emits history page changes', async () => {
    const wrapper = mount(BroadcastHistoryList, {
      props: {
        broadcasts: [broadcast],
        loading: false,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 25,
          totalPages: 2
        }
      }
    })

    await wrapper.find('[data-testid="history-next-page"]').trigger('click')

    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
  })

  it('emits recipient page changes', async () => {
    const wrapper = mount(BroadcastDetailModal, {
      props: {
        open: true,
        broadcast,
        recipients,
        modelValue: undefined
      }
    })

    await wrapper.find('[data-testid="recipients-next-page"]').trigger('click')

    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
  })
})
