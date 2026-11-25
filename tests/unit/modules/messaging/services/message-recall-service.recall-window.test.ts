import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

type SelectResult = Record<string, unknown> | undefined;

const serviceMocks = vi.hoisted(() => ({
  selectResults: [] as SelectResult[],
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  insertValues: vi.fn(),
  fetch: vi.fn(),
  getDecryptedCredentials: vi.fn(),
}));

function nextSelectResult(): SelectResult {
  return serviceMocks.selectResults.shift();
}

function makeSelectChain() {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    get: vi.fn(async () => nextSelectResult()),
  };
  return chain;
}

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => makeSelectChain()),
    update: vi.fn(() => ({
      set: serviceMocks.updateSet,
    })),
    insert: vi.fn(() => ({
      values: serviceMocks.insertValues,
    })),
  })),
}));

vi.mock('@/modules/integrations/services/channel-credential-service', () => ({
  ChannelCredentialService: vi.fn(function () {
    return {
      getDecryptedCredentials: serviceMocks.getDecryptedCredentials,
    };
  }),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { MessageRecallService } from '@/modules/messaging/services/message-recall-service';

function makeEnv(): Bindings {
  return {
    DB: {},
  } as unknown as Bindings;
}

describe('MessageRecallService recall-window platform branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.selectResults = [];
    serviceMocks.updateSet.mockReturnValue({ where: serviceMocks.updateWhere });
    serviceMocks.updateWhere.mockResolvedValue(undefined);
    serviceMocks.insertValues.mockResolvedValue(undefined);
    serviceMocks.getDecryptedCredentials.mockResolvedValue({ accessToken: 'fb-token' });
    serviceMocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = serviceMocks.fetch;
  });

  it('deletes already-delivered Facebook messages through the Graph API after DB recall', async () => {
    serviceMocks.selectResults = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        platformMessageId: 'fb-message-1',
        senderType: 'agent',
        isRecalled: false,
        recallDeadline: '2027-01-15T12:01:00Z',
      },
      { customerId: 'customer-1', assignedTeamId: 7 },
      { platform: 'facebook', platformUserId: 'fb-user-1' },
      { credentials: '{"accessToken":"encrypted"}' },
    ];

    const result = await new MessageRecallService(
      makeEnv().DB,
      makeEnv()
    ).recallMessage('msg-1', 'agent-1');

    expect(result.success).toBe(true);
    expect(serviceMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      isRecalled: true,
    }));
    expect(serviceMocks.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v18.0/fb-message-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer fb-token',
        },
      })
    );
  });

  const expired = {
    id: 'msg-2',
    conversationId: 'conv-1',
    platformMessageId: null,
    senderType: 'agent',
    isRecalled: false,
    recallDeadline: '2020-01-01T00:00:00Z',
  };

  it('refuses a recall past its deadline without touching the row', async () => {
    serviceMocks.selectResults = [expired];

    const result = await new MessageRecallService(makeEnv().DB, makeEnv()).recallMessage('msg-2', 'agent-1');

    expect(result).toMatchObject({ success: false, error: 'Recall deadline exceeded' });
    expect(serviceMocks.updateSet).not.toHaveBeenCalled();
    expect(serviceMocks.insertValues).not.toHaveBeenCalled();
  });

  it('skips the deadline check when the scheduler DO already cancelled the send', async () => {
    serviceMocks.selectResults = [expired, { customerId: 'customer-1', assignedTeamId: 7 }, { platform: 'line', platformUserId: 'U1' }];

    const result = await new MessageRecallService(makeEnv().DB, makeEnv()).recallMessage('msg-2', 'agent-1', undefined, { deadlineAlreadyEnforced: true });

    expect(result.success).toBe(true);
    expect(serviceMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ isRecalled: true }));
  });
});
