// Barrel export for conversations sub-modules
// The main store is at ../conversations.ts — this directory contains internal sub-modules

export { hasConversationChanged, computeStatsFromConversations } from './helpers'
export { createRealtimeHandler } from './realtimeHandler'
export { createAssignmentActions } from './assignmentActions'
export { createBackgroundSync } from './backgroundSync'
export { createCacheStrategy } from './cacheStrategy'

export type { SyncStatus, TransferredConversationState, ReceivedConversationState, ConversationStats, LiffConversation } from './types'
export type { RealtimeHandlerDeps } from './realtimeHandler'
export type { AssignmentActionsDeps } from './assignmentActions'
export type { BackgroundSyncDeps } from './backgroundSync'
export type { CacheStrategyDeps } from './cacheStrategy'
