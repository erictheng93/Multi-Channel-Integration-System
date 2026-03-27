import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import type { ReplayCheckResult } from './webhook-security-types';
import { nowISO } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookSecurity');

export class WebhookReplayDetector {
  private readonly REQUEST_ID_TTL_SECONDS = 3600;
  constructor(private cache: KVNamespace) {}

  async checkReplayAttack(requestId: string): Promise<ReplayCheckResult> {
    try {
      const key = `webhook_request:${requestId}`;
      const cached = await this.cache.get(key, 'json') as { firstSeen: string; occurrences: number } | null;
      if (cached) {
        const updated = { firstSeen: cached.firstSeen, occurrences: cached.occurrences + 1 };
        await this.cache.put(key, JSON.stringify(updated), { expirationTtl: this.REQUEST_ID_TTL_SECONDS });
        return { isDuplicate: true, firstSeen: cached.firstSeen, occurrences: updated.occurrences };
      }
      await this.cache.put(key, JSON.stringify({ firstSeen: nowISO(), occurrences: 1 }), { expirationTtl: this.REQUEST_ID_TTL_SECONDS });
      return { isDuplicate: false, occurrences: 1 };
    } catch (error) {
      log.error('Replay check error', {}, error instanceof Error ? error : new Error(String(error)));
      return { isDuplicate: false, occurrences: 1 };
    }
  }

  extractRequestId(platform: IntegrationPlatform, headers: Record<string, string>, body: Record<string, unknown>): string | undefined {
    const requestIdHeader = headers['x-request-id'] || headers['X-Request-Id'];
    if (requestIdHeader) return requestIdHeader;
    switch (platform) {
      case 'line': if (body && body.events && Array.isArray(body.events) && body.events.length > 0) { const event = body.events[0] as Record<string, unknown>; return `line_${body.destination}_${event.timestamp}_${event.type}`; } break;
      case 'facebook': case 'instagram': if (body && body.entry && Array.isArray(body.entry) && body.entry.length > 0) { const entry = body.entry[0] as Record<string, unknown>; if (entry.messaging && Array.isArray(entry.messaging) && entry.messaging.length > 0) { const messaging = entry.messaging[0] as Record<string, unknown>; if (messaging.message && (messaging.message as Record<string, unknown>).mid) return `fb_${(messaging.message as Record<string, unknown>).mid}`; } return `fb_${entry.id}_${entry.time}`; } break;
    }
    return undefined;
  }
}
