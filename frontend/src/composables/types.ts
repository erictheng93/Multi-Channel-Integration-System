// Composables 類型定義
export interface UseAsyncDataOptions<T> {
  immediate?: boolean
  resetOnExecute?: boolean
  shallow?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error | unknown) => void
  transform?: (data: unknown) => T
}

export interface UseWebSocketOptions {
  protocols?: string | string[]
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeat?: {
    message?: string | object
    interval?: number
  }
  onConnected?: (ws: WebSocket) => void
  onDisconnected?: (ws: WebSocket, event: CloseEvent) => void
  onError?: (ws: WebSocket, event: Event) => void
  onMessage?: (ws: WebSocket, event: MessageEvent) => void
}

export enum WebSocketStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR'
}

export interface PaginationOptions {
  page?: number
  limit?: number
  total?: number
}

export interface SearchOptions {
  debounceMs?: number
  minLength?: number
  caseSensitive?: boolean
}

export interface SortOptions<T> {
  key: keyof T
  direction: 'asc' | 'desc'
}

// FilterOptions moved to useFilter.ts to avoid ref type issues