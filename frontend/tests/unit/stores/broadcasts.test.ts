import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBroadcastsStore } from '@/stores/broadcasts'
import { createBroadcast, previewBroadcastAudience, sendBroadcast } from '@/api/broadcasts'
import type * as BroadcastsApi from '@/api/broadcasts'

vi.mock('@/api/broadcasts', async (importOriginal) => {
  const actual = await importOriginal<typeof BroadcastsApi>()
  return {
    ...actual,
    previewBroadcastAudience: vi.fn(),
    createBroadcast: vi.fn(),
    sendBroadcast: vi.fn(),
    getBroadcast: vi.fn(),
    listBroadcasts: vi.fn()
  }
})

describe('useBroadcastsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('keeps only the latest preview response in state', async () => {
    const firstPreview = {
      total: 1,
      byPlatform: { line: 1, facebook: 0 },
      sendable: 1,
      skipped: []
    }
    const secondPreview = {
      total: 2,
      byPlatform: { line: 2, facebook: 0 },
      sendable: 2,
      skipped: []
    }

    let resolveFirst: (_value: typeof firstPreview) => void = () => {}
    vi.mocked(previewBroadcastAudience)
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFirst = resolve
      }))
      .mockResolvedValueOnce(secondPreview)

    const store = useBroadcastsStore()
    const firstRequest = store.fetchPreview({ tagIds: [1] })
    await store.fetchPreview({ tagIds: [2] })
    resolveFirst(firstPreview)
    await firstRequest

    expect(store.preview).toEqual(secondPreview)
    expect(store.previewTagId).toBe(2)
  })

  // The compose card keeps its uploads alive only after onCreated, so it must fire exactly
  // when a broadcast exists: after create succeeds (even if send then fails), never before.
  it('acknowledges creation only once the broadcast exists', async () => {
    const input = { title: 't', content: 'c', tagIds: [1], attachments: [] }
    const store = useBroadcastsStore()

    vi.mocked(createBroadcast).mockRejectedValueOnce(new Error('create failed'))
    const notCreated = vi.fn()
    await expect(store.createAndSend(input, notCreated)).rejects.toThrow('create failed')
    expect(notCreated).not.toHaveBeenCalled()

    vi.mocked(createBroadcast).mockResolvedValueOnce({ id: 'b1' } as never)
    vi.mocked(sendBroadcast).mockRejectedValueOnce(new Error('send failed'))
    const created = vi.fn()
    await expect(store.createAndSend(input, created)).rejects.toThrow('send failed')
    expect(created).toHaveBeenCalledOnce()
  })
})
