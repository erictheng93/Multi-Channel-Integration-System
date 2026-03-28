// Channel Integration Service
// Thin orchestrator delegating to sub-services for credentials, verification, webhooks, and stats

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { channelIntegrations } from '@/db/schema';
import type { Bindings } from '@/types';
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
  ChannelWebhookConfig
} from '../types/channel-types';
import {
  parseChannelConfig,
  parseChannelWebhookConfig,
  parseChannelStats
} from '../types/channel-types';
import { nowISO } from '@/utils/timestamp';
import { ChannelCredentialService } from './channel-credential-service';
import { ChannelVerificationService } from './channel-verification-service';
import { ChannelWebhookService } from './channel-webhook-service';
import { ChannelStatsService } from './channel-stats-service';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('ChannelService');

export class ChannelService implements IChannelIntegrationService {
  private db: DrizzleD1Database;
  private credentialService: ChannelCredentialService;
  private verificationService: ChannelVerificationService;
  private webhookService: ChannelWebhookService;
  private statsService: ChannelStatsService;

  constructor(bindings: Bindings) {
    this.db = drizzle(bindings.DB);
    this.credentialService = new ChannelCredentialService(bindings);
    this.verificationService = new ChannelVerificationService(this.db, this.credentialService);
    this.webhookService = new ChannelWebhookService(this.db, bindings);
    this.statsService = new ChannelStatsService(this.db);
  }

  // ── Credential delegation ──────────────────────────────────────────

  async getDecryptedCredentials(channel: ChannelIntegration): Promise<ChannelCredentials> {
    return this.credentialService.getDecryptedCredentials(channel);
  }

  // ── Verification delegation ────────────────────────────────────────

  async verifyChannel(request: ChannelVerificationRequest): Promise<ChannelVerificationResponse> {
    try {
      log.info(`Verifying channel ${request.channelId}`);

      const channel = await this.getChannel(request.channelId);
      if (!channel) {
        return { success: false, verified: false, message: 'Channel not found' };
      }

      return await this.verificationService.verifyChannel(channel, request.testMessage);
    } catch (error) {
      log.error('Error verifying channel', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        verified: false,
        message: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  // ── Webhook delegation ─────────────────────────────────────────────

  async generateWebhookUrl(options: WebhookUrlOptions): Promise<string> {
    return this.webhookService.generateWebhookUrl(options);
  }

  async getChannelByWebhookToken(platform: ChannelPlatform, teamId: number, token: string): Promise<ChannelIntegration | null> {
    return this.webhookService.getChannelByWebhookToken(platform, teamId, token);
  }

  // ── Stats delegation ───────────────────────────────────────────────

  async getChannelStatistics(channelId: number): Promise<ChannelStatistics> {
    return this.statsService.getChannelStatistics(channelId, (id) => this.getChannel(id));
  }

  async incrementMessageCounter(channelId: number, direction: 'sent' | 'received'): Promise<void> {
    return this.statsService.incrementMessageCounter(channelId, direction, (id) => this.getChannel(id));
  }

  async checkChannelHealth(channelId: number): Promise<ChannelHealthStatus> {
    return this.statsService.checkChannelHealth(channelId, (id) => this.getChannel(id));
  }

  // ── CRUD methods (kept in orchestrator) ────────────────────────────

  async createChannel(request: ChannelConfigRequest): Promise<ChannelConfigResponse> {
    try {
      log.info(`Creating ${request.platform} channel for team ${request.teamId}`);

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
      const webhookUrl = this.webhookService.generateWebhookUrlInternal(request.platform, request.teamId, webhookToken);

      // Prepare channel data based on platform
      const channelData: NewChannelIntegration = {
        teamId: request.teamId,
        platform: request.platform,
        configuredBy: undefined,
        isActive: true,
        isVerified: false,
        createdAt: nowISO(),
        updatedAt: nowISO()
      };

      // Add platform-specific configuration
      let jsonConfig: ChannelConfig = {};
      let jsonCredentials: ChannelCredentials = {};
      const jsonWebhookConfig: ChannelWebhookConfig = { url: webhookUrl, token: webhookToken };

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

      // Build and assign JSON columns
      const jsonColumns = await this.credentialService.buildJsonColumns(
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

      log.info(`Channel created successfully: ${createdChannel.id}`);

      return {
        success: true,
        data: createdChannel,
        webhookUrl
      };

    } catch (error) {
      log.error('Error creating channel', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create channel'
      };
    }
  }

  async getChannel(channelId: number): Promise<ChannelIntegration | null> {
    try {
      const [channel] = await this.db
        .select()
        .from(channelIntegrations)
        .where(eq(channelIntegrations.id, channelId))
        .limit(1);

      return channel || null;
    } catch (error) {
      log.error('Error getting channel', {}, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

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
      log.error('Error getting channels by team', {}, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async updateChannel(request: ChannelUpdateRequest): Promise<ChannelConfigResponse> {
    try {
      log.info(`Updating channel ${request.channelId}`);

      const channel = await this.getChannel(request.channelId);
      if (!channel) {
        return { success: false, error: 'Channel not found' };
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
      const existingCreds = await this.credentialService.getDecryptedCredentials(channel);

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

      // Update JSON columns
      const hasConfigChange = request.lineConfig || request.facebookConfig || request.whatsappConfig;
      if (hasConfigChange) {
        // If no new credentials provided, keep existing
        if (!newCredentials.accessToken && !newCredentials.secret && !newCredentials.appSecret) {
          newCredentials = existingCreds;
        }

        const jsonColumns = await this.credentialService.buildJsonColumns(
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

      log.info(`Channel updated successfully: ${request.channelId}`);

      return {
        success: true,
        data: updatedChannel || undefined
      };

    } catch (error) {
      log.error('Error updating channel', {}, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update channel'
      };
    }
  }

  async deactivateChannel(channelId: number): Promise<boolean> {
    try {
      log.info(`Deactivating channel ${channelId}`);

      await this.db
        .update(channelIntegrations)
        .set({
          isActive: false,
          updatedAt: nowISO()
        })
        .where(eq(channelIntegrations.id, channelId));

      log.info(`Channel deactivated: ${channelId}`);
      return true;

    } catch (error) {
      log.error('Error deactivating channel', {}, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}
