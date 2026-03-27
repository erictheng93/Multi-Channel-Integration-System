import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import { IPValidator, LINE_IP_RANGES, FACEBOOK_IP_RANGES } from '@/utils/ip-validator';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookSecurity');

export class WebhookSourceVerifier {
  private readonly IP_WHITELIST_ENABLED: boolean;
  private readonly ipValidator: IPValidator;

  constructor(options?: { enableIPWhitelist?: boolean }) {
    this.IP_WHITELIST_ENABLED = options?.enableIPWhitelist ?? true;
    this.ipValidator = new IPValidator([...LINE_IP_RANGES, ...FACEBOOK_IP_RANGES]);
    log.info('Source verifier initialized', { ipWhitelist: this.IP_WHITELIST_ENABLED ? 'ENABLED' : 'DISABLED' });
    log.info('IP ranges loaded', { total: this.ipValidator.getTotalRanges(), line: LINE_IP_RANGES.length, facebook: FACEBOOK_IP_RANGES.length });
  }

  async verifySource(platform: IntegrationPlatform, sourceIP?: string, headers?: Record<string, string>): Promise<{ valid: boolean; warning?: string }> {
    try {
      if (this.IP_WHITELIST_ENABLED && sourceIP) {
        const platformForIP = platform === 'instagram' ? 'facebook' : platform;
        const isAllowed = this.ipValidator.isAllowed(sourceIP, platformForIP);
        if (!isAllowed) { log.warn('IP not in platform whitelist - REJECTED', { sourceIP, platform }); return { valid: false, warning: `IP address ${sourceIP} not in ${platform} official IP ranges` }; }
        log.debug('IP validated for platform', { sourceIP, platform });
      } else if (this.IP_WHITELIST_ENABLED && !sourceIP) {
        log.warn('IP whitelist enabled but no source IP provided', { platform });
        return { valid: true, warning: 'IP whitelist enabled but source IP not available' };
      }
      if (headers) {
        const userAgent = headers['user-agent'] || headers['User-Agent'] || '';
        switch (platform) {
          case 'line': if (!userAgent.includes('LineBotWebhook')) return { valid: true, warning: 'Unexpected User-Agent for LINE webhook' }; break;
          case 'facebook': case 'instagram': if (!userAgent.includes('facebookplatform') && !userAgent.includes('Instagram')) return { valid: true, warning: 'Unexpected User-Agent for Facebook/Instagram webhook' }; break;
        }
      }
      return { valid: true };
    } catch (error) {
      log.error('Source verification error', {}, error instanceof Error ? error : new Error(String(error)));
      return { valid: true, warning: 'Source verification encountered an error' };
    }
  }
}
