import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { activitiesApi, isReversibleDetails } from './activities'

const fetchMock = vi.fn()

vi.mock('@/config/runtime', () => ({
  getBackendUrl: () => 'https://api.example.test',
}))

describe('activitiesApi.restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => 'test-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('rejects invalid activity ids without calling fetch', async () => {
    const result = await activitiesApi.restore(0)

    expect(result).toEqual({ success: false, status: 400, error: 'Invalid activity id' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts force=false by default and returns normalized success data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        data: { restoredByActivityId: 123, restoredActivityId: 456 },
      }),
    })

    const result = await activitiesApi.restore(5)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/activities/5/restore',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: false }),
      }),
    )
    expect(result).toEqual({
      success: true,
      status: 200,
      code: undefined,
      data: { restoredByActivityId: 123, restoredActivityId: 456 },
      error: undefined,
    })
  })

  it('posts force=true and preserves conflict data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue({
        code: 'RESTORE_CONFLICT',
        error: 'Conflict',
        data: {
          midChanges: [
            { field: 'name', valueAtOriginalAction: 'A', valueNow: 'B', valueAfterRestore: 'A' },
          ],
        },
      }),
    })

    const result = await activitiesApi.restore(5, { force: true })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ force: true }) }),
    )
    expect(result.success).toBe(false)
    expect(result.status).toBe(409)
    expect(result.code).toBe('RESTORE_CONFLICT')
    expect(result.data?.midChanges).toHaveLength(1)
  })

  it('falls back to top-level restoredByActivityId and retryAfterMs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue({
        code: 'RESTORE_IN_PROGRESS',
        restoredByActivityId: 77,
        retryAfterMs: 1500,
      }),
    })

    const result = await activitiesApi.restore(9)

    expect(result.data).toEqual({ restoredByActivityId: 77, retryAfterMs: 1500 })
  })

  it('returns network error when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))

    const result = await activitiesApi.restore(5)

    expect(result).toEqual({ success: false, status: 0, error: 'Network error' })
  })
})

describe('isReversibleDetails', () => {
  it('returns true only for reversible restore detail objects', () => {
    expect(isReversibleDetails({ reversible: true })).toBe(true)
    expect(isReversibleDetails({ reversible: false })).toBe(false)
    expect(isReversibleDetails(null)).toBe(false)
  })
})
