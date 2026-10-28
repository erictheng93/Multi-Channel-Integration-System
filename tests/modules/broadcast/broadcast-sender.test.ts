import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Bindings, DbUser } from '@/types';
import { broadcasts, broadcastRecipients, broadcastAttachments, conversations, fileAttachments, messages } from '@/db/schema';
import { BroadcastSenderService } from '@/modules/broadcast/services/broadcast-sender-service';
import { createBroadcastFixture } from './broadcast-fixture';
import { getDisplayContent } from '@/modules/conversations/utils/message-helpers';

const mocks = vi.hoisted(() => ({ multicast: vi.fn(), head: vi.fn(), error: vi.fn(), quota: vi.fn(), usage: vi.fn() }));
vi.mock('@/utils/line', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/utils/line')>(),
  multicastLineMessage: mocks.multicast,
  getLineMessageQuota: mocks.quota,
  getLineMessageUsage: mocks.usage,
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
    mocks.quota.mockResolvedValue({ success: true, type: 'none' });
    mocks.usage.mockResolvedValue({ success: true, totalUsage: 0 });
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

  describe('send guards', () => {
    const agent = { id: 'agent-1', role: 'agent', displayName: '客服' } as DbUser;
    const admin = { ...agent, role: 'admin' } as DbUser;
    const withLimit = (limit: string) => new BroadcastSenderService(fixture.db, {
      LINE_CHANNEL_ACCESS_TOKEN: 'test-only-token', R2_BUCKET: { head: mocks.head },
      BROADCAST_DAILY_RECIPIENT_LIMIT_PER_AGENT: limit,
    } as unknown as Bindings);
    // An earlier broadcast by the same agent that already delivered `count` recipients at `sentAt`.
    const seedEarlier = async (count: number, sentAt: string) => {
      await fixture.db.insert(broadcasts).values({
        id: 'b-old', title: '舊', content: 'x', tagIds: '[1]', createdBy: 'agent-1', status: 'completed', sentAt,
      });
      await fixture.db.insert(broadcastRecipients).values(Array.from({ length: count }, (_, i) => ({
        broadcastId: 'b-old', platform: 'line', platformUserId: `O${i}`, status: 'sent',
      })));
    };

    it('lets an agent under the daily cap send', async () => {
      await seedEarlier(2, new Date().toISOString());
      expect(await withLimit('3').send('b-1', agent)).toMatchObject({ status: 'completed', sentCount: 1 });
    });

    it('rejects an agent over the cap before any LINE call and keeps the draft', async () => {
      await seedEarlier(3, new Date().toISOString());
      await expect(withLimit('3').send('b-1', agent)).rejects.toMatchObject({
        code: 'DAILY_RECIPIENT_LIMIT_EXCEEDED', status: 429, message: expect.stringContaining('剩餘 0 人'),
      });
      expect(mocks.multicast).not.toHaveBeenCalled();
      expect(mocks.quota).not.toHaveBeenCalled();
      expect(await fixture.db.select().from(broadcasts).where(eq(broadcasts.id, 'b-1')))
        .toEqual([expect.objectContaining({ status: 'draft' })]);
    });

    it('ignores broadcasts sent before today (Asia/Taipei)', async () => {
      await seedEarlier(5, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString());
      expect(await withLimit('3').send('b-1', agent)).toMatchObject({ status: 'completed' });
    });

    it('lets only one of two concurrent drafts through when together they exceed the cap', async () => {
      await fixture.db.insert(broadcasts).values({ id: 'b-2', title: '通知2', content: 'x', tagIds: '[1]', createdBy: 'agent-1' });
      await fixture.db.insert(broadcastRecipients).values({ broadcastId: 'b-2', customerId: 1, platform: 'line', platformUserId: 'U2' });
      const limited = withLimit('1');

      const results = await Promise.allSettled([limited.send('b-1', agent), limited.send('b-2', agent)]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({
        reason: expect.objectContaining({ code: 'DAILY_RECIPIENT_LIMIT_EXCEEDED' }),
      });
      expect(mocks.multicast).toHaveBeenCalledTimes(1);
      expect((await fixture.db.select().from(broadcasts)).map((b) => b.status).sort()).toEqual(['completed', 'draft']);
    });

    it('exempts admins from the daily cap', async () => {
      await seedEarlier(10, new Date().toISOString());
      expect(await withLimit('3').send('b-1', admin)).toMatchObject({ status: 'completed' });
    });

    it('blocks when the send would eat into the support-reply reserve, even for admins', async () => {
      // 1000 quota, 20% reserve = 200. LINE counts per recipient: remaining 200, cost 1 -> 199 < 200.
      fixture.sqlite.prepare('UPDATE broadcasts SET content = ? WHERE id = ?').run('文字', 'b-1');
      mocks.quota.mockResolvedValue({ success: true, type: 'limited', value: 1000 });
      mocks.usage.mockResolvedValue({ success: true, totalUsage: 800 });
      await expect(sender.send('b-1', admin)).rejects.toMatchObject({ code: 'QUOTA_INSUFFICIENT' });
      expect(mocks.multicast).not.toHaveBeenCalled();
    });

    it('sends when the reserve stays intact', async () => {
      fixture.sqlite.prepare('UPDATE broadcasts SET content = ? WHERE id = ?').run('文字', 'b-1');
      mocks.quota.mockResolvedValue({ success: true, type: 'limited', value: 1000 });
      mocks.usage.mockResolvedValue({ success: true, totalUsage: 799 });
      expect(await sender.send('b-1', admin)).toMatchObject({ status: 'completed' });
    });

    it('skips the reserve rule on an unlimited plan', async () => {
      mocks.usage.mockResolvedValue({ success: true, totalUsage: 999999 });
      expect(await sender.send('b-1', agent)).toMatchObject({ status: 'completed' });
    });
  });
});
