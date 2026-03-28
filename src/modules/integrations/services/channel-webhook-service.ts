import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { channelIntegrations } from '@/db/schema';
import type { Bindings } from '@/types';
import type { ChannelPlatform, ChannelIntegration, WebhookUrlOptions } from '../types/channel-types';
import { parseChannelWebhookConfig } from '../types/channel-types';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('ChannelWebhook');

export class ChannelWebhookService {
  constructor(private db: DrizzleD1Database, private bindings: Bindings) {}

  async generateWebhookUrl(options: WebhookUrlOptions): Promise<string> {
    const token = options.regenerateToken ? crypto.randomUUID() : '';
    return this.generateWebhookUrlInternal(options.platform, options.teamId, token);
  }

  generateWebhookUrlInternal(platform: ChannelPlatform, teamId: number, token: string): string {
    const baseUrl = this.bindings.BACKEND_URL || 'http://localhost:8787';
    return `${baseUrl}/api/webhooks/${platform}/${teamId}/${token}`;
  }

  async getChannelByWebhookToken(platform: ChannelPlatform, teamId: number, token: string): Promise<ChannelIntegration | null> {
    try {
      const [channel] = await this.db.select().from(channelIntegrations).where(and(eq(channelIntegrations.teamId, teamId), eq(channelIntegrations.platform, platform), eq(channelIntegrations.isActive, true))).limit(1);
      if (!channel) return null;
      const webhookCfg = parseChannelWebhookConfig(channel.webhookConfig);
      const tokenField = webhookCfg.token || null;
      if (tokenField !== token) {
        log.warn(`Webhook token mismatch for team ${teamId}`);
        return null;
      }
      return channel;
    } catch (error) {
      log.error('Error getting channel by webhook token', {}, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }
}
