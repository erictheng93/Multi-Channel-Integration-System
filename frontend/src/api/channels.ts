// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/api/channels.ts
// Created by: Channel Management Feature

import { apiClient } from './base'
import type { ApiResponse } from '@/types'

/**
 * Channel Platform Types
 */
export type ChannelPlatform = 'line' | 'facebook' | 'whatsapp'

/**
 * LINE Channel Configuration
 */
export interface LineChannelConfig {
  channelId: string
  channelAccessToken: string
  channelSecret: string
  webhookUrl?: string
  webhookToken?: string
}

/**
 * Facebook Channel Configuration
 */
export interface FacebookChannelConfig {
  pageId: string
  accessToken: string
  appSecret: string
  webhookUrl?: string
  webhookToken?: string
}

/**
 * WhatsApp Channel Configuration
 */
export interface WhatsAppChannelConfig {
  phoneNumber: string
  businessAccountId: string
  accessToken: string
  webhookUrl?: string
  webhookToken?: string
}

/**
 * JSON-based channel configuration (non-sensitive)
 */
export interface ChannelConfig {
  channelId?: string
  pageId?: string
  phoneNumber?: string
  businessAccountId?: string
  [key: string]: string | number | boolean | undefined
}

/**
 * Webhook configuration
 */
export interface ChannelWebhookConfig {
  url?: string
  token?: string
  verifyToken?: string
}

/**
 * Channel usage statistics
 */
export interface ChannelStatsJson {
  totalSent: number
  totalReceived: number
  lastMessageAt?: string
}

/**
 * Channel Integration Entity
 */
export interface ChannelIntegration {
  id: number
  teamId: number
  platform: ChannelPlatform

  // JSON-based configuration (primary)
  config?: string | null
  webhookConfig?: string | null
  stats?: string | null
  // NOTE: credentials field is stripped by the backend — never sent to the frontend

  // Status
  isActive: boolean
  isVerified: boolean
  lastVerifiedAt?: string | null

  // Error tracking
  lastError?: string | null
  errorCount: number

  // Metadata
  configuredBy?: string | null
  configMetadata?: Record<string, unknown> | null

  // Timestamps
  createdAt: string
  updatedAt: string
}

/**
 * Create Channel Request
 */
export interface CreateChannelRequest {
  platform: ChannelPlatform
  lineConfig?: LineChannelConfig
  facebookConfig?: FacebookChannelConfig
  whatsappConfig?: WhatsAppChannelConfig
  configMetadata?: Record<string, unknown>
}

/**
 * Update Channel Request
 */
export interface UpdateChannelRequest {
  lineConfig?: LineChannelConfig
  facebookConfig?: FacebookChannelConfig
  whatsappConfig?: WhatsAppChannelConfig
  isActive?: boolean
  configMetadata?: Record<string, unknown>
}

/**
 * Channel Verification Request
 */
export interface ChannelVerificationRequest {
  testMessage?: string
}

/**
 * Channel Verification Response
 */
export interface ChannelVerificationResponse {
  success: boolean
  verified: boolean
  message: string
  details?: {
    channelId?: string
    webhookUrl?: string
    lastVerifiedAt?: string
  }
}

/**
 * Channel Statistics
 */
export interface ChannelStatistics {
  totalMessagesSent: number
  totalMessagesReceived: number
  successRate: number
  lastMessageAt?: string
  averageResponseTime?: number
}

/**
 * Channel Health Status
 */
export interface ChannelHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastChecked: string
  issues?: string[]
  uptime?: number
}

/**
 * List Channels Response
 */
export interface ListChannelsResponse {
  success: boolean
  data: ChannelIntegration[]
  count: number
}

/**
 * Create Channel Response
 */
export interface CreateChannelResponse {
  success: boolean
  data: ChannelIntegration
  webhookUrl: string
  message?: string
}

/**
 * Channel API Client
 */
export const channelsApi = {
  /**
   * List all channels for the authenticated user's team
   * @param platform - Optional platform filter
   */
  list: async (platform?: ChannelPlatform): Promise<ListChannelsResponse> => {
    const query = platform ? `?platform=${platform}` : ''
    return apiClient.get(`/channels${query}`) as Promise<ListChannelsResponse>
  },

  /**
   * Create a new channel integration
   * @param data - Channel configuration data
   */
  create: async (data: CreateChannelRequest): Promise<CreateChannelResponse> => {
    return apiClient.post('/channels', data) as Promise<CreateChannelResponse>
  },

  /**
   * Get channel details by ID
   * @param channelId - Channel ID
   */
  get: async (channelId: number): Promise<ApiResponse<ChannelIntegration>> => {
    return apiClient.get(`/channels/${channelId}`)
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
    return apiClient.put(`/channels/${channelId}`, data)
  },

  /**
   * Deactivate channel (soft delete)
   * @param channelId - Channel ID
   */
  delete: async (channelId: number): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.delete(`/channels/${channelId}`)
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
    return apiClient.post(`/channels/${channelId}/verify`, data || {}) as Promise<ChannelVerificationResponse>
  },

  /**
   * Get channel statistics
   * @param channelId - Channel ID
   */
  getStats: async (channelId: number): Promise<ApiResponse<ChannelStatistics>> => {
    return apiClient.get(`/channels/${channelId}/stats`)
  },

  /**
   * Check channel health
   * @param channelId - Channel ID
   */
  checkHealth: async (channelId: number): Promise<ApiResponse<ChannelHealthStatus>> => {
    return apiClient.get(`/channels/${channelId}/health`)
  }
}

/**
 * Parse JSON config from channel
 */
export function parseConfig(channel: ChannelIntegration): ChannelConfig {
  if (!channel.config) return {}
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
  if (!channel.webhookConfig) return {}
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
  if (!channel.stats) return { totalSent: 0, totalReceived: 0 }
  try {
    return JSON.parse(channel.stats) as ChannelStatsJson
  } catch {
    return { totalSent: 0, totalReceived: 0 }
  }
}

export default channelsApi
