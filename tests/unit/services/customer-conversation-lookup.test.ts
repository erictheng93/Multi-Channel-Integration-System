// customer-conversation-lookup: deterministic "one conversation per customer" selection
import { describe, it, expect, vi } from 'vitest';

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  desc: (col: unknown) => ({ type: 'desc', col }),
  sql: (strings: TemplateStringsArray) => ({ type: 'sql', text: strings.join('?') }),
}));

vi.mock('@/db/schema', () => ({
  conversations: {
    id: { name: 'id' },
    customerId: { name: 'customerId' },
    status: { name: 'status' },
    lastMessageAt: { name: 'lastMessageAt' },
    createdAt: { name: 'createdAt' },
  },
}));

import { findCustomerConversation, getReopenStatus } from '@/services/customer-conversation-lookup';

describe('findCustomerConversation', () => {
  it('orders non-closed rows before closed ones, then newest activity, and takes one row', async () => {
    const chain: Record<string, any> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.get = vi.fn().mockResolvedValue({ id: 'live' });
    const db = { select: vi.fn(() => chain) };

    const row = await findCustomerConversation(db as any, 7);

    expect(row).toEqual({ id: 'live' });
    const orderArgs = chain.orderBy.mock.calls[0];
    expect(orderArgs).toHaveLength(4);
    expect(orderArgs[0].type).toBe('sql');
    expect(orderArgs[0].text).toContain("CASE WHEN");
    expect(orderArgs[0].text).toContain("'closed' THEN 1 ELSE 0");
    expect(orderArgs.slice(1).map((o: any) => o.col.name)).toEqual(['lastMessageAt', 'createdAt', 'id']);
    expect(chain.limit).toHaveBeenCalledWith(1);
  });
});

describe('getReopenStatus', () => {
  it('returns null for a conversation that is not closed', () => {
    expect(getReopenStatus('active', true)).toBeNull();
    expect(getReopenStatus('assigned', false)).toBeNull();
    expect(getReopenStatus(null, true)).toBeNull();
  });
  it('reopens a closed conversation to assigned with a team, else active', () => {
    expect(getReopenStatus('closed', true)).toBe('assigned');
    expect(getReopenStatus('closed', false)).toBe('active');
  });
});
