// Channel Integration Types
// TypeScript definitions for multi-tenant channel management

import type { channelIntegrations } from '@/db/schema';

/**
 * Supported channel platforms
 * NOTE: New platforms can be added without schema changes (Migration 0026)
 */
export type ChannelPlatform = 'line' | 'facebook' | 'whatsapp' | 'telegram' | 'instagram' | string;

// ==================== NEW JSON-based Configuration Types (Migration 0026) ====================

/**
 * Platform-specific configuration (non-sensitive)
 * Stored in channelIntegrations.config JSON field
 */
export interface ChannelConfig {
  // LINE
  channelId?: string;
  // Facebook
  pageId?: string;
  // WhatsApp
  phoneNumber?: string;
  businessAccountId?: string;
  // Telegram (future)
  botUsername?: string;
  // Instagram (future)
  instagramAccountId?: string;
  // Generic extensible fields
  [key: string]: string | number | boolean | undefined;
}

/**
 * Encrypted credentials structure
 * Stored in channelIntegrations.credentials JSON field
 */
export interface ChannelCredentials {
  // Common
  accessToken?: string;
  // LINE
  secret?: string;
  // Facebook
  appSecret?: string;
  // Generic extensible fields
  [key: string]: string | undefined;
}

/**
 * Webhook configuration
 * Stored in channelIntegrations.webhookConfig JSON field
 */
export interface ChannelWebhookConfig {
  url?: string;
  token?: string;
  verifyToken?: string;
}

/**
 * Channel usage statistics
 * Stored in channelIntegrations.stats JSON field
 */
export interface ChannelStats {
  totalSent: number;
  totalReceived: number;
  lastMessageAt?: string;
}

/**
 * Helper to parse JSON config fields safely
 */
export function parseChannelConfig(json: string | null | undefined): ChannelConfig {
  if (!json) return {};
  try {
    return JSON.parse(json) as ChannelConfig;
  } catch {
    return {};
  }
}

export function parseChannelCredentials(json: string | null | undefined): ChannelCredentials {
  if (!json) return {};
  try {
    return JSON.parse(json) as ChannelCredentials;
  } catch {
    return {};
  }
}

export function parseChannelWebhookConfig(json: string | null | undefined): ChannelWebhookConfig {
  if (!json) return {};
  try {
    return JSON.parse(json) as ChannelWebhookConfig;
  } catch {
    return {};
  }
}

export function parseChannelStats(json: string | null | undefined): ChannelStats {
  if (!json) return { totalSent: 0, totalReceived: 0 };
  try {
    return JSON.parse(json) as ChannelStats;
  } catch {
    return { totalSent: 0, totalReceived: 0 };
  }
}

// ==================== End of NEW types ====================

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
    // Common fields
    channelId?: string;
    webhookUrl?: string;
    lastVerifiedAt?: string;

    // Facebook-specific fields
    pageId?: string;
    pageName?: string;

    // WhatsApp-specific fields
    phoneNumberId?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
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
