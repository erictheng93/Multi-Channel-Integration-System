import { defineApiContract } from './core'

export type ChannelPlatform = 'line' | 'facebook' | 'whatsapp'

export interface LineChannelConfig {
  channelId: string
  channelAccessToken: string
  channelSecret: string
  webhookUrl?: string
  webhookToken?: string
}

export interface FacebookChannelConfig {
  pageId: string
  accessToken: string
  appSecret: string
  webhookUrl?: string
  webhookToken?: string
}

export interface WhatsAppChannelConfig {
  phoneNumber: string
  businessAccountId: string
  accessToken: string
  webhookUrl?: string
  webhookToken?: string
}

export interface ChannelConfig {
  channelId?: string
  pageId?: string
  phoneNumber?: string
  businessAccountId?: string
  [key: string]: string | number | boolean | undefined
}

export interface ChannelWebhookConfig {
  url?: string
  token?: string
  verifyToken?: string
}

export interface ChannelStatsJson {
  totalSent: number
  totalReceived: number
  lastMessageAt?: string
}

export interface ChannelIntegration {
  id: number
  teamId: number
  platform: ChannelPlatform
  config?: string | null
  webhookConfig?: string | null
  stats?: string | null
  isActive: boolean
  isVerified: boolean
  lastVerifiedAt?: string | null
  lastError?: string | null
  errorCount: number
  configuredBy?: string | null
  configMetadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface CreateChannelRequest {
  platform: ChannelPlatform
  lineConfig?: LineChannelConfig
  facebookConfig?: FacebookChannelConfig
  whatsappConfig?: WhatsAppChannelConfig
  configMetadata?: Record<string, unknown>
}

export interface UpdateChannelRequest {
  lineConfig?: Partial<LineChannelConfig>
  facebookConfig?: Partial<FacebookChannelConfig>
  whatsappConfig?: Partial<WhatsAppChannelConfig>
  isActive?: boolean
  configMetadata?: Record<string, unknown>
}

export interface ChannelVerificationRequest {
  testMessage?: string
}

export interface ChannelVerificationResponse {
  success: boolean
  verified: boolean
  message: string
  error?: string
  details?: {
    channelId?: string
    webhookUrl?: string
    lastVerifiedAt?: string
    pageId?: string
    pageName?: string
    phoneNumberId?: string
    displayPhoneNumber?: string
    verifiedName?: string
  }
}

export interface ChannelStatistics {
  channelId?: number
  platform?: ChannelPlatform
  totalMessagesSent: number
  totalMessagesReceived: number
  successRate?: number
  lastMessageAt?: string | null
  averageResponseTime?: number
  isActive?: boolean
  isVerified?: boolean
  errorCount?: number
  uptime?: {
    days: number
    hoursLastDay: number
  }
}

export interface ChannelHealthStatus {
  channelId?: number
  platform?: ChannelPlatform
  status: 'healthy' | 'degraded' | 'unhealthy' | 'down'
  lastChecked?: string
  lastCheckAt?: string
  issues?: string[]
  uptime?: number
  consecutiveErrors?: number
  lastError?: unknown
  recommendations?: string[]
}

export interface ListChannelsResponse {
  success: boolean
  data: ChannelIntegration[]
  count: number
}

export interface CreateChannelResponse {
  success: boolean
  data: ChannelIntegration
  webhookUrl: string
  message?: string
}

export const channelContracts = {
  list: defineApiContract<
    { platform?: ChannelPlatform },
    void,
    ChannelIntegration[],
    ListChannelsResponse
  >({
    method: 'GET',
    path: ({ platform }) => `/channels${platform ? `?platform=${platform}` : ''}`
  }),

  create: defineApiContract<
    Record<string, never>,
    CreateChannelRequest,
    ChannelIntegration,
    CreateChannelResponse
  >({
    method: 'POST',
    path: () => '/channels'
  }),

  get: defineApiContract<{ channelId: number }, void, ChannelIntegration>({
    method: 'GET',
    path: ({ channelId }) => `/channels/${channelId}`
  }),

  update: defineApiContract<{ channelId: number }, UpdateChannelRequest, ChannelIntegration>({
    method: 'PUT',
    path: ({ channelId }) => `/channels/${channelId}`
  }),

  delete: defineApiContract<{ channelId: number }, void, { message: string }>({
    method: 'DELETE',
    path: ({ channelId }) => `/channels/${channelId}`
  }),

  verify: defineApiContract<
    { channelId: number },
    ChannelVerificationRequest,
    never,
    ChannelVerificationResponse
  >({
    method: 'POST',
    path: ({ channelId }) => `/channels/${channelId}/verify`
  }),

  getStats: defineApiContract<{ channelId: number }, void, ChannelStatistics>({
    method: 'GET',
    path: ({ channelId }) => `/channels/${channelId}/stats`
  }),

  checkHealth: defineApiContract<{ channelId: number }, void, ChannelHealthStatus>({
    method: 'GET',
    path: ({ channelId }) => `/channels/${channelId}/health`
  })
} as const
