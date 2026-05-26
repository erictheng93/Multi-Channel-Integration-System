import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRestoreActivity } from '@/composables/useRestoreActivity'
import { activitiesApi } from '@/api/activities'

vi.mock('@/api/activities', () => ({
  activitiesApi: {
    restore: vi.fn(),
  },
}))

describe('useRestoreActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success on 200 and keeps the restored id optimistic until caller refreshes', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: true,
      status: 200,
      data: { restoredByActivityId: 1234 },
    })
    const { attemptRestore, isOptimisticallyRestored } = useRestoreActivity()

    const result = await attemptRestore(5)

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {expect(result.restoredByActivityId).toBe(1234)}
    expect(isOptimisticallyRestored(5)).toBe(true)
  })

  it('returns conflict on 409 RESTORE_CONFLICT and rolls back optimistic state', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false,
      status: 409,
      code: 'RESTORE_CONFLICT',
      data: {
        midChanges: [
          { field: 'name', valueAtOriginalAction: 'A', valueNow: 'B', valueAfterRestore: 'A' },
        ],
      },
    })
    const { attemptRestore, isOptimisticallyRestored } = useRestoreActivity()

    const result = await attemptRestore(5)

    expect(result.kind).toBe('conflict')
    if (result.kind === 'conflict') {expect(result.midChanges).toHaveLength(1)}
    expect(isOptimisticallyRestored(5)).toBe(false)
  })

  it('returns in-progress with retryAfterMs on 409 RESTORE_IN_PROGRESS', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false,
      status: 409,
      code: 'RESTORE_IN_PROGRESS',
      data: { retryAfterMs: 2000 },
    })
    const { attemptRestore } = useRestoreActivity()

    const result = await attemptRestore(5)

    expect(result.kind).toBe('in-progress')
    if (result.kind === 'in-progress') {expect(result.retryAfterMs).toBe(2000)}
  })

  it('returns already-restored on 409 ALREADY_RESTORED', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false,
      status: 409,
      code: 'ALREADY_RESTORED',
      data: { restoredByActivityId: 777 },
    })
    const { attemptRestore } = useRestoreActivity()

    const result = await attemptRestore(5)

    expect(result.kind).toBe('already-restored')
    if (result.kind === 'already-restored') {expect(result.byActivityId).toBe(777)}
  })

  it('returns expired on 410', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false,
      status: 410,
      code: 'RESTORE_EXPIRED',
    })
    const { attemptRestore } = useRestoreActivity()

    const result = await attemptRestore(5)

    expect(result.kind).toBe('expired')
  })

  it('returns not-reversible on 422', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false,
      status: 422,
      code: 'NOT_REVERSIBLE',
    })
    const { attemptRestore } = useRestoreActivity()

    const result = await attemptRestore(5)

    expect(result.kind).toBe('not-reversible')
  })

  it('returns error on network failure', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false,
      status: 0,
      error: 'Network error',
    })
    const { attemptRestore } = useRestoreActivity()

    const result = await attemptRestore(5)

    expect(result.kind).toBe('error')
  })

  it('isRestoring and optimistic state are true during the call', async () => {
    let resolveRestore: (_v: Awaited<ReturnType<typeof activitiesApi.restore>>) => void = () => {}
    vi.mocked(activitiesApi.restore).mockReturnValueOnce(
      new Promise((res) => {
        resolveRestore = res
      }) as ReturnType<typeof activitiesApi.restore>,
    )
    const { isRestoring, isOptimisticallyRestored, attemptRestore } = useRestoreActivity()

    const promise = attemptRestore(5)

    expect(isRestoring.value).toBe(true)
    expect(isOptimisticallyRestored(5)).toBe(true)
    resolveRestore({ success: true, status: 200, data: { restoredByActivityId: 1 } })
    await promise
    expect(isRestoring.value).toBe(false)
  })
})
