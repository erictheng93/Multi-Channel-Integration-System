// processLineFollowEvent: a closed conversation selected for reuse must be reopened
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => ({ type: 'eq', a }),
  and: (...a: unknown[]) => ({ type: 'and', a }),
  desc: (c: unknown) => ({ type: 'desc', c }),
  isNull: (c: unknown) => ({ type: 'isNull', c }),
}));

vi.mock('@/db/schema', () => {
  const t = (name: string) => ({ __t: name });
  return {
    customers: { __t: 'customers', id: 'id', platformUserId: 'pu', platform: 'p', deletedAt: 'd' },
    conversations: { __t: 'conversations', id: 'id', customerId: 'cid' },
    teams: { __t: 'teams', id: 'id', name: 'name' },
    messages: t('messages'),
    customerTeamAssignments: { __t: 'assign', platformUserId: 'pu', assignedAt: 'at' },
  };
});

const updates: Array<{ table: string; set: Record<string, unknown> }> = [];
const inserts: string[] = [];
const closedRow = { id: 'conv-closed', customerId: 1, status: 'closed', assignedTeamId: null as number | null };

function selectChain() {
  let table = '';
  const chain: Record<string, any> = {};
  chain.from = (t: { __t: string }) => { table = t.__t; return chain; };
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.get = async () => {
    if (table === 'customers') return { id: 1, metadata: null };
    if (table === 'assign') return { id: 'a1', teamId: 5, source: 'x', assignedAt: 't', displayName: null };
    if (table === 'teams') return { id: 5, name: 'Team Five' };
    return undefined;
  };
  return chain;
}

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: () => ({
    select: () => selectChain(),
    insert: (t: { __t: string }) => ({ values: async () => { inserts.push(t.__t); } }),
    update: (t: { __t: string }) => ({
      set: (set: Record<string, unknown>) => ({ where: async () => { updates.push({ table: t.__t, set }); } }),
    }),
  }),
}));

vi.mock('@/services/customer-conversation-lookup', async (orig) => ({
  ...(await orig<typeof import('@/services/customer-conversation-lookup')>()),
  findCustomerConversation: vi.fn(async () => ({ ...closedRow })),
}));

const broadcastTransferred = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class {
    broadcastConversationTransferred = broadcastTransferred;
    broadcastConversationEvent = vi.fn().mockResolvedValue(undefined);
  },
}));
vi.mock('@/services/user-sync', () => ({
  createUserSyncService: () => ({ syncLineUser: async () => ({ displayName: 'Ann', pictureUrl: null }) }),
}));
vi.mock('../services/webhook-customer-service', () => ({}));
vi.mock('@/modules/integrations/services/webhook-customer-service', () => ({
  findOrCreateCustomer: vi.fn(),
  updateCustomerProfile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@modules/activities', () => ({ ActivityService: class { logActivity = vi.fn().mockResolvedValue(undefined); } }));
vi.mock('@modules/auto-reply/services/auto-reply-engine', () => ({
  evaluateWelcome: vi.fn().mockResolvedValue({ matched: true, ruleId: 1, ruleName: 'r', replyMethod: 'reply' }),
}));
vi.mock('@/utils/notification-trigger', () => ({
  triggerCustomerFollowedNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { processLineFollowEvent } from '@/modules/integrations/handlers/line-follow-handler';

describe('processLineFollowEvent closed conversation reuse', () => {
  beforeEach(() => {
    updates.length = 0;
    inserts.length = 0;
    broadcastTransferred.mockClear();
  });

  it('reopens the selected closed conversation, backfills the team and broadcasts the real status', async () => {
    await processLineFollowEvent(
      { DB: {} } as any,
      { type: 'follow', source: { userId: 'U1234567890abc', type: 'user' }, timestamp: 1, replyToken: 'rt' } as any
    );

    const convUpdates = updates.filter(u => u.table === 'conversations');
    expect(convUpdates).toHaveLength(1);
    expect(convUpdates[0].set).toMatchObject({ assignedTeamId: 5, status: 'assigned', closedAt: null });
    expect(inserts).not.toContain('conversations');
    expect(broadcastTransferred).toHaveBeenCalledTimes(1);
    expect(broadcastTransferred.mock.calls[0][0].conversation.status).toBe('assigned');
  });
});
