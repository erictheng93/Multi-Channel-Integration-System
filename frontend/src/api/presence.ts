// Team presence and realtime metrics history
import { callApiContract } from './contract-client'
import { realtimeContracts } from '@shared/api-contracts'
import type { TeamPresenceDto, WsMetricsHistoryDto, WsMetricsRange } from '@shared/api-contracts'
import type { ApiResponse } from '@/types'

export type { TeamPresenceDto, WsMetricsHistoryDto, WsMetricsPointDto, WsMetricsRange } from '@shared/api-contracts'

export const presenceApi = {
  /** Online agents visible to the caller (server caches 15 s; poll no faster than that). */
  getTeamPresence(): Promise<ApiResponse<TeamPresenceDto>> {
    return callApiContract(realtimeContracts.teamPresence, {}) as Promise<ApiResponse<TeamPresenceDto>>
  },
  /** Admin only. */
  getWsMetricsHistory(range: WsMetricsRange): Promise<ApiResponse<WsMetricsHistoryDto>> {
    return callApiContract(realtimeContracts.wsMetricsHistory, { range }) as Promise<ApiResponse<WsMetricsHistoryDto>>
  }
}
