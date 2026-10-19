import { afterEach, describe, expect, it, vi } from 'vitest'
import { BatchQueueManager } from '@/modules/websocket/services/batch-queue-manager'

/**
 * BatchQueueManager is constructed inside Durable Objects (through
 * WebSocketBroadcastService). A pending setTimeout keeps a DO resident and bills
 * duration, so an idle manager must hold no timer at all.
 */
describe('BatchQueueManager timers', () => {
  afterEach(() => vi.useRealTimers())

  it('holds no pending timer after construction', () => {
    vi.useFakeTimers()
    const manager = new BatchQueueManager({ enabled: true })
    expect(vi.getTimerCount()).toBe(0)
    manager.destroy()
  })

  it('stays timer-free across an hour of idleness', async () => {
    vi.useFakeTimers()
    const manager = new BatchQueueManager({ enabled: true })
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000)
    expect(vi.getTimerCount()).toBe(0)
    manager.destroy()
  })
})
