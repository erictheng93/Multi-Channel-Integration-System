// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/channels.ts
// Created by: Channel Management Feature

import { callApiContract } from './contract-client'
import { channelContracts } from '@shared/api-contracts'
import type { ApiResponse } from '@/types'
import type {
  ChannelConfig,
  ChannelHealthStatus,
  ChannelIntegration,
  ChannelPlatform,
  ChannelStatistics,
  ChannelStatsJson,
  ChannelVerificationRequest,
  ChannelVerificationResponse,
  ChannelWebhookConfig,
  CreateChannelRequest,
  CreateChannelResponse,
  ListChannelsResponse,
  UpdateChannelRequest
} from '@shared/api-contracts'

export type {
  ChannelConfig,
  ChannelHealthStatus,
  ChannelIntegration,
  ChannelPlatform,
  ChannelStatistics,
  ChannelStatsJson,
  ChannelVerificationRequest,
  ChannelVerificationResponse,
  ChannelWebhookConfig,
  CreateChannelRequest,
  CreateChannelResponse,
  FacebookChannelConfig,
  LineChannelConfig,
  ListChannelsResponse,
  UpdateChannelRequest,
  WhatsAppChannelConfig
} from '@shared/api-contracts'

/**
 * Channel API Client
 */
export const channelsApi = {
  /**
   * List all channels for the authenticated user's team
   * @param platform - Optional platform filter
   */
  list: async (platform?: ChannelPlatform): Promise<ListChannelsResponse> => {
    return callApiContract(channelContracts.list, { platform })
  },

  /**
   * Create a new channel integration
   * @param data - Channel configuration data
   */
  create: async (data: CreateChannelRequest): Promise<CreateChannelResponse> => {
    return callApiContract(channelContracts.create, {}, data)
  },

  /**
   * Get channel details by ID
   * @param channelId - Channel ID
   */
  get: async (channelId: number): Promise<ApiResponse<ChannelIntegration>> => {
    return callApiContract(channelContracts.get, { channelId })
  },

  /**
   * Update channel configuration
   * @param channelId - Channel ID
   * @param data - Update data
   */
  update: async (
    channelId: number,
    data: UpdateChannelRequest
  ): Promise<ApiResponse<ChannelIntegration>> => {
    return callApiContract(channelContracts.update, { channelId }, data)
  },

  /**
   * Deactivate channel (soft delete)
   * @param channelId - Channel ID
   */
  delete: async (channelId: number): Promise<ApiResponse<{ message: string }>> => {
    return callApiContract(channelContracts.delete, { channelId })
  },

  /**
   * Verify channel configuration
   * @param channelId - Channel ID
   * @param data - Verification request data
   */
  verify: async (
    channelId: number,
    data?: ChannelVerificationRequest
  ): Promise<ChannelVerificationResponse> => {
    return callApiContract(channelContracts.verify, { channelId }, data || {})
  },

  /**
   * Get channel statistics
   * @param channelId - Channel ID
   */
  getStats: async (channelId: number): Promise<ApiResponse<ChannelStatistics>> => {
    return callApiContract(channelContracts.getStats, { channelId })
  },

  /**
   * Check channel health
   * @param channelId - Channel ID
   */
  checkHealth: async (channelId: number): Promise<ApiResponse<ChannelHealthStatus>> => {
    return callApiContract(channelContracts.checkHealth, { channelId })
  }
}

/**
 * Parse JSON config from channel
 */
export function parseConfig(channel: ChannelIntegration): ChannelConfig {
  if (!channel.config) {
    return {}
  }
  try {
    return JSON.parse(channel.config) as ChannelConfig
  } catch {
    return {}
  }
}

/**
 * Parse JSON webhookConfig from channel
 */
export function parseWebhookConfig(channel: ChannelIntegration): ChannelWebhookConfig {
  if (!channel.webhookConfig) {
    return {}
  }
  try {
    return JSON.parse(channel.webhookConfig) as ChannelWebhookConfig
  } catch {
    return {}
  }
}

/**
 * Parse JSON stats from channel
 */
export function parseStats(channel: ChannelIntegration): ChannelStatsJson {
  if (!channel.stats) {
    return { totalSent: 0, totalReceived: 0 }
  }
  try {
    return JSON.parse(channel.stats) as ChannelStatsJson
  } catch {
    return { totalSent: 0, totalReceived: 0 }
  }
}

export default channelsApi
