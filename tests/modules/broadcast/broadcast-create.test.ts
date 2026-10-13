import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Bindings } from '@/types';
import { broadcasts, broadcastAttachments, broadcastRecipients, fileAttachments } from '@/db/schema';
import { BroadcastService } from '@/modules/broadcast/services/broadcast-service';
import { createBroadcastFixture } from './broadcast-fixture';

const audience = vi.hoisted(() => vi.fn());
vi.mock('@modules/broadcast/services/audience-service', () => ({
  BroadcastAudienceService: class { resolveSingleTagAudience = audience; }
}));
vi.mock('@/utils/file-url', () => ({
  getSignedFileUrl: vi.fn(async (_env, key) => `https://files.test/${key}`),
  PERSISTENT_ATTACHMENT_URL_TTL_SECONDS: 3600,
}));

describe('BroadcastService attachment creation and existence', () => {
  let fixture: ReturnType<typeof createBroadcastFixture>;
  let service: BroadcastService;
  const input = { title: '通知', content: '', tagIds: [1], attachments: [{ attachmentId: 'original', previewAttachmentId: 'preview' }] };

  beforeEach(async () => {
    fixture = createBroadcastFixture();
    service = new BroadcastService(fixture.db, {} as Bindings);
    audience.mockReset();
    audience.mockResolvedValue([{ customerId: null, platform: 'line', platformUserId: 'U1', resolvedTeamId: null }]);
    await fixture.db.insert(fileAttachments).values(['original', 'preview'].map((id) => ({
      id, filename: `${id}.jpg`, mimeType: 'image/jpeg', fileSize: 100, r2Key: id,
      fileUrl: `https://files.test/${id}`, uploadedBy: 'agent-1', messageId: null,
    })));
  });
  afterEach(() => { fixture.sqlite.close(); vi.restoreAllMocks(); });

  it('rejects someone else’s upload before writing a broadcast', async () => {
    await fixture.db.update(fileAttachments).set({ uploadedBy: 'agent-2' }).where(eq(fileAttachments.id, 'original'));
    await expect(service.create(input, 'agent-1')).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_OWNED', status: 422 });
    expect(await fixture.db.select().from(broadcasts)).toEqual([]);
    expect(audience).not.toHaveBeenCalled();
  });

  it.each(['', 'Hello'])('persists mixed content for text %j and owned attachments', async (content) => {
    const result = await service.create({ ...input, content }, 'agent-1');
    expect(result).toMatchObject({ contentType: 'mixed', content, attachments: [{ attachmentId: 'original', position: 0 }] });
    expect(await fixture.db.select().from(broadcastRecipients)).toHaveLength(1);
    expect(await fixture.db.select().from(broadcastAttachments)).toHaveLength(1);
  });

  it('rolls back the parent and cascade-deletes recipients on attachment write failure', async () => {
    fixture.sqlite.exec(`CREATE TRIGGER fail_attachment BEFORE INSERT ON broadcast_attachments
      BEGIN SELECT RAISE(ABORT, 'attachment write failed'); END`);
    await expect(service.create(input, 'agent-1')).rejects.toThrow();
    expect(await fixture.db.select().from(broadcasts)).toEqual([]);
    expect(await fixture.db.select().from(broadcastRecipients)).toEqual([]);
    expect(await fixture.db.select().from(broadcastAttachments)).toEqual([]);
    expect(await fixture.db.select().from(fileAttachments)).toHaveLength(2);
  });

});
