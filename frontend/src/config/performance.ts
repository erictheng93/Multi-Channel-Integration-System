// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/config/performance.ts
// Created by: Performance Optimization Developer

export const PERFORMANCE_CONFIG = {
  // Cache settings
  cache: {
    conversations: {
      ttl: 2 * 60 * 1000, // 2 minutes
      maxSize: 100
    },
    messages: {
      ttl: 30 * 1000, // 30 seconds
      maxSize: 200
    },
    users: {
      ttl: 10 * 60 * 1000, // 10 minutes
      maxSize: 50
    }
  },
  
  // Retry settings
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    backoff: 'exponential' as const,
    jitter: true
  },
  
  // Polling settings
  polling: {
    baseInterval: 3000, // 3 seconds
    maxInterval: 30000, // 30 seconds
    backoffMultiplier: 1.5,
    enableAdaptive: true
  },
  
  // Virtual scrolling settings
  virtualScroll: {
    itemHeight: 120, // Height of conversation card
    overscan: 5, // Number of items to render outside viewport
    containerHeight: 600 // Default container height
  },
  
  // Debounce settings
  debounce: {
    search: 300,
    typing: 1000,
    resize: 150
  },
  
  // Performance monitoring
  monitoring: {
    enabled: import.meta.env.DEV,
    logInterval: 30000, // Log metrics every 30 seconds
    trackWebVitals: true
  },
  
  // Memory management
  memory: {
    maxConversations: 100,
    maxMessages: 500,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    gcThreshold: 0.8 // Trigger cleanup at 80% capacity
  }
} as const

// Environment-specific overrides
if (import.meta.env.PROD) {
  // Production optimizations
  Object.assign(PERFORMANCE_CONFIG.cache.conversations, { ttl: 5 * 60 * 1000 }) // 5 minutes
  Object.assign(PERFORMANCE_CONFIG.polling, { baseInterval: 5000 }) // 5 seconds
  Object.assign(PERFORMANCE_CONFIG.monitoring, { enabled: false })
}

export type PerformanceConfig = typeof PERFORMANCE_CONFIG