import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChannelVerificationService } from '@/modules/integrations/services/channel-verification-service';
import { ChannelStatsService } from '@/modules/integrations/services/channel-stats-service';

const UPSTREAM_BODY = '{"error":"invalid token sk-SECRET-UPSTREAM-DETAIL"}';

function setup() {
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const db = { update: vi.fn(() => ({ set })) };
  const credentialService = { getDecryptedCredentials: vi.fn(async () => ({ accessToken: 'TOKEN-IN-URL' })) };
  const service = new ChannelVerificationService(db as never, credentialService as never);
  return { service, set };
}

const channel = { id: 1, isActive: true, platform: 'facebook', errorCount: 0, config: JSON.stringify({ pageId: 'p1' }) } as never;

describe('channel verification errors', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  afterEach(() => fetchSpy.mockReset());

  it('does not store or return the upstream response body', async () => {
    fetchSpy.mockResolvedValue(new Response(UPSTREAM_BODY, { status: 400, statusText: 'Bad Request' }));
    const { service, set } = setup();

    const result = await service.verifyFacebookChannel(channel);

    expect(JSON.stringify(result)).not.toContain('SECRET-UPSTREAM-DETAIL');
    expect(JSON.stringify(set.mock.calls)).not.toContain('SECRET-UPSTREAM-DETAIL');
    expect(JSON.stringify(set.mock.calls)).toContain('Facebook API returned 400');
  });

  it('does not store or return thrown error text or stacks (the request URL carries the token)', async () => {
    fetchSpy.mockRejectedValue(new Error('fetch failed for https://graph.facebook.com/x?access_token=TOKEN-IN-URL'));
    const { service, set } = setup();

    const result = await service.verifyFacebookChannel(channel);

    expect(JSON.stringify(result)).not.toContain('TOKEN-IN-URL');
    expect(result).not.toHaveProperty('error');
    expect(JSON.stringify(set.mock.calls)).not.toContain('TOKEN-IN-URL');
  });

  it('health tolerates plain-text lastError written by the webhook code', async () => {
    const stats = new ChannelStatsService({} as never);
    const health = await stats.checkChannelHealth(1, async () => ({ id: 1, platform: 'line', errorCount: 1, lastError: 'boom' }) as never);
    expect(health.lastError?.errorMessage).not.toContain('boom');
  });
});
