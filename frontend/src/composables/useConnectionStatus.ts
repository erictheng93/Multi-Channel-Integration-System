// Maps the websocket store state onto the shell's connection pill / presence dot.
// States: 即時同步 (green) / 連線中 (orange) / 已離線 (grey).
import { computed, type ComputedRef } from 'vue'

export type ConnectionTone = 'online' | 'connecting' | 'offline'

export interface ConnectionStatus {
  tone: ConnectionTone
  label: string
  hint: string
}

interface ConnectionSource {
  isConnected: boolean
  isConnecting: boolean
}

export function useConnectionStatus(source: ConnectionSource): ComputedRef<ConnectionStatus> {
  return computed<ConnectionStatus>(() => {
    if (source.isConnected) {
      return { tone: 'online', label: '即時同步', hint: '即時連線正常' }
    }
    if (source.isConnecting) {
      return { tone: 'connecting', label: '連線中', hint: '正在建立即時連線' }
    }
    return { tone: 'offline', label: '已離線', hint: '即時連線中斷，將自動重試' }
  })
}
