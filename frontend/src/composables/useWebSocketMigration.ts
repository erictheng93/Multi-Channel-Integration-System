// Progressive WebSocket Migration Feature Flag Composable
// Project: Multi-Channel Support MVP
// Created by: WebSocket Migration Developer

import { ref, computed, watch, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWebSocket } from './useWebSocket'

export type MigrationStrategy = 'sse_only' | 'websocket_primary' | 'websocket_only' | 'a_b_test'

export interface MigrationConfig {
  strategy: MigrationStrategy
  fallbackToSSE: boolean
  enableABTesting: boolean
  rolloutPercentage: number
  userGroups: string[]
  featureFlags: Record<string, boolean>
}

export interface MigrationStatus {
  isWebSocketEnabled: boolean
  isSSEEnabled: boolean
  currentProtocol: 'websocket' | 'sse' | 'hybrid'
  fallbackReason?: string
  migrationGroup?: 'websocket' | 'sse' | 'control'
}

// Default configuration
const DEFAULT_CONFIG: MigrationConfig = {
  strategy: 'websocket_primary',
  fallbackToSSE: true,
   
  enableABTesting: false,
  rolloutPercentage: 50,
  userGroups: [],
  featureFlags: {
    websocketConversations: true,
    websocketPresence: true,
    websocketTyping: true,
    websocketNotifications: true
  }
}
   

export function useWebSocketMigration(customConfig?: Partial<MigrationConfig>) {
  const authStore = useAuthStore()
  const webSocket = useWebSocket({ autoConnect: false })

  // Configuration
  const config = ref<MigrationConfig>({ ...DEFAULT_CONFIG, ...customConfig })

  // Migration state
  const migrationStatus = ref<MigrationStatus>({
    isWebSocketEnabled: false,
    isSSEEnabled: true,
    currentProtocol: 'sse'
  })

  // User assignment for A/B testing
  const userMigrationGroup = ref<'websocket' | 'sse' | 'control'>('control')
  const isUserInWebSocketGroup = ref(false)

  // Feature flags
  const featureFlags = computed(() => config.value.featureFlags)

  // Migration decision logic
  const shouldUseWebSocket = computed((): boolean => {
    const strategy = config.value.strategy

    switch (strategy) {
      case 'sse_only':
        return false

      case 'websocket_only':
        return true

      case 'websocket_primary':
        return evaluateWebSocketPrimary()

      case 'a_b_test':
        return evaluateABTest()

      default:
        return false
    }
  })

  const shouldFallbackToSSE = computed((): boolean => {
    if (!config.value.fallbackToSSE) { return false }

    // Fallback conditions
    const conditions = [
      !webSocket.isConnected.value && webSocket.connectionAttempts.value > 3,
      webSocket.connectionState.value === 'error',
      webSocket.lastConnectionError.value !== null
    ]

    return conditions.some(condition => condition)
  })

  const currentProtocol = computed((): 'websocket' | 'sse' | 'hybrid' => {
    if (shouldUseWebSocket.value && !shouldFallbackToSSE.value) {
      return 'websocket'
    } else if (!shouldUseWebSocket.value || shouldFallbackToSSE.value) {
      return 'sse'
    } else {
      return 'hybrid'
    }
  })

  // Methods
  const evaluateWebSocketPrimary = (): boolean => {
    // Check if user is in rollout percentage
    if (!isUserInRollout()) { return false }

    // Check if user agent supports WebSocket
    if (!isWebSocketSupported()) { return false }

    // Check user groups
    if (config.value.userGroups.length > 0 && authStore.currentAgent) {
      const userRole = authStore.currentAgent.role
      if (!config.value.userGroups.includes(userRole)) { return false }
    }

    return true
   
  }

   
  const evaluateABTest = (): boolean => {
    if (!config.value.enableABTesting) { return false }

    // Assign user to test group if not already assigned
    if (userMigrationGroup.value === 'control') {
      assignUserToTestGroup()
    }

    return userMigrationGroup.value === 'websocket'
  }

  const isUserInRollout = (): boolean => {
    if (!authStore.currentAgent) { return false }

    // Simple hash-based rollout using user ID
    const userId = authStore.currentAgent.id
    const hash = simpleHash(userId)
    const percentage = (hash % 100) + 1

    return percentage <= config.value.rolloutPercentage
  }

  const isWebSocketSupported = (): boolean => {
    return typeof globalThis.WebSocket !== 'undefined' && globalThis.WebSocket.CLOSING !== undefined
  }

  const assignUserToTestGroup = (): void => {
    if (!authStore.currentAgent) { return }

    const userId = authStore.currentAgent.id
    const hash = simpleHash(userId)

    // Split users 50/50 between websocket and sse groups
    userMigrationGroup.value = (hash % 2) === 0 ? 'websocket' : 'sse'
    isUserInWebSocketGroup.value = userMigrationGroup.value === 'websocket'

    console.log(`[Migration] User ${userId} assigned to group: ${userMigrationGroup.value}`)
  }

  const updateMigrationStatus = (): void => {
    const newStatus: MigrationStatus = {
      isWebSocketEnabled: shouldUseWebSocket.value,
      isSSEEnabled: !shouldUseWebSocket.value || shouldFallbackToSSE.value,
      currentProtocol: currentProtocol.value,
      migrationGroup: userMigrationGroup.value
    }

    if (shouldFallbackToSSE.value) {
      newStatus.fallbackReason = 'WebSocket connection failed'
    }

    migrationStatus.value = newStatus

    console.log('[Migration] Status updated:', newStatus)
  }

  const forceWebSocket = (): void => {
    config.value.strategy = 'websocket_only'
    updateMigrationStatus()
  }

  const forceSSE = (): void => {
    config.value.strategy = 'sse_only'
    updateMigrationStatus()
  }

  const resetToDefault = (): void => {
    config.value = { ...DEFAULT_CONFIG, ...customConfig }
    updateMigrationStatus()
  }

  const enableFeature = (feature: string): void => {
    config.value.featureFlags[feature] = true
  }

  const disableFeature = (feature: string): void => {
    config.value.featureFlags[feature] = false
  }

  const isFeatureEnabled = (feature: string): boolean => {
    return config.value.featureFlags[feature] === true
  }

  // A/B testing utilities
  const getTestingMetrics = () => {
    return {
      group: userMigrationGroup.value,
      strategy: config.value.strategy,
      rolloutPercentage: config.value.rolloutPercentage,
      websocketConnected: webSocket.isConnected.value,
      connectionAttempts: webSocket.connectionAttempts.value,
      currentProtocol: currentProtocol.value
    }
  }

  const reportMetric = (event: string, data?: unknown) => {
    const metric = {
      event,
      data,
      group: userMigrationGroup.value,
      protocol: currentProtocol.value,
      timestamp: Date.now(),
      userId: authStore.currentAgent?.id
    }

    console.log('[Migration Metric]', metric)

    // In a real implementation, this would send to analytics
    // analytics.track('websocket_migration', metric)
  }

  // Environment-based defaults
  const applyEnvironmentDefaults = (): void => {
    if (import.meta.env.DEV) {
      // Development: Enable WebSocket for testing
      config.value.strategy = 'websocket_primary'
      config.value.rolloutPercentage = 100
    } else if (import.meta.env.PROD) {
      // Production: Conservative rollout
      config.value.strategy = 'websocket_primary'
      config.value.rolloutPercentage = 25
    }
  }

  // Watch for auth changes and update migration status
  watch(
    () => authStore.currentAgent,
    () => {
      if (authStore.currentAgent) {
        updateMigrationStatus()
      }
    },
    { immediate: true }
  )

  // Watch WebSocket connection state
  watch(
    () => webSocket.connectionState.value,
    () => {
      updateMigrationStatus()
    }
  )

  // Initialize
  applyEnvironmentDefaults()
  updateMigrationStatus()

  return {
    // Configuration
    config: readonly(config),
    featureFlags: readonly(featureFlags),

    // Status
    migrationStatus: readonly(migrationStatus),
    shouldUseWebSocket: readonly(shouldUseWebSocket),
    shouldFallbackToSSE: readonly(shouldFallbackToSSE),
    currentProtocol: readonly(currentProtocol),
    userMigrationGroup: readonly(userMigrationGroup),
    isUserInWebSocketGroup: readonly(isUserInWebSocketGroup),

    // Methods
    forceWebSocket,
    forceSSE,
    resetToDefault,
    enableFeature,
    disableFeature,
    isFeatureEnabled,
    updateMigrationStatus,

    // Testing utilities
    getTestingMetrics,
    reportMetric,

    // Convenience flags for features
    useWebSocketForConversations: computed(() =>
      shouldUseWebSocket.value && isFeatureEnabled('websocketConversations')
    ),
    useWebSocketForPresence: computed(() =>
      shouldUseWebSocket.value && isFeatureEnabled('websocketPresence')
    ),
    useWebSocketForTyping: computed(() =>
      shouldUseWebSocket.value && isFeatureEnabled('websocketTyping')
    ),
    useWebSocketForNotifications: computed(() =>
      shouldUseWebSocket.value && isFeatureEnabled('websocketNotifications')
    )
  }
}

// Utility functions
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Helper function to make refs readonly
function readonly<T>(ref: Ref<T>): Readonly<Ref<T>> {
  return ref as Readonly<Ref<T>>
}