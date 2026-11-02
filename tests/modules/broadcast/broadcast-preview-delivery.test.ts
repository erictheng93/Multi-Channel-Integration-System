import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings, DbUser } from '@/types';
import { broadcasts, broadcastRecipients } from '@/db/schema';
import { BroadcastSenderService } from '@/modules/broadcast/services/broadcast-sender-service';
import { hashToken } from '@/modules/broadcast/services/line-quota-monitor-service';
import { createBroadcastFixture } from './broadcast-fixture';

vi.mock('@/utils/logger', () => ({ createContextLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

describe('BroadcastSenderService.previewDelivery', () => {
  let fixture: ReturnType<typeof createBroadcastFixture>;
  const agent = { id: 'agent-1', role: 'agent' } as unknown as DbUser;
  const admin = { id: 'agent-1', role: 'admin' } as unknown as DbUser;

  const makeSender = (env: Partial<Bindings>) => new BroadcastSenderService(fixture.db, env as Bindings);

  beforeEach(() => {
    fixture = createBroadcastFixture();
  });
  afterEach(() => fixture.sqlite.close());

  it('groups recipients under the system default token and exposes its channel key', async () => {
    const sender = makeSender({ LINE_CHANNEL_ACCESS_TOKEN: 'default-token' });

    const result = await sender.previewDelivery(
      [{ resolvedTeamId: null }, { resolvedTeamId: null }, { resolvedTeamId: null }],
      agent
    );

    expect(result.tokenGroups).toEqual([{ channelKey: await hashToken('default-token'), recipientCount: 3 }]);
    expect(result.noCredentialsCount).toBe(0);
    expect(JSON.stringify(result)).not.toContain('default-token');
  });

  it('counts recipients with no credentials and no system default as unsendable', async () => {
    const result = await makeSender({}).previewDelivery([{ resolvedTeamId: null }, { resolvedTeamId: null }], agent);

    expect(result.tokenGroups).toEqual([]);
    expect(result.noCredentialsCount).toBe(2);
  });

  it('returns an empty split for an empty audience', async () => {
    const result = await makeSender({ LINE_CHANNEL_ACCESS_TOKEN: 'default-token' }).previewDelivery([], agent);

    expect(result.tokenGroups).toEqual([]);
    expect(result.noCredentialsCount).toBe(0);
  });

  it('reports the per-agent daily cap with today usage and exempts admins', async () => {
    const sender = makeSender({ BROADCAST_DAILY_RECIPIENT_LIMIT_PER_AGENT: '10', LINE_CHANNEL_ACCESS_TOKEN: 't' });
    await fixture.db.insert(broadcasts).values({
      id: 'sent-today', title: 'x', content: 'x', contentType: 'text', tagIds: '[1]',
      createdBy: 'agent-1', status: 'completed', sentAt: new Date().toISOString(),
    });
    await fixture.db.insert(broadcasts).values({
      id: 'sent-last-week', title: 'x', content: 'x', contentType: 'text', tagIds: '[1]',
      createdBy: 'agent-1', status: 'completed', sentAt: '2020-01-01T00:00:00.000Z',
    });
    fixture.sqlite.exec('INSERT INTO customers (id) VALUES (1), (2), (3), (4)');
    await fixture.db.insert(broadcastRecipients).values([
      { broadcastId: 'sent-today', customerId: 1, platform: 'line', platformUserId: 'U1', status: 'sent' },
      { broadcastId: 'sent-today', customerId: 2, platform: 'line', platformUserId: 'U2', status: 'failed' },
      { broadcastId: 'sent-today', customerId: 3, platform: 'line', platformUserId: 'U3', status: 'skipped' },
      { broadcastId: 'sent-last-week', customerId: 4, platform: 'line', platformUserId: 'U4', status: 'sent' },
    ]);

    expect((await sender.previewDelivery([], agent)).dailyCap).toEqual({ limit: 10, used: 2, remaining: 8 });
    expect((await sender.previewDelivery([], admin)).dailyCap).toBeNull();
  });
});
