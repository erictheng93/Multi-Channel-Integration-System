import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { channelIntegrations } from '@/db/schema';
import type { ChannelIntegration, ChannelVerificationResponse } from '../types/channel-types';
import { parseChannelConfig, parseChannelWebhookConfig } from '../types/channel-types';
import { nowISO } from '@/utils/timestamp';
import type { ChannelCredentialService } from './channel-credential-service';

export class ChannelVerificationService {
  constructor(private db: DrizzleD1Database, private credentialService: ChannelCredentialService) {}

  async verifyChannel(channel: ChannelIntegration, testMessage?: string): Promise<ChannelVerificationResponse> {
    if (!channel.isActive) return { success: false, verified: false, message: 'Channel is not active' };
    if (channel.platform === 'line') return await this.verifyLineChannel(channel, testMessage);
    if (channel.platform === 'facebook') return await this.verifyFacebookChannel(channel, testMessage);
    if (channel.platform === 'whatsapp') return await this.verifyWhatsAppChannel(channel, testMessage);
    return { success: false, verified: false, message: `Platform ${channel.platform} verification not supported` };
  }

  async verifyLineChannel(channel: ChannelIntegration, _testMessage?: string): Promise<ChannelVerificationResponse> {
    try {
      const creds = await this.credentialService.getDecryptedCredentials(channel);
      const accessToken = creds.accessToken;
      if (!accessToken) return { success: false, verified: false, message: 'LINE Channel Access Token is missing' };
      const response = await fetch('https://api.line.me/v2/oauth/verify', { method: 'GET', headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChannelService] LINE API verification failed:', errorText);
        await this.updateChannelError(channel.id, { timestamp: nowISO(), errorType: 'verification_failed', errorMessage: `LINE API returned ${response.status}: ${errorText}`, retryAttempt: (channel.errorCount || 0) + 1 });
        return { success: false, verified: false, message: `LINE API verification failed: ${response.status} ${response.statusText}` };
      }
      const verificationData = await response.json() as { client_id: string; expires_in: number };
      const timestamp = nowISO();
      await this.db.update(channelIntegrations).set({ isVerified: true, lastVerifiedAt: timestamp, errorCount: 0, lastError: null, updatedAt: timestamp }).where(eq(channelIntegrations.id, channel.id));
      console.log(`[ChannelService]  LINE channel verified successfully: ${channel.id}`);
      return { success: true, verified: true, message: 'LINE channel verified successfully', details: { channelId: verificationData.client_id, webhookUrl: parseChannelWebhookConfig(channel.webhookConfig).url || undefined, lastVerifiedAt: timestamp } };
    } catch (error) {
      console.error('[ChannelService] Error verifying LINE channel:', error);
      await this.updateChannelError(channel.id, { timestamp: nowISO(), errorType: 'verification_error', errorMessage: error instanceof Error ? error.message : 'Unknown error', retryAttempt: (channel.errorCount || 0) + 1, context: { stack: error instanceof Error ? error.stack : undefined } });
      return { success: false, verified: false, message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error.stack : undefined };
    }
  }

  async verifyFacebookChannel(channel: ChannelIntegration, _testMessage?: string): Promise<ChannelVerificationResponse> {
    try {
      const creds = await this.credentialService.getDecryptedCredentials(channel);
      const accessToken = creds.accessToken;
      if (!accessToken) return { success: false, verified: false, message: 'Facebook Access Token is missing' };
      const config = parseChannelConfig(channel.config);
      const pageId = config.pageId;
      if (!pageId) return { success: false, verified: false, message: 'Facebook Page ID is missing' };
      const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChannelService] Facebook API verification failed:', errorText);
        await this.updateChannelError(channel.id, { timestamp: nowISO(), errorType: 'verification_failed', errorMessage: `Facebook API returned ${response.status}: ${errorText}`, retryAttempt: (channel.errorCount || 0) + 1 });
        return { success: false, verified: false, message: `Facebook API verification failed: ${response.status} ${response.statusText}` };
      }
      const verificationData = await response.json() as { id: string; name: string };
      const timestamp = nowISO();
      await this.db.update(channelIntegrations).set({ isVerified: true, lastVerifiedAt: timestamp, errorCount: 0, lastError: null, updatedAt: timestamp }).where(eq(channelIntegrations.id, channel.id));
      console.log(`[ChannelService]  Facebook channel verified successfully: ${channel.id}`);
      return { success: true, verified: true, message: 'Facebook channel verified successfully', details: { pageId: verificationData.id, pageName: verificationData.name, lastVerifiedAt: timestamp } };
    } catch (error) {
      console.error('[ChannelService] Error verifying Facebook channel:', error);
      await this.updateChannelError(channel.id, { timestamp: nowISO(), errorType: 'verification_error', errorMessage: error instanceof Error ? error.message : 'Unknown error', retryAttempt: (channel.errorCount || 0) + 1, context: { platform: 'facebook' } });
      return { success: false, verified: false, message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error.stack : undefined };
    }
  }

  async verifyWhatsAppChannel(channel: ChannelIntegration, _testMessage?: string): Promise<ChannelVerificationResponse> {
    try {
      const waCreds = await this.credentialService.getDecryptedCredentials(channel);
      const accessToken = waCreds.accessToken;
      if (!accessToken) return { success: false, verified: false, message: 'WhatsApp Access Token is missing' };
      const waConfig = parseChannelConfig(channel.config);
      if (!waConfig.phoneNumber) return { success: false, verified: false, message: 'WhatsApp Phone Number is missing' };
      if (!waConfig.businessAccountId) return { success: false, verified: false, message: 'WhatsApp Business Account ID is missing' };
      const response = await fetch(`https://graph.facebook.com/v18.0/${waConfig.phoneNumber}?access_token=${accessToken}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ChannelService] WhatsApp API verification failed:', errorText);
        await this.updateChannelError(channel.id, { timestamp: nowISO(), errorType: 'verification_failed', errorMessage: `WhatsApp API returned ${response.status}: ${errorText}`, retryAttempt: (channel.errorCount || 0) + 1 });
        return { success: false, verified: false, message: `WhatsApp API verification failed: ${response.status} ${response.statusText}` };
      }
      const verificationData = await response.json() as { id: string; display_phone_number: string; verified_name: string };
      const timestamp = nowISO();
      await this.db.update(channelIntegrations).set({ isVerified: true, lastVerifiedAt: timestamp, errorCount: 0, lastError: null, updatedAt: timestamp }).where(eq(channelIntegrations.id, channel.id));
      console.log(`[ChannelService]  WhatsApp channel verified successfully: ${channel.id}`);
      return { success: true, verified: true, message: 'WhatsApp channel verified successfully', details: { phoneNumberId: verificationData.id, displayPhoneNumber: verificationData.display_phone_number, verifiedName: verificationData.verified_name, lastVerifiedAt: timestamp } };
    } catch (error) {
      console.error('[ChannelService] Error verifying WhatsApp channel:', error);
      await this.updateChannelError(channel.id, { timestamp: nowISO(), errorType: 'verification_error', errorMessage: error instanceof Error ? error.message : 'Unknown error', retryAttempt: (channel.errorCount || 0) + 1, context: { platform: 'whatsapp' } });
      return { success: false, verified: false, message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error.stack : undefined };
    }
  }

  async updateChannelError(channelId: number, error: { timestamp: string; errorType: string; errorMessage: string; retryAttempt: number; context?: Record<string, unknown> }): Promise<void> {
    try { await this.db.update(channelIntegrations).set({ lastError: JSON.stringify(error), errorCount: error.retryAttempt, updatedAt: nowISO() }).where(eq(channelIntegrations.id, channelId)); }
    catch (updateError) { console.error('[ChannelService] Failed to update error tracking:', updateError); }
  }
}
