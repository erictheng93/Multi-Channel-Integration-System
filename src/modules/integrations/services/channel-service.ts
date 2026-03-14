// Channel Integration Service
// Business logic for multi-tenant channel management

// createDbClient not needed - using drizzle directly

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { channelIntegrations } from '@/db/schema';
import type { Bindings } from '@/types';
import { getEncryptionService, type EncryptedData } from '@/services/encryption-service';
import type {
  ChannelPlatform,
  ChannelIntegration,
  NewChannelIntegration,
  ChannelConfigRequest,
  ChannelConfigResponse,
  ChannelVerificationRequest,
  ChannelVerificationResponse,
  ChannelUpdateRequest,
  ChannelStatistics,
  ChannelHealthStatus,
  WebhookUrlOptions,
  ChannelIntegrationService as IChannelIntegrationService,
  ChannelConfig,
  ChannelCredentials,
  ChannelWebhookConfig,
  ChannelStats
} from '../types/channel-types';
import {
  parseChannelConfig,
  parseChannelWebhookConfig,
  parseChannelStats
} from '../types/channel-types';
import { nowISO, nowMs } from '@/utils/timestamp'

export class ChannelService implements IChannelIntegrationService {
  private db: DrizzleD1Database;
  private bindings: Bindings;

  constructor(bindings: Bindings) {
    this.db = drizzle(bindings.DB);
    this.bindings = bindings;
  }

  /**
   * Decrypt an encrypted field value
   * Supports both encrypted JSON objects and legacy plaintext
   */
  private async decryptField(encryptedValue: string | null | undefined): Promise<string | null> {
    if (!encryptedValue) {
      return null;
    }

    try {
      // Try to parse as encrypted JSON
      const encryptedData: EncryptedData = JSON.parse(encryptedValue);

      // Check if it has the encrypted structure
      if (encryptedData.encrypted && encryptedData.iv && encryptedData.tag) {
        const encryptionService = await getEncryptionService(this.bindings.ENCRYPTION_KEY);
        return await encryptionService.decrypt(encryptedData);
      }

      // If not encrypted structure, return as-is (backward compatibility)
      return encryptedValue;
    } catch {
      // If JSON parse fails, it's likely plaintext (backward compatibility)
      return encryptedValue;
    }
  }

  /**
   * Build JSON column values for channel_integrations
   * Encrypts the ENTIRE credentials object as one JSON blob
   */
  private async buildJsonColumns(
    _platform: ChannelPlatform,
    config: ChannelConfig,
    credentials: ChannelCredentials,
    webhookConfig: ChannelWebhookConfig,
    stats?: ChannelStats
  ): Promise<{ config: string; credentials: string; webhookConfig: string; stats: string }> {
    const encryptionService = await getEncryptionService(this.bindings.ENCRYPTION_KEY);

    // Encrypt the entire credentials object as one blob
    const credentialsPlaintext = JSON.stringify(credentials);
    const encryptedCredentials = await encryptionService.encrypt(credentialsPlaintext);

    return {
      config: JSON.stringify(config),
      credentials: JSON.stringify(encryptedCredentials),
      webhookConfig: JSON.stringify(webhookConfig),
      stats: JSON.stringify(stats || { totalSent: 0, totalReceived: 0 })
    };
  }

  /**
   * Decrypt the JSON credentials column value
   * Handles two formats:
   * - New format: EncryptedData envelope → decrypt → JSON.parse → ChannelCredentials
   * - Legacy format (from migration 0026): JSON with individually encrypted string fields
   */
  private async decryptCredentials(credentialsJson: string | null | undefined): Promise<ChannelCredentials> {
    if (!credentialsJson) return {};

    try {
      const parsed = JSON.parse(credentialsJson);

      // New format: EncryptedData envelope with { encrypted, iv, tag }
      if (parsed.encrypted && parsed.iv && parsed.tag) {
        const encryptionService = await getEncryptionService(this.bindings.ENCRYPTION_KEY);
        const decrypted = await encryptionService.decrypt(parsed as EncryptedData);
        return JSON.parse(decrypted) as ChannelCredentials;
      }

      // Legacy format: JSON object where each value may be an encrypted string
      const result: ChannelCredentials = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          const decrypted = await this.decryptField(value);
          result[key] = decrypted || undefined;
        }
      }
      return result;

    } catch (error) {
      console.error('[ChannelService] Failed to decrypt credentials JSON:', error);
      return {};
    }
  }

  /**
   * Get decrypted credentials for a channel
   * Tries JSON column first, falls back to individual legacy columns
   */
  async getDecryptedCredentials(channel: ChannelIntegration): Promise<ChannelCredentials> {
    if (channel.credentials) {
      return await this.decryptCredentials(channel.credentials);
    }
    return {};
  }

  /**
   * Create a new channel integration
   */
  async createChannel(request: ChannelConfigRequest): Promise<ChannelConfigResponse> {
    try {
      console.log(`[ChannelService] Creating ${request.platform} channel for team ${request.teamId}`);

      // Check if team already has an active channel for this platform
      const existingChannel = await this.db
        .select()
        .from(channelIntegrations)
        .where(
          and(
            eq(channelIntegrations.teamId, request.teamId),
            eq(channelIntegrations.platform, request.platform),
            eq(channelIntegrations.isActive, true)
          )
        )
        .limit(1);

      if (existingChannel.length > 0) {
        return {
          success: false,
          error: `Team already has an active ${request.platform} channel. Please deactivate it first.`
        };
      }

      // Generate webhook URL and token
      const webhookToken = crypto.randomUUID();
      const webhookUrl = this.generateWebhookUrlInternal(request.platform, request.teamId, webhookToken);

      // Prepare channel data based on platform
      const channelData: NewChannelIntegration = {
        teamId: request.teamId,
        platform: request.platform,
        configuredBy: undefined, // Will be set by handler from JWT
        isActive: true,
        isVerified: false,
        createdAt: nowISO(),
        updatedAt: nowISO()
      };

      // Add platform-specific configuration
      let jsonConfig: ChannelConfig = {};
      let jsonCredentials: ChannelCredentials = {};
      let jsonWebhookConfig: ChannelWebhookConfig = { url: webhookUrl, token: webhookToken };

      if (request.platform === 'line' && request.lineConfig) {
        jsonConfig = { channelId: request.lineConfig.channelId };
        jsonCredentials = { accessToken: request.lineConfig.channelAccessToken, secret: request.lineConfig.channelSecret };
      } else if (request.platform === 'facebook' && request.facebookConfig) {
        jsonConfig = { pageId: request.facebookConfig.pageId };
        jsonCredentials = { accessToken: request.facebookConfig.accessToken, appSecret: request.facebookConfig.appSecret };
      } else if (request.platform === 'whatsapp' && request.whatsappConfig) {
        jsonConfig = { phoneNumber: request.whatsappConfig.phoneNumber, businessAccountId: request.whatsappConfig.businessAccountId };
        jsonCredentials = { accessToken: request.whatsappConfig.accessToken };
      }

      // Build and assign JSON columns (dual-write)
      const jsonColumns = await this.buildJsonColumns(
        request.platform,
        jsonConfig,
        jsonCredentials,
        jsonWebhookConfig
      );
      channelData.config = jsonColumns.config;
      channelData.credentials = jsonColumns.credentials;
      channelData.webhookConfig = jsonColumns.webhookConfig;
      channelData.stats = jsonColumns.stats;

      // Add metadata
      if (request.configMetadata) {
        channelData.configMetadata = JSON.stringify(request.configMetadata);
      }

      // Insert into database
      await this.db.insert(channelIntegrations).values(channelData);

      // Fetch the created channel
      const [createdChannel] = await this.db
        .select()
        .from(channelIntegrations)
        .where(
          and(
            eq(channelIntegrations.teamId, request.teamId),
            eq(channelIntegrations.platform, request.platform)
          )
        )
        .orderBy(desc(channelIntegrations.createdAt))
        .limit(1);

      console.log(`[ChannelService]  Channel created successfully: ${createdChannel.id}`);

      return {
        success: true,
        data: createdChannel,
        webhookUrl
      };

    } catch (error) {
      console.error('[ChannelService] Error creating channel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create channel'
      };
    }
  }

  /**
   * Verify channel configuration by testing LINE API
   */
  async verifyChannel(request: ChannelVerificationRequest): Promise<ChannelVerificationResponse> {
    try {
      console.log(`[ChannelService] Verifying channel ${request.channelId}`);

      // Get channel details
      const channel = await this.getChannel(request.channelId);

      if (!channel) {
        return {
          success: false,
          verified: false,
          message: 'Channel not found'
        };
      }

      if (!channel.isActive) {
        return {
          success: false,
          verified: false,
          message: 'Channel is not active'
        };
      }

      // Verify based on platform
      if (channel.platform === 'line') {
        return await this.verifyLineChannel(channel, request.testMessage);
      } else if (channel.platform === 'facebook') {
        return await this.verifyFacebookChannel(channel, request.testMessage);
      } else if (channel.platform === 'whatsapp') {
        return await this.verifyWhatsAppChannel(channel, request.testMessage);
      }

      return {
        success: false,
        verified: false,
        message: `Platform ${channel.platform} verification not supported`
      };

    } catch (error) {
      console.error('[ChannelService] Error verifying channel:', error);
      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Verify LINE channel by testing API connectivity
   */
  private async verifyLineChannel(
    channel: ChannelIntegration,
    _testMessage?: string
  ): Promise<ChannelVerificationResponse> {
    try {
      // JSON-first: try getDecryptedCredentials (reads JSON column, falls back to legacy)
      const creds = await this.getDecryptedCredentials(channel);
      const accessToken = creds.accessToken;

      if (!accessToken) {
        return {
          success: false,
          verified: false,
          message: 'LINE Channel Access Token is missing'
        };
      }

      // Test LINE API by verifying the token
      const response = await fetch('https://api.line.me/v2/oauth/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}` // Use decrypted token
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChannelService] LINE API verification failed:', errorText);

        // Update error tracking
        await this.updateChannelError(channel.id, {
          timestamp: nowISO(),
          errorType: 'verification_failed',
          errorMessage: `LINE API returned ${response.status}: ${errorText}`,
          retryAttempt: (channel.errorCount || 0) + 1
        });

        return {
          success: false,
          verified: false,
          message: `LINE API verification failed: ${response.status} ${response.statusText}`
        };
      }

      const verificationData = await response.json() as { client_id: string; expires_in: number };

      // Update channel as verified
      const timestamp = nowISO();
      await this.db
        .update(channelIntegrations)
        .set({
          isVerified: true,
          lastVerifiedAt: timestamp,
          errorCount: 0,
          lastError: null,
          updatedAt: timestamp
        })
        .where(eq(channelIntegrations.id, channel.id));

      console.log(`[ChannelService]  LINE channel verified successfully: ${channel.id}`);

      return {
        success: true,
        verified: true,
        message: 'LINE channel verified successfully',
        details: {
          channelId: verificationData.client_id,
          webhookUrl: parseChannelWebhookConfig(channel.webhookConfig).url || undefined,
          lastVerifiedAt: timestamp
        }
      };

    } catch (error) {
      console.error('[ChannelService] Error verifying LINE channel:', error);

      // Update error tracking
      await this.updateChannelError(channel.id, {
        timestamp: nowISO(),
        errorType: 'verification_error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryAttempt: (channel.errorCount || 0) + 1,
        context: { stack: error instanceof Error ? error.stack : undefined }
      });

      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : 'Verification failed',
        error: error instanceof Error ? error.stack : undefined
      };
    }
  }

  /**
   * Verify Facebook channel by testing API connectivity
   */
  private async verifyFacebookChannel(
    channel: ChannelIntegration,
    _testMessage?: string
  ): Promise<ChannelVerificationResponse> {
    try {
      // JSON-first: try getDecryptedCredentials
      const creds = await this.getDecryptedCredentials(channel);
      const accessToken = creds.accessToken;

      if (!accessToken) {
        return {
          success: false,
          verified: false,
          message: 'Facebook Access Token is missing'
        };
      }

      const config = parseChannelConfig(channel.config);
      const pageId = config.pageId;

      if (!pageId) {
        return {
          success: false,
          verified: false,
          message: 'Facebook Page ID is missing'
        };
      }

      // Test Facebook API by fetching page info
      // Using Graph API v18.0 to verify page access
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChannelService] Facebook API verification failed:', errorText);

        // Update error tracking
        await this.updateChannelError(channel.id, {
          timestamp: nowISO(),
          errorType: 'verification_failed',
          errorMessage: `Facebook API returned ${response.status}: ${errorText}`,
          retryAttempt: (channel.errorCount || 0) + 1
        });

        return {
          success: false,
          verified: false,
          message: `Facebook API verification failed: ${response.status} ${response.statusText}`
        };
      }

      const verificationData = await response.json() as { id: string; name: string };

      // Update channel as verified
      const timestamp = nowISO();
      await this.db
        .update(channelIntegrations)
        .set({
          isVerified: true,
          lastVerifiedAt: timestamp,
          errorCount: 0,
          lastError: null,
          updatedAt: timestamp
        })
        .where(eq(channelIntegrations.id, channel.id));

      console.log(`[ChannelService]  Facebook channel verified successfully: ${channel.id}`);

      return {
        success: true,
        verified: true,
        message: 'Facebook channel verified successfully',
        details: {
          pageId: verificationData.id,
          pageName: verificationData.name,
          lastVerifiedAt: timestamp
        }
      };

    } catch (error) {
      console.error('[ChannelService] Error verifying Facebook channel:', error);

      // Update error tracking
      await this.updateChannelError(channel.id, {
        timestamp: nowISO(),
        errorType: 'verification_error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryAttempt: (channel.errorCount || 0) + 1,
        context: { platform: 'facebook' }
      });

      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : 'Verification failed',
        error: error instanceof Error ? error.stack : undefined
      };
    }
  }

  /**
   * Verify WhatsApp channel by testing API connectivity
   */
  private async verifyWhatsAppChannel(
    channel: ChannelIntegration,
    _testMessage?: string
  ): Promise<ChannelVerificationResponse> {
    try {
      // JSON-first: try getDecryptedCredentials
      const waCreds = await this.getDecryptedCredentials(channel);
      const accessToken = waCreds.accessToken;

      if (!accessToken) {
        return {
          success: false,
          verified: false,
          message: 'WhatsApp Access Token is missing'
        };
      }

      const waConfig = parseChannelConfig(channel.config);
      const phoneNumber = waConfig.phoneNumber;
      const businessAccountId = waConfig.businessAccountId;

      if (!phoneNumber) {
        return {
          success: false,
          verified: false,
          message: 'WhatsApp Phone Number is missing'
        };
      }

      if (!businessAccountId) {
        return {
          success: false,
          verified: false,
          message: 'WhatsApp Business Account ID is missing'
        };
      }

      // Test WhatsApp Business API by fetching phone number info
      // Using Graph API v18.0 to verify phone number access
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumber}?access_token=${accessToken}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChannelService] WhatsApp API verification failed:', errorText);

        // Update error tracking
        await this.updateChannelError(channel.id, {
          timestamp: nowISO(),
          errorType: 'verification_failed',
          errorMessage: `WhatsApp API returned ${response.status}: ${errorText}`,
          retryAttempt: (channel.errorCount || 0) + 1
        });

        return {
          success: false,
          verified: false,
          message: `WhatsApp API verification failed: ${response.status} ${response.statusText}`
        };
      }

      const verificationData = await response.json() as {
        id: string;
        display_phone_number: string;
        verified_name: string;
      };

      // Update channel as verified
      const timestamp = nowISO();
      await this.db
        .update(channelIntegrations)
        .set({
          isVerified: true,
          lastVerifiedAt: timestamp,
          errorCount: 0,
          lastError: null,
          updatedAt: timestamp
        })
        .where(eq(channelIntegrations.id, channel.id));

      console.log(`[ChannelService]  WhatsApp channel verified successfully: ${channel.id}`);

      return {
        success: true,
        verified: true,
        message: 'WhatsApp channel verified successfully',
        details: {
          phoneNumberId: verificationData.id,
          displayPhoneNumber: verificationData.display_phone_number,
          verifiedName: verificationData.verified_name,
          lastVerifiedAt: timestamp
        }
      };

    } catch (error) {
      console.error('[ChannelService] Error verifying WhatsApp channel:', error);

      // Update error tracking
      await this.updateChannelError(channel.id, {
        timestamp: nowISO(),
        errorType: 'verification_error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryAttempt: (channel.errorCount || 0) + 1,
        context: { platform: 'whatsapp' }
      });

      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : 'Verification failed',
        error: error instanceof Error ? error.stack : undefined
      };
    }
  }

  /**
   * Update channel error tracking
   */
  private async updateChannelError(channelId: number, error: {
    timestamp: string;
    errorType: string;
    errorMessage: string;
    retryAttempt: number;
    context?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.db
        .update(channelIntegrations)
        .set({
          lastError: JSON.stringify(error),
          errorCount: error.retryAttempt,
          updatedAt: nowISO()
        })
        .where(eq(channelIntegrations.id, channelId));
    } catch (updateError) {
      console.error('[ChannelService] Failed to update error tracking:', updateError);
    }
  }

  /**
   * Get channel by ID
   */
  async getChannel(channelId: number): Promise<ChannelIntegration | null> {
    try {
      const [channel] = await this.db
        .select()
        .from(channelIntegrations)
        .where(eq(channelIntegrations.id, channelId))
        .limit(1);

      return channel || null;
    } catch (error) {
      console.error('[ChannelService] Error getting channel:', error);
      return null;
    }
  }

  /**
   * Get channels by team
   * teamId is optional - if undefined, returns all channels (admin access)
   */
  async getChannelsByTeam(teamId?: number, platform?: ChannelPlatform): Promise<ChannelIntegration[]> {
    try {
      const conditions = [];

      if (teamId !== undefined) {
        conditions.push(eq(channelIntegrations.teamId, teamId));
      }

      if (platform) {
        conditions.push(eq(channelIntegrations.platform, platform));
      }

      const channels = await this.db
        .select()
        .from(channelIntegrations)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(channelIntegrations.createdAt));

      return channels;
    } catch (error) {
      console.error('[ChannelService] Error getting channels by team:', error);
      return [];
    }
  }

  /**
   * Update channel configuration
   */
  async updateChannel(request: ChannelUpdateRequest): Promise<ChannelConfigResponse> {
    try {
      console.log(`[ChannelService] Updating channel ${request.channelId}`);

      const channel = await this.getChannel(request.channelId);

      if (!channel) {
        return {
          success: false,
          error: 'Channel not found'
        };
      }

      const updateData: Partial<NewChannelIntegration> = {
        updatedAt: nowISO()
      };

      // Track whether credentials changed (for any platform)
      let credentialsChanged = false;

      // Existing JSON column values (for merging)
      const existingConfig = parseChannelConfig(channel.config);
      const existingWebhookConfig = parseChannelWebhookConfig(channel.webhookConfig);
      const existingStats = parseChannelStats(channel.stats);
      const newConfig = { ...existingConfig };
      let newCredentials: ChannelCredentials = {};
      const newWebhookConfig = { ...existingWebhookConfig };

      // Get existing decrypted credentials for merging
      const existingCreds = await this.getDecryptedCredentials(channel);

      // Update platform-specific config (JSON columns only)
      if (request.lineConfig && channel.platform === 'line') {
        if (request.lineConfig.channelId) {
          newConfig.channelId = request.lineConfig.channelId;
        }
        if (request.lineConfig.channelAccessToken) {
          credentialsChanged = true;
        }
        if (request.lineConfig.channelSecret) {
          credentialsChanged = true;
        }

        newCredentials = {
          accessToken: request.lineConfig.channelAccessToken || existingCreds.accessToken,
          secret: request.lineConfig.channelSecret || existingCreds.secret
        };
      }

      if (request.facebookConfig && channel.platform === 'facebook') {
        if (request.facebookConfig.pageId) {
          newConfig.pageId = request.facebookConfig.pageId;
        }
        if (request.facebookConfig.accessToken) {
          credentialsChanged = true;
        }
        if (request.facebookConfig.appSecret) {
          credentialsChanged = true;
        }

        newCredentials = {
          accessToken: request.facebookConfig.accessToken || existingCreds.accessToken,
          appSecret: request.facebookConfig.appSecret || existingCreds.appSecret
        };
      }

      if (request.whatsappConfig && channel.platform === 'whatsapp') {
        if (request.whatsappConfig.phoneNumber) {
          newConfig.phoneNumber = request.whatsappConfig.phoneNumber;
        }
        if (request.whatsappConfig.businessAccountId) {
          newConfig.businessAccountId = request.whatsappConfig.businessAccountId;
        }
        if (request.whatsappConfig.accessToken) {
          credentialsChanged = true;
        }

        newCredentials = {
          accessToken: request.whatsappConfig.accessToken || existingCreds.accessToken
        };
      }

      // Update JSON columns (dual-write)
      const hasConfigChange = request.lineConfig || request.facebookConfig || request.whatsappConfig;
      if (hasConfigChange) {
        // If no new credentials provided, keep existing
        if (!newCredentials.accessToken && !newCredentials.secret && !newCredentials.appSecret) {
          newCredentials = existingCreds;
        }

        const jsonColumns = await this.buildJsonColumns(
          channel.platform as ChannelPlatform,
          newConfig,
          newCredentials,
          newWebhookConfig,
          existingStats
        );
        updateData.config = jsonColumns.config;
        updateData.credentials = jsonColumns.credentials;
        updateData.webhookConfig = jsonColumns.webhookConfig;
        updateData.stats = jsonColumns.stats;
      }

      if (request.isActive !== undefined) {
        updateData.isActive = request.isActive;
      }

      if (request.configMetadata) {
        updateData.configMetadata = JSON.stringify(request.configMetadata);
      }

      // If credentials changed, mark as unverified
      if (credentialsChanged) {
        updateData.isVerified = false;
        updateData.lastVerifiedAt = null;
      }

      await this.db
        .update(channelIntegrations)
        .set(updateData)
        .where(eq(channelIntegrations.id, request.channelId));

      const updatedChannel = await this.getChannel(request.channelId);

      console.log(`[ChannelService]  Channel updated successfully: ${request.channelId}`);

      return {
        success: true,
        data: updatedChannel || undefined
      };

    } catch (error) {
      console.error('[ChannelService] Error updating channel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update channel'
      };
    }
  }

  /**
   * Deactivate channel
   */
  async deactivateChannel(channelId: number): Promise<boolean> {
    try {
      console.log(`[ChannelService] Deactivating channel ${channelId}`);

      await this.db
        .update(channelIntegrations)
        .set({
          isActive: false,
          updatedAt: nowISO()
        })
        .where(eq(channelIntegrations.id, channelId));

      console.log(`[ChannelService]  Channel deactivated: ${channelId}`);
      return true;

    } catch (error) {
      console.error('[ChannelService] Error deactivating channel:', error);
      return false;
    }
  }

  /**
   * Generate webhook URL for a channel
   */
  async generateWebhookUrl(options: WebhookUrlOptions): Promise<string> {
    const token = options.regenerateToken ? crypto.randomUUID() : '';
    return this.generateWebhookUrlInternal(options.platform, options.teamId, token);
  }

  /**
   * Internal webhook URL generation
   */
  private generateWebhookUrlInternal(platform: ChannelPlatform, teamId: number, token: string): string {
    // Use BACKEND_URL from environment, falling back to localhost for development
    const baseUrl = this.bindings.BACKEND_URL || 'http://localhost:8787';
    return `${baseUrl}/api/webhooks/${platform}/${teamId}/${token}`;
  }

  /**
   * Get channel statistics
   */
  async getChannelStatistics(channelId: number): Promise<ChannelStatistics> {
    const channel = await this.getChannel(channelId);

    if (!channel) {
      throw new Error('Channel not found');
    }

    const createdAt = new Date(channel.createdAt || nowMs());
    const now = new Date();
    const uptimeDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Read from stats JSON column
    const channelStats = parseChannelStats(channel.stats);

    return {
      channelId: channel.id,
      platform: channel.platform as ChannelPlatform,
      totalMessagesSent: channelStats.totalSent || 0,
      totalMessagesReceived: channelStats.totalReceived || 0,
      lastMessageAt: channelStats.lastMessageAt || null,
      isActive: channel.isActive || false,
      isVerified: channel.isVerified || false,
      errorCount: channel.errorCount || 0,
      uptime: {
        days: uptimeDays,
        hoursLastDay: 24 // Simplified, could track actual uptime
      }
    };
  }

  /**
   * Get channel by webhook token (for routing)
   */
  async getChannelByWebhookToken(platform: ChannelPlatform, teamId: number, token: string): Promise<ChannelIntegration | null> {
    try {
      const [channel] = await this.db
        .select()
        .from(channelIntegrations)
        .where(
          and(
            eq(channelIntegrations.teamId, teamId),
            eq(channelIntegrations.platform, platform),
            eq(channelIntegrations.isActive, true)
          )
        )
        .limit(1);

      if (!channel) {
        return null;
      }

      // Verify token matches from JSON webhookConfig
      const webhookCfg = parseChannelWebhookConfig(channel.webhookConfig);
      const tokenField = webhookCfg.token || null;

      if (tokenField !== token) {
        console.warn(`[ChannelService] Webhook token mismatch for team ${teamId}`);
        return null;
      }

      return channel;

    } catch (error) {
      console.error('[ChannelService] Error getting channel by webhook token:', error);
      return null;
    }
  }

  /**
   * Increment message counters
   */
  async incrementMessageCounter(channelId: number, direction: 'sent' | 'received'): Promise<void> {
    try {
      const channel = await this.getChannel(channelId);
      if (!channel) return;

      const now = nowISO();
      const updateData: Partial<NewChannelIntegration> = {
        updatedAt: now
      };

      // Update JSON stats column
      const currentStats = parseChannelStats(channel.stats);
      const updatedStats: ChannelStats = {
        totalSent: direction === 'sent' ? (currentStats.totalSent || 0) + 1 : (currentStats.totalSent || 0),
        totalReceived: direction === 'received' ? (currentStats.totalReceived || 0) + 1 : (currentStats.totalReceived || 0),
        lastMessageAt: now
      };
      updateData.stats = JSON.stringify(updatedStats);

      await this.db
        .update(channelIntegrations)
        .set(updateData)
        .where(eq(channelIntegrations.id, channelId));

    } catch (error) {
      console.error('[ChannelService] Error incrementing message counter:', error);
    }
  }

  /**
   * Check channel health (stub for Phase 4)
   */
  async checkChannelHealth(channelId: number): Promise<ChannelHealthStatus> {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const errorCount = channel.errorCount || 0;
    const status: 'healthy' | 'degraded' | 'down' =
      errorCount > 5 ? 'down' : errorCount > 0 ? 'degraded' : 'healthy';

    return {
      channelId: channel.id,
      platform: channel.platform as ChannelPlatform,
      status,
      lastCheckAt: nowISO(),
      consecutiveErrors: errorCount,
      lastError: channel.lastError ? JSON.parse(channel.lastError) : null,
      recommendations: []
    };
  }
}
