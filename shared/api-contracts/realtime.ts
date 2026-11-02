import { defineApiContract } from './core'

/** GET /team/presence. Scoped by the server: admin sees all online agents, an agent sees teammates only. */
export interface TeamPresenceDto {
  onlineAgentIds: string[]
  /** The caller's own state in the broadcaster registry. Bind the topbar pill to the websocket store instead. */
  self: { id: string; registered: boolean }
  /** Epoch ms; the server caches the list for 15 s. */
  generatedAt: number
  /** false = broadcaster unreachable, so an empty list means unknown rather than nobody online. */
  available: boolean
}

export type WsMetricsRange = '1h' | '6h' | '24h' | '7d'

/** One stored snapshot (or a bucket average for long ranges). Null = unknown, not zero. */
export interface WsMetricsPointDto {
  ts: number
  /** Registered connections (user registry plus conversation rooms), not proven-live sockets. */
  activeConnections: number
  onlineAgents: number
  eventsInPerS: number | null
  eventsOutPerS: number | null
  avgProcessingMs: number | null
  /** failed / (success + failed) deliveries over the snapshot window. */
  errorRate: number | null
}

export interface WsMetricsHistoryDto {
  range: WsMetricsRange
  points: WsMetricsPointDto[]
}

export const realtimeContracts = {
  teamPresence: defineApiContract<Record<string, never>, void, TeamPresenceDto>({
    method: 'GET',
    path: () => '/team/presence'
  }),
  wsMetricsHistory: defineApiContract<{ range: WsMetricsRange }, void, WsMetricsHistoryDto>({
    method: 'GET',
    path: ({ range }) => `/websocket/metrics/history?range=${range}`
  })
}
