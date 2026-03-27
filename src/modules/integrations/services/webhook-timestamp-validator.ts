import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import { nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookSecurity');

export class WebhookTimestampValidator {
  private readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

  validateTimestamp(platform: IntegrationPlatform, headers: Record<string, string>, body: Record<string, unknown>): { valid: boolean; error?: string } {
    try {
      let timestamp: number | undefined;
      switch (platform) {
        case 'line': if (body && body.events && Array.isArray(body.events) && body.events.length > 0) { timestamp = (body.events[0] as Record<string, unknown>).timestamp as number | undefined; } break;
        case 'facebook': case 'instagram': if (body && body.entry && Array.isArray(body.entry) && body.entry.length > 0) { const entry = body.entry[0] as Record<string, unknown>; if (entry.messaging && Array.isArray(entry.messaging) && entry.messaging.length > 0) { timestamp = (entry.messaging[0] as Record<string, unknown>).timestamp as number | undefined; } else { timestamp = entry.time as number | undefined; } } break;
        default: timestamp = parseInt(headers['x-timestamp'] || '') || (body?.timestamp as number | undefined);
      }
      if (!timestamp) return { valid: true };
      const now = nowMs();
      const timeDiff = Math.abs(now - timestamp);
      if (timeDiff > this.TIMESTAMP_TOLERANCE_MS) return { valid: false, error: `Timestamp outside tolerance window: ${timeDiff}ms (max ${this.TIMESTAMP_TOLERANCE_MS}ms)` };
      return { valid: true };
    } catch (error) {
      log.warn('Timestamp validation error', { error: error instanceof Error ? error.message : String(error) });
      return { valid: true };
    }
  }
}
