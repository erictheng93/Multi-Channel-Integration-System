// Channel Integration Types
// TypeScript definitions for multi-tenant channel management

import type { channelIntegrations } from '@/db/schema';

/**
 * Supported channel platforms
 */
export type ChannelPlatform = 'line' | 'facebook' | 'whatsapp';

/**
 * Channel integration record from database
 */
export type ChannelIntegration = typeof channelIntegrations.$inferSelect;

/**
 * New channel integration creation data
 */
export type NewChannelIntegration = typeof channelIntegrations.$inferInsert;

/**
 * LINE channel configuration
 */
export interface LineChannelConfig {
  channelId: string;
  channelAccessToken: string;
  channelSecret: string;
  webhookUrl?: string;
  webhookToken?: string;
}

/**
 * Facebook channel configuration (for future use)
 */
export interface FacebookChannelConfig {
  pageId: string;
  accessToken: string;
  appSecret: string;
}

/**
 * WhatsApp channel configuration (for future use)
 */
export interface WhatsAppChannelConfig {
  phoneNumber: string;
  businessAccountId: string;
  accessToken: string;
}

/**
 * Channel configuration request
 */
export interface ChannelConfigRequest {
  platform: ChannelPlatform;
  teamId: number;
  lineConfig?: LineChannelConfig;
  facebookConfig?: FacebookChannelConfig;
  whatsappConfig?: WhatsAppChannelConfig;
  configMetadata?: Record<string, unknown>;
}

/**
 * Channel configuration response
 */
export interface ChannelConfigResponse {
  success: boolean;
  data?: ChannelIntegration;
  error?: string;
  webhookUrl?: string;
}

/**
 * Channel verification request
 */
export interface ChannelVerificationRequest {
  channelId: number;
  testMessage?: string;
}

/**
 * Channel verification response
 */
export interface ChannelVerificationResponse {
  success: boolean;
  verified: boolean;
  message: string;
  error?: string;
  details?: {
    channelId?: string;
    webhookUrl?: string;
    lastVerifiedAt?: string;
  };
}

/**
 * Channel statistics
 */
export interface ChannelStatistics {
  channelId: number;
  platform: ChannelPlatform;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  lastMessageAt: string | null;
  isActive: boolean;
  isVerified: boolean;
  errorCount: number;
  uptime: {
    days: number;
    hoursLastDay: number;
  };
}

/**
 * Channel list query parameters
 */
export interface ChannelListQuery {
  teamId?: number;
  platform?: ChannelPlatform;
  isActive?: boolean;
  isVerified?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Channel update request
 */
export interface ChannelUpdateRequest {
  channelId: number;
  lineConfig?: Partial<LineChannelConfig>;
  facebookConfig?: Partial<FacebookChannelConfig>;
  whatsappConfig?: Partial<WhatsAppChannelConfig>;
  isActive?: boolean;
  configMetadata?: Record<string, unknown>;
}

/**
 * Webhook routing information
 */
export interface WebhookRouteInfo {
  teamId: number;
  channelId: number;
  platform: ChannelPlatform;
  channelConfig: ChannelIntegration;
  webhookToken: string;
}

/**
 * Channel error record
 */
export interface ChannelError {
  timestamp: string;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  retryAttempt: number;
  context?: Record<string, unknown>;
}

/**
 * Channel health status
 */
export interface ChannelHealthStatus {
  channelId: number;
  platform: ChannelPlatform;
  status: 'healthy' | 'degraded' | 'down';
  lastCheckAt: string;
  consecutiveErrors: number;
  lastError: ChannelError | null;
  recommendations?: string[];
}

/**
 * Webhook URL generation options
 */
export interface WebhookUrlOptions {
  teamId: number;
  platform: ChannelPlatform;
  regenerateToken?: boolean;
}

/**
 * Channel integration service interface
 */
export interface ChannelIntegrationService {
  createChannel(request: ChannelConfigRequest): Promise<ChannelConfigResponse>;
  verifyChannel(request: ChannelVerificationRequest): Promise<ChannelVerificationResponse>;
  getChannel(channelId: number): Promise<ChannelIntegration | null>;
  getChannelsByTeam(teamId: number, platform?: ChannelPlatform): Promise<ChannelIntegration[]>;
  updateChannel(request: ChannelUpdateRequest): Promise<ChannelConfigResponse>;
  deactivateChannel(channelId: number): Promise<boolean>;
  generateWebhookUrl(options: WebhookUrlOptions): Promise<string>;
  getChannelStatistics(channelId: number): Promise<ChannelStatistics>;
  checkChannelHealth(channelId: number): Promise<ChannelHealthStatus>;
}
