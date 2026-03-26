// ===== Base Types =====
export type ApiStatus = 'healthy' | 'warning' | 'error'
export type ApiCategory = 'system' | 'auth' | 'conversation' | 'customer' | 'team' | 'message' | 'integration' | 'other'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'
export type SystemStatus = 'operational' | 'degraded' | 'outage'
export type ChannelStatus = 'connected' | 'disconnected' | 'error'
export type EventType = 'recovery' | 'warning' | 'error' | 'info'

// ===== API Endpoint =====
export interface ApiEndpoint {
  id: string
  endpoint: string
  method: HttpMethod | string
  category: ApiCategory | string
  description: string
  status: ApiStatus
  responseTime: number        // p95 response time
  avgResponseTime: number
  p50ResponseTime: number
  successRate: number
  requestCount: number
  errorCount: number
  statusCodes: Record<string, number>
  lastCheck: string           // ISO timestamp
}

// ===== Infrastructure =====
export interface InfrastructureItem {
  id: string
  name: string
  status: ApiStatus
  latencyMs: number
  lastCheck: string
}

// ===== Channel Integration =====
export interface ChannelItem {
  id: string
  name: string
  status: ChannelStatus
  details: string
  latencyMs: number
  lastCheck: string
}

// ===== Monitor Event =====
export interface MonitorEvent {
  id: string
  type: EventType
  message: string
  timestamp: string
}

// ===== Statistics =====
export interface ApiStatistics {
  totalEndpoints: number
  healthyCount: number
  warningCount: number
  errorCount: number
  avgResponseTime: number
}

// ===== Full Monitor Data (from backend) =====
export interface MonitorData {
  status: SystemStatus
  endpoints: ApiEndpoint[]
  infrastructure: InfrastructureItem[]
  channels: ChannelItem[]
  events: MonitorEvent[]
  stats: ApiStatistics
  timestamp: string
}

// ===== API Response =====
export interface ApiStatusResponse {
  success: boolean
  data: MonitorData
  message?: string
}

// ===== UI State Types =====
export interface FilterState {
  status: 'all' | ApiStatus
  category: 'all' | ApiCategory
  search: string
}

export interface ModalState {
  show: boolean
  type: 'all' | ApiStatus
  apis: ApiEndpoint[]
  title: string
}

export interface AutoRefreshConfig {
  enabled: boolean
  interval: number
}
