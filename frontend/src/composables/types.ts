// Composables 類型定義
export interface UseAsyncDataOptions<T> {
  immediate?: boolean
  resetOnExecute?: boolean
  shallow?: boolean
  onSuccess?: (_data: T) => void
  onError?: (_error: Error | unknown) => void
  transform?: (_data: unknown) => T
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
  onConnected?: (_socket: globalThis.WebSocket) => void
  onDisconnected?: (_socket: globalThis.WebSocket, _event: globalThis.CloseEvent) => void
  onError?: (_socket: globalThis.WebSocket, _event: globalThis.Event) => void
  onMessage?: (_socket: globalThis.WebSocket, _event: globalThis.MessageEvent) => void
}

export enum WebSocketStatus {
  // CONNECTING = 'CONNECTING',
  // CONNECTED = 'CONNECTED',
  // DISCONNECTED = 'DISCONNECTED',
  // ERROR = 'ERROR'
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