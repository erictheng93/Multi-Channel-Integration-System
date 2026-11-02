// Dashboard aggregates (Asia/Taipei days, scoped to what the agent can see)

import {
  dashboardContracts,
  type DashboardSummary,
  type MessageVolumeData
} from '@shared/api-contracts'
import { callApiContract } from './contract-client'
import type { ApiResponse } from '@/types'

export type { DashboardSummary, MessageVolumeData } from '@shared/api-contracts'

export const dashboardApi = {
  getSummary: async (): Promise<ApiResponse<DashboardSummary>> => {
    return callApiContract(dashboardContracts.summary, {})
  },

  getMessageVolume: async (days: 7 | 30 | 90 = 7): Promise<ApiResponse<MessageVolumeData>> => {
    return callApiContract(dashboardContracts.messageVolume, { days })
  }
}
