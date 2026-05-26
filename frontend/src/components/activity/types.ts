import type { Component } from 'vue'
import type { ActivityLog } from '@/api/activities'

/** Date-grouped activities for timeline rendering */
export interface ActivityDateGroup {
  label: string
  date: string
  activities: ActivityLog[]
}

/** Icon style mapping for each action category */
export interface ActionIconStyle {
  bgClass: string
  colorClass: string
  icon: Component
}

/** Formatted detail entry for the detail panel */
export interface DetailEntry {
  key: string
  value: string
  oldValue?: string
  type?: 'default' | 'old-value' | 'new-value' | 'diff'
}

/** Stats card data */
export interface StatCardData {
  label: string
  value: string | number
  subtitle: string
  bgClass: string
  colorStyle: string
  icon: Component
}

/** Per-record restore policy attached to reversible activity log details */
export interface RestorePolicy {
  expiresAt: string
  requiresAdmin: boolean
}

/** Reversible activity log details present on records emitted by restore-aware handlers */
export interface RestoreDetails {
  reversible: true
  restoreHandler: string
  previousState: Record<string, unknown>
  newState: Record<string, unknown>
  restorePolicy: RestorePolicy
  restoredByActivityId: number | null
}

/** Irreversible activity log details for records that cannot be restored */
export interface IrreversibleDetails {
  reversible: false
  irreversibleReason: string
}

/** A single field-level mid-change reported by the 409 RESTORE_CONFLICT payload */
export interface MidChange {
  field: string
  valueAtOriginalAction: unknown
  valueNow: unknown
  valueAfterRestore: unknown
}

/** Possible restore button states */
export type RestoreState =
  | { kind: 'eligible'; expiresAt: string; requiresAdmin: boolean }
  | { kind: 'expired' }
  | { kind: 'irreversible'; reason: string }
  | { kind: 'already-restored'; byActivityId: number }
  | { kind: 'in-progress' }
  | { kind: 'hidden' }
