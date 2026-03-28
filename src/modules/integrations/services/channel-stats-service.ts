import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { channelIntegrations } from '@/db/schema';
import type { ChannelPlatform, ChannelIntegration, NewChannelIntegration, ChannelStatistics, ChannelHealthStatus, ChannelStats } from '../types/channel-types';
import { parseChannelStats } from '../types/channel-types';
import { nowISO, nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('ChannelStats');

export type GetChannelCallback = (channelId: number) => Promise<ChannelIntegration | null>;

export class ChannelStatsService {
  constructor(private db: DrizzleD1Database) {}

  async getChannelStatistics(channelId: number, getChannel: GetChannelCallback): Promise<ChannelStatistics> {
    const channel = await getChannel(channelId);
    if (!channel) throw new Error('Channel not found');
    const createdAt = new Date(channel.createdAt || nowMs());
    const now = new Date();
    const uptimeDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const channelStats = parseChannelStats(channel.stats);
    return {
      channelId: channel.id, platform: channel.platform as ChannelPlatform,
      totalMessagesSent: channelStats.totalSent || 0, totalMessagesReceived: channelStats.totalReceived || 0,
      lastMessageAt: channelStats.lastMessageAt || null, isActive: channel.isActive || false,
      isVerified: channel.isVerified || false, errorCount: channel.errorCount || 0,
      uptime: { days: uptimeDays, hoursLastDay: 24 }
    };
  }

  async incrementMessageCounter(channelId: number, direction: 'sent' | 'received', getChannel: GetChannelCallback): Promise<void> {
    try {
      const channel = await getChannel(channelId);
      if (!channel) return;
      const now = nowISO();
      const updateData: Partial<NewChannelIntegration> = { updatedAt: now };
      const currentStats = parseChannelStats(channel.stats);
      const updatedStats: ChannelStats = {
        totalSent: direction === 'sent' ? (currentStats.totalSent || 0) + 1 : (currentStats.totalSent || 0),
        totalReceived: direction === 'received' ? (currentStats.totalReceived || 0) + 1 : (currentStats.totalReceived || 0),
        lastMessageAt: now
      };
      updateData.stats = JSON.stringify(updatedStats);
      await this.db.update(channelIntegrations).set(updateData).where(eq(channelIntegrations.id, channelId));
    } catch (error) {
      log.error('Error incrementing message counter', {}, error instanceof Error ? error : new Error(String(error)));
    }
  }

  async checkChannelHealth(channelId: number, getChannel: GetChannelCallback): Promise<ChannelHealthStatus> {
    const channel = await getChannel(channelId);
    if (!channel) throw new Error('Channel not found');
    const errorCount = channel.errorCount || 0;
    const status: 'healthy' | 'degraded' | 'down' = errorCount > 5 ? 'down' : errorCount > 0 ? 'degraded' : 'healthy';
    return { channelId: channel.id, platform: channel.platform as ChannelPlatform, status, lastCheckAt: nowISO(), consecutiveErrors: errorCount, lastError: channel.lastError ? JSON.parse(channel.lastError) : null, recommendations: [] };
  }
}
