// MessageService: the live paths used by POST /api/conversations/:id/messages
// (createPendingMessage, processBackgroundSending, MessageRequestService.validateAndParse).
// createPendingMessage runs real Drizzle against in-memory SQLite, so the attachment
// ownership filter and the buffered/pending decision are exercised as real SQL.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { conversations, customers, messages, fileAttachments } from '@/db/schema';
import type { Bindings } from '@/types';
import { d1Of } from '../../../../helpers/sqlite-d1';

const mockDeliverMessage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@modules/conversations/services/message-delivery-service', () => ({
  MessageDeliveryService: vi.fn(function () {
    return { deliver: mockDeliverMessage };
  })
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-11-25T08:00:00.000Z'),
  nowMs: vi.fn(() => Date.parse('2026-11-25T08:00:00.000Z'))
}));

import { MessageService, MessageRequestService } from '@modules/conversations/services/message-service';

const NOW = '2026-11-25T08:00:00.000Z';

function createTable(sqlite: Sqlite.Database, table: SQLiteTable): void {
  const config = getTableConfig(table);
  sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map(column =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
}

function setup(platform: 'line' | 'facebook' = 'line') {
  const sqlite = new Sqlite(':memory:');
  for (const table of [customers, conversations, messages, fileAttachments]) createTable(sqlite, table);
  sqlite.prepare("INSERT INTO customers (id, platform, platform_user_id, display_name) VALUES (1, ?, 'U12345', 'Ann')").run(platform);
  sqlite.prepare("INSERT INTO conversations (id, customer_id, status, last_message_at, updated_at) VALUES ('conv-1', 1, 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
  sqlite.prepare("INSERT INTO conversations (id, customer_id, status) VALUES ('conv-2', 1, 'active')").run();
  const service = new MessageService({ DB: d1Of(sqlite) } as unknown as Bindings);
  const addUpload = (id: string, uploadedBy: string | null, conversationId: string | null, messageId: string | null = null) =>
    sqlite.prepare("INSERT INTO file_attachments (id, message_id, conversation_id, filename, mime_type, file_size, r2_key, uploaded_by) VALUES (?, ?, ?, 'f.pdf', 'application/pdf', 10, 'k', ?)")
      .run(id, messageId, conversationId, uploadedBy);
  const message = (id: string) =>
    sqlite.prepare('SELECT delivery_status AS deliveryStatus, is_sent AS isSent, sender_type AS senderType, agent_sender_id AS agentSenderId, metadata FROM messages WHERE id = ?')
      .get(id) as { deliveryStatus: string; isSent: number; senderType: string; agentSenderId: string; metadata: string };
  const linkedTo = (id: string) =>
    (sqlite.prepare('SELECT message_id AS m FROM file_attachments WHERE id = ?').get(id) as { m: string | null }).m;
  return { sqlite, service, addUpload, message, linkedTo };
}

const request = (extra: Record<string, unknown> = {}) => ({
  conversationId: 'conv-1',
  content: 'Hello from agent',
  senderId: 'agent-1',
  ...extra
});

describe('MessageService.createPendingMessage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts an unsent pending agent message with the customer platform in metadata and bumps only this conversation', async () => {
    const { sqlite, service, message } = setup();

    const result = await service.createPendingMessage(request({ metadata: { customField: 'value' } }));

    expect(result).toMatchObject({ success: true, conversationId: 'conv-1', content: 'Hello from agent', timestamp: NOW });
    const row = message(result.messageId!);
    expect(row).toMatchObject({ deliveryStatus: 'pending', isSent: 0, senderType: 'agent', agentSenderId: 'agent-1' });
    expect(JSON.parse(row.metadata)).toEqual({ customField: 'value', platform: 'line', platformUserId: 'U12345' });
    expect(sqlite.prepare("SELECT last_message_at AS l, updated_at AS u FROM conversations WHERE id = 'conv-1'").get())
      .toEqual({ l: NOW, u: NOW });
    expect(sqlite.prepare("SELECT updated_at AS u FROM conversations WHERE id = 'conv-2'").get()).toEqual({ u: null });
  });

  it('buffers a LINE message when a recall window is configured', async () => {
    const { service, message } = setup('line');

    const result = await service.createPendingMessage(request(), 30);

    expect(message(result.messageId!).deliveryStatus).toBe('buffered');
  });

  it('never buffers a non-LINE message, even with a recall window', async () => {
    const { service, message } = setup('facebook');

    const result = await service.createPendingMessage(request(), 30);

    expect(message(result.messageId!).deliveryStatus).toBe('pending');
  });

  it('links only unlinked uploads by the sender for this conversation, and records them in metadata', async () => {
    const { service, addUpload, message, linkedTo } = setup();
    addUpload('own', 'agent-1', 'conv-1');
    addUpload('own-legacy-no-conversation', 'agent-1', null);
    addUpload('foreign', 'agent-2', 'conv-1');
    addUpload('ownerless', null, 'conv-1');
    addUpload('other-conversation', 'agent-1', 'conv-2');
    addUpload('already-linked', 'agent-1', 'conv-1', 'older-message');

    const result = await service.createPendingMessage(request({
      attachmentIds: ['own', 'own-legacy-no-conversation', 'foreign', 'ownerless', 'other-conversation', 'already-linked', 'missing']
    }));

    const id = result.messageId!;
    expect(JSON.parse(message(id).metadata).attachmentIds.sort()).toEqual(['own', 'own-legacy-no-conversation']);
    expect(linkedTo('own')).toBe(id);
    expect(linkedTo('own-legacy-no-conversation')).toBe(id);
    expect(linkedTo('foreign')).toBeNull();
    expect(linkedTo('ownerless')).toBeNull();
    expect(linkedTo('other-conversation')).toBeNull();
    expect(linkedTo('already-linked')).toBe('older-message');
  });

  it('omits attachmentIds from metadata when none survive the ownership filter', async () => {
    const { service, addUpload, message } = setup();
    addUpload('foreign', 'agent-2', 'conv-1');

    const result = await service.createPendingMessage(request({ attachmentIds: ['foreign'] }));

    expect(JSON.parse(message(result.messageId!).metadata)).not.toHaveProperty('attachmentIds');
  });

  it('throws and writes nothing when the conversation does not exist', async () => {
    const { sqlite, service } = setup();

    await expect(service.createPendingMessage(request({ conversationId: 'missing' }))).rejects.toThrow('Conversation or customer not found');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM messages').get()).toEqual({ n: 0 });
  });
});

describe('MessageService.processBackgroundSending', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates delivery of the stored message to MessageDeliveryService', async () => {
    const { service } = setup();

    await service.processBackgroundSending('msg-bg-1', request(), { id: 'agent-1' });

    expect(mockDeliverMessage).toHaveBeenCalledWith('msg-bg-1');
  });

  it('propagates delivery failures to the waitUntil caller', async () => {
    const { service } = setup();
    mockDeliverMessage.mockRejectedValueOnce(new Error('delivery failed'));

    await expect(service.processBackgroundSending('msg-bg-1', request(), { id: 'agent-1' })).rejects.toThrow('delivery failed');
  });
});

describe('MessageRequestService - validateAndParse', () => {
  const createMockContext = (params: { id?: string }, body: any) => ({
    req: {
      param: (key: string) => params[key as keyof typeof params] || null,
      json: async () => body
    }
  });

  it('should validate and parse a valid request', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      {
        content: 'Hello',
        senderId: 'agent-1',
        messageType: 'text'
      }
    );

    const result = await MessageRequestService.validateAndParse(ctx as never);

    expect(result.conversationId).toBe('conv-1');
    expect(result.content).toBe('Hello');
    expect(result.senderId).toBe('agent-1');
    expect(result.messageType).toBe('text');
  });

  it('should throw when conversation ID is missing', async () => {
    const ctx = createMockContext(
      {},
      { content: 'Hello', senderId: 'agent-1' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx as never)
    ).rejects.toThrow('Missing conversation ID');
  });

  it('should throw when content and attachments are both missing', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { senderId: 'agent-1' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx as never)
    ).rejects.toThrow('Message content or attachments are required');
  });

  it('should throw when senderId is missing', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx as never)
    ).rejects.toThrow('Sender ID is required');
  });

  it('should allow empty content when attachments are provided', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      {
        content: '',
        senderId: 'agent-1',
        attachmentIds: ['file-1']
      }
    );

    const result = await MessageRequestService.validateAndParse(ctx as never);

    expect(result.attachmentIds).toEqual(['file-1']);
    expect(result.content).toBe('');
  });

  it('should default messageType to text', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx as never);

    expect(result.messageType).toBe('text');
  });

  it('should trim content whitespace', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: '  Hello World  ', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx as never);

    expect(result.content).toBe('Hello World');
  });

  it('should default metadata to empty object', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx as never);

    expect(result.metadata).toEqual({});
  });

  it('should default attachmentIds to empty array', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: 'Hello', senderId: 'agent-1' }
    );

    const result = await MessageRequestService.validateAndParse(ctx as never);

    expect(result.attachmentIds).toEqual([]);
  });

  it('should pass through provided metadata', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      {
        content: 'Hello',
        senderId: 'agent-1',
        metadata: { source: 'web', priority: 'high' }
      }
    );

    const result = await MessageRequestService.validateAndParse(ctx as never);

    expect(result.metadata).toEqual({ source: 'web', priority: 'high' });
  });

  it('should reject whitespace-only content without attachments', async () => {
    const ctx = createMockContext(
      { id: 'conv-1' },
      { content: ' ', senderId: 'agent-1' }
    );

    await expect(
      MessageRequestService.validateAndParse(ctx as never)
    ).rejects.toThrow('Message content or attachments are required');
  });
});
