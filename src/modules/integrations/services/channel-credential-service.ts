import type { Bindings } from '@/types';
import { getEncryptionService, type EncryptedData } from '@/services/encryption-service';
import type { ChannelPlatform, ChannelConfig, ChannelCredentials, ChannelWebhookConfig, ChannelStats } from '../types/channel-types';

export class ChannelCredentialService {
  constructor(private bindings: Bindings) {}

  async decryptField(encryptedValue: string | null | undefined): Promise<string | null> {
    if (!encryptedValue) return null;
    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedValue);
      if (encryptedData.encrypted && encryptedData.iv && encryptedData.tag) {
        const encryptionService = await getEncryptionService(this.bindings.ENCRYPTION_KEY);
        return await encryptionService.decrypt(encryptedData);
      }
      return encryptedValue;
    } catch {
      return encryptedValue;
    }
  }

  async buildJsonColumns(_platform: ChannelPlatform, config: ChannelConfig, credentials: ChannelCredentials, webhookConfig: ChannelWebhookConfig, stats?: ChannelStats): Promise<{ config: string; credentials: string; webhookConfig: string; stats: string }> {
    const encryptionService = await getEncryptionService(this.bindings.ENCRYPTION_KEY);
    const credentialsPlaintext = JSON.stringify(credentials);
    const encryptedCredentials = await encryptionService.encrypt(credentialsPlaintext);
    return { config: JSON.stringify(config), credentials: JSON.stringify(encryptedCredentials), webhookConfig: JSON.stringify(webhookConfig), stats: JSON.stringify(stats || { totalSent: 0, totalReceived: 0 }) };
  }

  async decryptCredentials(credentialsJson: string | null | undefined): Promise<ChannelCredentials> {
    if (!credentialsJson) return {};
    try {
      const parsed = JSON.parse(credentialsJson);
      if (parsed.encrypted && parsed.iv && parsed.tag) {
        const encryptionService = await getEncryptionService(this.bindings.ENCRYPTION_KEY);
        const decrypted = await encryptionService.decrypt(parsed as EncryptedData);
        return JSON.parse(decrypted) as ChannelCredentials;
      }
      const result: ChannelCredentials = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') { const decrypted = await this.decryptField(value); result[key] = decrypted || undefined; }
      }
      return result;
    } catch (error) {
      console.error('[ChannelService] Failed to decrypt credentials JSON:', error);
      return {};
    }
  }

  async getDecryptedCredentials(channel: { credentials?: string | null }): Promise<ChannelCredentials> {
    if (channel.credentials) return await this.decryptCredentials(channel.credentials);
    return {};
  }
}
