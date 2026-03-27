import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import type { RateLimitResult } from './webhook-security-types';
import { nowISO, nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookSecurity');

export class WebhookRateLimiter {
  private readonly RATE_LIMIT_PER_INTEGRATION = 100;
  private readonly RATE_LIMIT_GLOBAL = 500;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000;
  constructor(private cache: KVNamespace) {}

  async enforceRateLimit(integrationId: string, platform: IntegrationPlatform): Promise<RateLimitResult> {
    try {
      const now = nowMs();
      const windowStart = Math.floor(now / this.RATE_LIMIT_WINDOW_MS) * this.RATE_LIMIT_WINDOW_MS;
      const integrationKey = `rate_limit:integration:${integrationId}`;
      const integrationCount = await this.incrementRateLimitCounter(integrationKey, windowStart);
      if (integrationCount > this.RATE_LIMIT_PER_INTEGRATION) return { allowed: false, current: integrationCount, limit: this.RATE_LIMIT_PER_INTEGRATION, resetAt: new Date(now + this.RATE_LIMIT_WINDOW_MS).toISOString(), retryAfterMs: this.RATE_LIMIT_WINDOW_MS };
      const globalKey = `rate_limit:global:${platform}`;
      const globalCount = await this.incrementRateLimitCounter(globalKey, windowStart);
      if (globalCount > this.RATE_LIMIT_GLOBAL) return { allowed: false, current: globalCount, limit: this.RATE_LIMIT_GLOBAL, resetAt: new Date(now + this.RATE_LIMIT_WINDOW_MS).toISOString(), retryAfterMs: this.RATE_LIMIT_WINDOW_MS };
      return { allowed: true, current: integrationCount, limit: this.RATE_LIMIT_PER_INTEGRATION, resetAt: new Date(now + this.RATE_LIMIT_WINDOW_MS).toISOString() };
    } catch (error) {
      log.error('Rate limit check error', {}, error instanceof Error ? error : new Error(String(error)));
      return { allowed: true, current: 0, limit: this.RATE_LIMIT_PER_INTEGRATION, resetAt: nowISO() };
    }
  }

  private async incrementRateLimitCounter(key: string, windowStart: number): Promise<number> {
    try {
      const cached = await this.cache.get(key, 'json') as { count: number; windowStart: number } | null;
      if (cached && cached.windowStart === windowStart) {
        const updated = { count: cached.count + 1, windowStart };
        await this.cache.put(key, JSON.stringify(updated), { expirationTtl: Math.ceil(this.RATE_LIMIT_WINDOW_MS / 1000) + 10 });
        return updated.count;
      }
      const newData = { count: 1, windowStart };
      await this.cache.put(key, JSON.stringify(newData), { expirationTtl: Math.ceil(this.RATE_LIMIT_WINDOW_MS / 1000) + 10 });
      return 1;
    } catch (error) { log.error('Rate limit counter error', {}, error instanceof Error ? error : new Error(String(error))); return 0; }
  }

  async clearRateLimit(integrationId: string): Promise<boolean> {
    try { const key = `rate_limit:integration:${integrationId}`; await this.cache.delete(key); return true; }
    catch (error) { log.error('Failed to clear rate limit', {}, error instanceof Error ? error : new Error(String(error))); return false; }
  }
}
