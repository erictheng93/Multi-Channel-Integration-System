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
  type?: 'default' | 'old-value' | 'new-value'
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
