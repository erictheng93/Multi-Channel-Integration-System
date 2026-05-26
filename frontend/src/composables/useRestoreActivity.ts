import { ref } from 'vue'
import { activitiesApi } from '@/api/activities'
import type { MidChange } from '@/components/activity/types'

export type RestoreOutcome =
  | { kind: 'success'; restoredByActivityId: number | undefined }
  | { kind: 'conflict'; midChanges: MidChange[] }
  | { kind: 'in-progress'; retryAfterMs: number }
  | { kind: 'already-restored'; byActivityId: number | undefined }
  | { kind: 'expired' }
  | { kind: 'not-reversible'; reason: string }
  | { kind: 'forbidden' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }

const optimisticRestoredIds = ref<Set<number>>(new Set())

function setOptimistic(activityId: number, restored: boolean) {
  const next = new Set(optimisticRestoredIds.value)
  if (restored) {
    next.add(activityId)
  } else {
    next.delete(activityId)
  }
  optimisticRestoredIds.value = next
}

export function useRestoreActivity() {
  const isRestoring = ref(false)

  function isOptimisticallyRestored(activityId: number): boolean {
    return optimisticRestoredIds.value.has(activityId)
  }

  async function attemptRestore(activityId: number, force = false): Promise<RestoreOutcome> {
    isRestoring.value = true
    setOptimistic(activityId, true)

    try {
      const result = await activitiesApi.restore(activityId, { force })

      if (result.success && result.status === 200) {
        return { kind: 'success', restoredByActivityId: result.data?.restoredByActivityId }
      }

      if (result.status === 401) {return { kind: 'unauthenticated' }}
      if (result.status === 403) {return { kind: 'forbidden' }}
      if (result.status === 410) {return { kind: 'expired' }}
      if (result.status === 422) {
        return { kind: 'not-reversible', reason: result.code ?? 'unknown' }
      }

      if (result.status === 409) {
        if (result.code === 'RESTORE_CONFLICT') {
          return { kind: 'conflict', midChanges: result.data?.midChanges ?? [] }
        }
        if (result.code === 'RESTORE_IN_PROGRESS') {
          return { kind: 'in-progress', retryAfterMs: result.data?.retryAfterMs ?? 2000 }
        }
        if (result.code === 'ALREADY_RESTORED') {
          return { kind: 'already-restored', byActivityId: result.data?.restoredByActivityId }
        }
      }

      return { kind: 'error', message: result.error ?? `HTTP ${result.status}` }
    } finally {
      isRestoring.value = false
    }
  }

  async function attemptRestoreWithRollback(
    activityId: number,
    force = false,
  ): Promise<RestoreOutcome> {
    const outcome = await attemptRestore(activityId, force)
    if (outcome.kind !== 'success') {
      setOptimistic(activityId, false)
    }
    return outcome
  }

  return {
    isRestoring,
    optimisticRestoredIds,
    isOptimisticallyRestored,
    attemptRestore: attemptRestoreWithRollback,
  }
}
