// Composables index file
export { useAuth } from './useAuth'
export { useError } from './useError'
export { useModernVue, useModernForm } from './useModernVue'
export { useAsyncData, useApi, useAsyncList } from './useAsyncData'
export { useLocalStorage, useLocalStorageObject, useLocalStorageArray } from './useLocalStorage'
export { useDebounce, useDebouncedFunction } from './useDebounce'
export { useNotification } from './useNotification'
export { useFilter } from './useFilter'
export { useSort } from './useSort'
export { useSearch, useAdvancedSearch } from './useSearch'
export { useConversations } from './useConversations'
export { useMessages } from './useMessages'
export { useTeam } from './useTeam'
export { useSystem } from './useSystem'
export { useDelayedMessage } from './useDelayedMessage'
export { useTokenRefresh } from './useTokenRefresh'
export { useActivityTracker } from './useActivityTracker'
// REMOVED: useActivityStream (SSE-based, Phase 1 cleanup)
// export { useActivityStream } from './useActivityStream'
export { useDelayedMessages } from './useDelayedMessages'
export { useFileUpload } from './useFileUpload'
export { useAccountStatusMonitor } from './useAccountStatusMonitor'
export { usePrefetch } from './usePrefetch'

// Note: P1-2 composables (useConversationActions, useMessageEventHandlers) removed
// These can be re-added when integration with existing types is completed