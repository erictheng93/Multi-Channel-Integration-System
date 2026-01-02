/**
 * API Monitor Type Definitions
 *
 * Centralized type definitions for the API monitoring system
 * Extracted from ApiMonitor.vue for better type safety and reusability
 */

/**
 * API endpoint status types
 */
export type ApiStatus = 'healthy' | 'warning' | 'error'

/**
 * API endpoint category types
 */
export type ApiCategory = 'system' | 'auth' | 'conversation' | 'customer' | 'team' | 'message' | 'integration'

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'

/**
 * API endpoint interface
 * Represents a single API endpoint with its status and metrics
 */
export interface ApiEndpoint {
  /** Unique identifier for the endpoint */
  id: string

  /** API endpoint path (e.g., /api/system/health) */
  endpoint: string

  /** HTTP method */
  method: HttpMethod

  /** Endpoint category for filtering */
  category: ApiCategory

  /** Human-readable description */
  description: string

  /** Current health status */
  status: ApiStatus

  /** Latest response time in milliseconds */
  responseTime: number

  /** Average response time in milliseconds */
  avgResponseTime: number

  /** Success rate percentage (0-100) */
  successRate: number

  /** Total request count in last 24h */
  requestCount: number

  /** Total error count */
  errorCount: number

  /** Last health check timestamp */
  lastCheck: Date

  /** Error message if status is error */
  error?: string

  /** Error occurrence timestamp */
  errorTime?: Date

  /** Testing state (for UI) */
  testing?: boolean
}

/**
 * Filter state interface
 * Manages all filtering options for API endpoints
 */
export interface FilterState {
  /** Status filter: 'all' | 'healthy' | 'warning' | 'error' */
  status: 'all' | ApiStatus

  /** Category filter: 'all' | specific category */
  category: 'all' | ApiCategory

  /** Search query string */
  search: string
}

/**
 * Modal state interface
 * Manages the statistics detail modal
 */
export interface ModalState {
  /** Whether modal is visible */
  show: boolean

  /** Type of statistics being shown */
  type: 'all' | 'healthy' | 'warning' | 'error'

  /** APIs to display in the modal */
  apis: ApiEndpoint[]

  /** Modal title */
  title: string
}

/**
 * WebSocket migration status interface
 * Tracks the progress of WebSocket migration
 */
export interface MigrationStatus {
  /** Rollout percentage (0-100) */
  rolloutPercentage: number

  /** Whether WebSocket is enabled */
  websocketEnabled: boolean

  /** Whether Durable Objects are available */
  durableObjectsAvailable: boolean

  /** Migration strategy type */
  migrationStrategy: 'gradual' | 'immediate' | 'canary'

  /** Last status check timestamp */
  lastCheck: Date
}

/**
 * API statistics summary
 * Aggregated statistics for the stats grid
 */
export interface ApiStatistics {
  /** Total number of endpoints */
  total: number

  /** Number of healthy endpoints */
  healthy: number

  /** Number of warning endpoints */
  warning: number

  /** Number of error endpoints */
  error: number
}

/**
 * Auto-refresh configuration
 */
export interface AutoRefreshConfig {
  /** Whether auto-refresh is enabled */
  enabled: boolean

  /** Refresh interval in milliseconds */
  interval: number
}

/**
 * API Monitor Controller State
 * Complete state managed by the controller
 */
export interface ApiMonitorState {
  /** All API endpoints */
  apis: ApiEndpoint[]

  /** Loading state */
  loading: boolean

  /** Refreshing state */
  isRefreshing: boolean

  /** Error message if any */
  error: string | null

  /** Filter state */
  filters: FilterState

  /** Modal state */
  modal: ModalState

  /** Migration status */
  migrationStatus: MigrationStatus

  /** Auto-refresh config */
  autoRefresh: AutoRefreshConfig

  /** Expanded card ID (null if none) */
  expandedCard: string | null
}

/**
 * Backend API response for API status
 */
export interface ApiStatusResponse {
  success: boolean
  data: {
    endpoints: Partial<ApiEndpoint>[]
    timestamp: string
  }
}

/**
 * Backend API response for migration status
 */
export interface MigrationStatusResponse {
  rolloutPercentage: number
  websocketEnabled: boolean
  durableObjectsAvailable: boolean
  migrationStrategy: string
}

/**
 * Response time classification
 */
export type ResponseTimeClass = 'excellent' | 'good' | 'fair' | 'poor'

/**
 * Success rate classification
 */
export type SuccessRateClass = 'excellent' | 'good' | 'fair' | 'poor'
