/**
 * Audit W5: ConversationRoom has no live sockets, so the Worker must not wake it.
 * Conversation targets are a no-op; user/team/global targets still reach their DOs.
 */
import { describe, it, expect, vi } from 'vitest';
import { DurableObjectClient } from '@/modules/websocket/services/durable-object-client';
import type { Bindings } from '@/types';
import type { DurableObjectEvent } from '@/types/websocket-types';
import type { BroadcastConfig } from '@/modules/websocket/services/broadcast-config';
import type { WebSocketCircuitBreaker } from '@/services/websocket-circuit-breaker';

function makeNamespace() {
  const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  const get = vi.fn().mockReturnValue({ fetch });
  const idFromName = vi.fn().mockReturnValue('id');
  return { ns: { get, idFromName } as unknown as DurableObjectNamespace, get, fetch };
}

function makeClient(env: Partial<Bindings>) {
  const config = {
    getMigrationConfig: vi.fn().mockResolvedValue({
      enableWebSocket: true,
      featureFlags: { durableObjectMessaging: true }
    })
  } as unknown as BroadcastConfig;
  const breaker = {
    setEnv: vi.fn(),
    getState: vi.fn(),
    execute: async (fn: () => Promise<boolean>) => fn()
  } as unknown as WebSocketCircuitBreaker;
  return new DurableObjectClient(env as Bindings, config, breaker);
}

function makeEvent(targets: NonNullable<DurableObjectEvent['deliveryOptions']>['targets']): DurableObjectEvent {
  return {
    id: 'e1',
    type: 'message_updated',
    source: 'api',
    timestamp: 1,
    conversationId: 'c1',
    data: {},
    priority: 'normal',
    deliveryOptions: { broadcast: true, targets, persistent: false, ttl: 1000 }
  } as DurableObjectEvent;
}

describe('DurableObjectClient conversation targets (audit W5)', () => {
  it('never touches CONVERSATION_ROOM for a conversation target', async () => {
    const room = makeNamespace();
    const client = makeClient({ CONVERSATION_ROOM: room.ns });
    await client.broadcast(makeEvent([{ type: 'conversation', targets: ['c1'] }]));
    expect(room.get).not.toHaveBeenCalled();
    expect(room.fetch).not.toHaveBeenCalled();
  });

  it('broadcastToConversationRooms resolves true without a request', async () => {
    const room = makeNamespace();
    const client = makeClient({ CONVERSATION_ROOM: room.ns });
    await expect(client.broadcastToConversationRooms(makeEvent([]), ['c1'])).resolves.toBe(true);
    expect(room.fetch).not.toHaveBeenCalled();
  });

  it('still delivers the user target of a mixed event', async () => {
    const room = makeNamespace();
    const user = makeNamespace();
    const client = makeClient({ CONVERSATION_ROOM: room.ns, USER_CONNECTION: user.ns });
    await client.broadcast(makeEvent([
      { type: 'conversation', targets: ['c1'] },
      { type: 'user', targets: ['u1'] }
    ]));
    expect(room.fetch).not.toHaveBeenCalled();
    expect(user.fetch).toHaveBeenCalledTimes(1);
  });
});
