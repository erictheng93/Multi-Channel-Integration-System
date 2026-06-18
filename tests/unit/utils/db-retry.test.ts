import { describe, expect, it, vi } from 'vitest'
import { withD1Retry } from '@/utils/db-retry'

describe('withD1Retry', () => {
  const noSleep = () => Promise.resolve()

  it('returns the result when the operation succeeds on the first try', async () => {
    const op = vi.fn().mockResolvedValue('ok')
    const result = await withD1Retry(op, { sleep: noSleep })
    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries a transient D1 failure and returns the eventual success', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed query: select ... from "agents"'))
      .mockResolvedValueOnce('recovered')

    const result = await withD1Retry(op, { sleep: noSleep })

    expect(result).toBe('recovered')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('throws the last error after exhausting all retries', async () => {
    const op = vi.fn().mockRejectedValue(new Error('persistent D1 failure'))

    await expect(withD1Retry(op, { retries: 2, sleep: noSleep })).rejects.toThrow(
      'persistent D1 failure'
    )
    // 1 initial attempt + 2 retries
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('preserves undefined results (e.g. a .get() that found no row)', async () => {
    const op = vi.fn().mockResolvedValue(undefined)
    const result = await withD1Retry(op, { sleep: noSleep })
    expect(result).toBeUndefined()
    expect(op).toHaveBeenCalledTimes(1)
  })
})
