import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, ref, nextTick } from 'vue'

const fetchMock = vi.fn()
vi.mock('@/api/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => fetchMock(...args),
}))
vi.mock('@/config/runtime', () => ({ getApiUrl: (p: string) => `http://api${p}` }))

import { useReplyWindow } from './useReplyWindow'

const windowResponse = (available: boolean, expiresAt: number | null) => ({
  ok: true,
  json: async () => ({ success: true, data: { available, expiresAt } }),
})

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0)
  await nextTick()
}

describe('useReplyWindow', () => {
  let scope: ReturnType<typeof effectScope>
  const conversationId = ref('c1')
  const enabled = ref(true)

  const setup = () => {
    scope = effectScope()
    return scope.run(() => useReplyWindow({
      conversationId: () => conversationId.value,
      enabled: () => enabled.value,
    }))!
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    fetchMock.mockReset()
    conversationId.value = 'c1'
    enabled.value = true
  })
  afterEach(() => {
    scope?.stop()
    vi.useRealTimers()
  })

  it('counts down every second and hides at expiry', async () => {
    fetchMock.mockResolvedValue(windowResponse(true, Date.now() + 3000))
    const w = setup()
    await flush()
    expect(w.visible.value).toBe(true)
    expect(w.secondsLeft.value).toBe(3)
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api/api/customer-conversations/c1/reply-window')

    await vi.advanceTimersByTimeAsync(1000)
    expect(w.secondsLeft.value).toBe(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.visible.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stays hidden when not available', async () => {
    fetchMock.mockResolvedValue(windowResponse(false, null))
    const w = setup()
    await flush()
    expect(w.visible.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('hides on fetch error and on non-ok response', async () => {
    fetchMock.mockRejectedValue(new Error('net'))
    const w = setup()
    await flush()
    expect(w.visible.value).toBe(false)

    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    await w.refresh()
    expect(w.visible.value).toBe(false)
  })

  it('refresh refetches and a used token hides the indicator', async () => {
    fetchMock.mockResolvedValueOnce(windowResponse(true, Date.now() + 30000))
    const w = setup()
    await flush()
    expect(w.visible.value).toBe(true)

    fetchMock.mockResolvedValueOnce(windowResponse(false, null))
    await w.refresh()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(w.visible.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('hide() clears the indicator without a fetch and drops an in-flight refresh', async () => {
    fetchMock.mockResolvedValueOnce(windowResponse(true, Date.now() + 30000))
    const w = setup()
    await flush()
    expect(w.visible.value).toBe(true)

    fetchMock.mockResolvedValueOnce(windowResponse(true, Date.now() + 30000))
    const inFlight = w.refresh()
    w.hide()
    await inFlight
    expect(w.visible.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('refetches on conversation change and clears the interval on scope stop', async () => {
    fetchMock.mockResolvedValue(windowResponse(true, Date.now() + 30000))
    const w = setup()
    await flush()
    conversationId.value = 'c2'
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]![0]).toContain('/c2/')
    expect(w.visible.value).toBe(true)

    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not fetch for non-LINE conversations', async () => {
    enabled.value = false
    const w = setup()
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.visible.value).toBe(false)
  })
})
