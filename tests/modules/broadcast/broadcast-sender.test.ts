import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings, DbUser } from '@/types';
import { broadcasts, broadcastRecipients, broadcastAttachments, conversations, fileAttachments, messages } from '@/db/schema';
import { BroadcastSenderService } from '@/modules/broadcast/services/broadcast-sender-service';
import { createBroadcastFixture } from './broadcast-fixture';
import { getDisplayContent } from '@/modules/conversations/utils/message-helpers';

const mocks = vi.hoisted(() => ({ multicast: vi.fn(), head: vi.fn(), error: vi.fn() }));
vi.mock('@/utils/line', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/utils/line')>(),
  multicastLineMessage: mocks.multicast,
  getLineMessageQuota: vi.fn(async () => ({ success: true, type: 'none' })),
  getLineMessageUsage: vi.fn(async () => ({ success: true, totalUsage: 0 })),
}));
vi.mock('@/utils/file-url', () => ({
  getSignedFileUrl: vi.fn(async (_env, key) => `https://files.test/${key}`),
  PERSISTENT_ATTACHMENT_URL_TTL_SECONDS: 3600,
}));
vi.mock('@/utils/logger', () => ({ createContextLogger: () => ({ error: mocks.error, warn: vi.fn() }) }));

describe('BroadcastSenderService send flow', () => {
  let fixture: ReturnType<typeof createBroadcastFixture>;
  let sender: BroadcastSenderService;
  const actor = { id: 'agent-1', displayName: '客服' } as DbUser;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.head.mockResolvedValue({});
    mocks.multicast.mockResolvedValue({ success: true, failedUserIds: [] });
    fixture = createBroadcastFixture();
    sender = new BroadcastSenderService(fixture.db, {
      LINE_CHANNEL_ACCESS_TOKEN: 'test-only-token', R2_BUCKET: { head: mocks.head },
    } as unknown as Bindings);
    fixture.sqlite.prepare('INSERT INTO customers (id) VALUES (1)').run();
    await fixture.db.insert(conversations).values({ id: 'c-1', customerId: 1, createdAt: '2026-10-13T00:00:00Z' });
    await fixture.db.insert(broadcasts).values({ id: 'b-1', title: '通知', content: '', contentType: 'mixed', tagIds: '[1]', createdBy: 'agent-1' });
    await fixture.db.insert(broadcastRecipients).values({ broadcastId: 'b-1', customerId: 1, platform: 'line', platformUserId: 'U1' });
    await fixture.db.insert(fileAttachments).values(['original', 'preview'].map((id) => ({
      id, filename: `${id}.jpg`, mimeType: 'image/jpeg', fileSize: 100, r2Key: id,
      fileUrl: `https://files.test/${id}`, uploadedBy: 'agent-1',
    })));
    await fixture.db.insert(broadcastAttachments).values({ broadcastId: 'b-1', attachmentId: 'original', previewAttachmentId: 'preview', position: 0 });
  });
  afterEach(() => fixture.sqlite.close());

  it.each(['original', 'preview'])('never multicasts when the %s object is missing; drains pending recipients', async (missing) => {
    mocks.head.mockImplementation(async (key: string) => key === missing ? null : {});
    const stats = await sender.send('b-1', actor);
    expect(mocks.multicast).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ status: 'failed', failedCount: 1, sentCount: 0 });
    expect(await fixture.db.select().from(broadcastRecipients)).toEqual([
      expect.objectContaining({ status: 'failed', errorReason: 'line_api_failed' }),
    ]);
    expect(await fixture.db.select().from(broadcasts)).toEqual([expect.objectContaining({ status: 'failed', failedCount: 1 })]);
  });

  it('does not multicast when a linked attachment row is missing', async () => {
    fixture.sqlite.pragma('foreign_keys = OFF');
    fixture.sqlite.prepare('DELETE FROM file_attachments WHERE id = ?').run('original');
    fixture.sqlite.pragma('foreign_keys = ON');
    expect(await sender.send('b-1', actor)).toMatchObject({ status: 'failed', failedCount: 1 });
    expect(mocks.multicast).not.toHaveBeenCalled();
  });

  it.each(['', '文字與圖片'])('passes LINE messages through multicast and writes image messages for %j', async (content) => {
    fixture.sqlite.prepare('UPDATE broadcasts SET content = ? WHERE id = ?').run(content, 'b-1');
    const stats = await sender.send('b-1', actor);
    expect(mocks.multicast).toHaveBeenCalledWith('test-only-token', ['U1'], [
      ...(content ? [{ type: 'text', text: content }] : []),
      { type: 'image', originalContentUrl: 'https://files.test/original', previewImageUrl: 'https://files.test/preview' },
    ]);
    expect(stats).toMatchObject({ status: 'completed', sentCount: 1 });
    const written = await fixture.db.select().from(messages);
    expect(written).toEqual([expect.objectContaining({ content, messageType: 'image', conversationId: 'c-1' })]);
    expect(getDisplayContent(written[0].content, written[0].messageType)).toBe(content || '[圖片]');
    const attachments = await fixture.db.select().from(fileAttachments);
    expect(attachments).toContainEqual(expect.objectContaining({ messageId: written[0].id, r2Key: 'original' }));
  });

  it('logs write-back failures and still finalizes successful sends', async () => {
    fixture.sqlite.exec(`CREATE TRIGGER fail_message BEFORE INSERT ON messages
      BEGIN SELECT RAISE(ABORT, 'message write failed'); END`);
    expect(await sender.send('b-1', actor)).toMatchObject({ status: 'completed', sentCount: 1, failedCount: 0 });
    expect(mocks.error).toHaveBeenCalledWith('Broadcast write-back failed', { broadcastId: 'b-1', sentCount: 1 }, expect.any(Error));
    expect(await fixture.db.select().from(broadcasts)).toEqual([expect.objectContaining({ status: 'completed', sentCount: 1 })]);
    expect(await fixture.db.select().from(messages)).toEqual([]);
  });
});
