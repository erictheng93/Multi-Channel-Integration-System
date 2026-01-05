// Dashboard UI Components Export
// Centralized export point for all dashboard components

export { default as WelcomeSection } from './WelcomeSection.vue'
export { default as StatCard } from './StatCard.vue'
export { default as StatsGrid } from './StatsGrid.vue'
export { default as RecentConversationsCard } from './RecentConversationsCard.vue'
export { default as ActivityFeedCard } from './ActivityFeedCard.vue'
export { default as PerformanceCard } from './PerformanceCard.vue'
export { default as PerformanceMetrics } from './PerformanceMetrics.vue'

// Re-export prop types for convenience
export type { WelcomeSectionProps } from './WelcomeSection.vue'
export type { StatCardProps } from './StatCard.vue'
export type { RecentConversationsCardProps } from './RecentConversationsCard.vue'
export type { Activity, ActivityFeedCardProps } from './ActivityFeedCard.vue'
export type { PerformanceCardProps } from './PerformanceCard.vue'
export type { PerformanceMetricsProps } from './PerformanceMetrics.vue'
