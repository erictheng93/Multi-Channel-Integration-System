import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBroadcastsStore } from '@/stores/broadcasts'
import { previewBroadcastAudience } from '@/api/broadcasts'

vi.mock('@/api/broadcasts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/broadcasts')>()
  return {
    ...actual,
    previewBroadcastAudience: vi.fn()
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

    let resolveFirst: (value: typeof firstPreview) => void = () => {}
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
})
