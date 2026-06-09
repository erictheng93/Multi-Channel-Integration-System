import { useWebSocketStore } from './websocket'

export function reconnectWebSocketStore(): Promise<void> {
  const wsStore = useWebSocketStore()
  return wsStore.reconnect()
}
