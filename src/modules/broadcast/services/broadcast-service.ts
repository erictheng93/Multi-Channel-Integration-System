import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '@/db/drizzle-factory';
import {
  broadcastAttachments,
  broadcastRecipients,
  broadcasts,
  customers,
  customerNameSql,
  fileAttachments,
} from '@/db/schema';
import type { Bindings } from '@/types';
import { getSignedFileUrl, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS } from '@/utils/file-url';
import { nowISO } from '@/utils/timestamp';
import { BroadcastAudienceService } from '@modules/broadcast/services/audience-service';
import {
  BroadcastServiceError,
  type BroadcastAttachmentView,
  type BroadcastListResult,
  type BroadcastRecord,
  type BroadcastRecipientListResult,
  type BroadcastRecipientStatus,
  type CreateBroadcastInput,
} from '@modules/broadcast/types';
import { assertBroadcastAttachments } from './broadcast-content';
import { BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE, chunkItems } from './d1-chunks';

export class BroadcastService {
  private readonly audienceService: BroadcastAudienceService;

  constructor(
    private readonly db: Database,
    private readonly env: Bindings
  ) {
    this.audienceService = new BroadcastAudienceService(db);
  }

  async preview(tagId: number) {
    return this.audienceService.previewSingleTagAudience(tagId);
  }

  async create(input: CreateBroadcastInput, createdBy: string): Promise<BroadcastRecord> {
    validateCreateInput(input);
    await this.assertAttachments(input, createdBy);

    const [tagId] = input.tagIds;
    const audience = await this.audienceService.resolveSingleTagAudience(tagId);
    if (audience.length === 0) {
      throw new BroadcastServiceError('EMPTY_AUDIENCE', 'Broadcast audience is empty', 422);
    }

    const now = nowISO();
    const broadcastId = crypto.randomUUID();
    const record = {
      id: broadcastId,
      title: input.title.trim(),
      contentType: input.attachments.length > 0 ? 'mixed' : 'text',
      content: input.content.trim(),
      tagIds: JSON.stringify(input.tagIds),
      matchMode: 'any',
      status: 'draft',
      totalRecipients: audience.length,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      createdBy,
      createdAt: now,
      updatedAt: now,
    } satisfies typeof broadcasts.$inferInsert;

    await this.db.insert(broadcasts).values(record);

    try {
      const recipientRows = audience.map((member) => ({
          broadcastId,
          customerId: member.customerId,
          platform: member.platform,
          platformUserId: member.platformUserId,
          resolvedTeamId: member.resolvedTeamId,
          status: 'pending',
          createdAt: now,
      }) satisfies typeof broadcastRecipients.$inferInsert);

      for (const recipientChunk of chunkItems(recipientRows, BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE)) {
        await this.db.insert(broadcastRecipients).values(recipientChunk);
      }

      if (input.attachments.length > 0) {
        await this.db.insert(broadcastAttachments).values(
          input.attachments.map((item, position) => ({
            broadcastId,
            attachmentId: item.attachmentId,
            previewAttachmentId: item.previewAttachmentId,
            position,
            createdAt: now,
          }) satisfies typeof broadcastAttachments.$inferInsert)
        );
      }
    } catch (error) {
      await this.db.delete(broadcasts).where(eq(broadcasts.id, broadcastId));
      throw error;
    }

    const created = await this.getById(broadcastId);
    if (!created) {
      throw new Error('Created broadcast could not be loaded');
    }
    return created;
  }

  async list(page: number, pageSize: number): Promise<BroadcastListResult> {
    const normalized = normalizePagination(page, pageSize);
    const [{ total = 0 } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(broadcasts)
      .where(isNull(broadcasts.deletedAt));

    const rows = await this.db
      .select()
      .from(broadcasts)
      .where(isNull(broadcasts.deletedAt))
      .orderBy(desc(broadcasts.createdAt), asc(broadcasts.id))
      .limit(normalized.pageSize)
      .offset((normalized.page - 1) * normalized.pageSize);

    return {
      items: rows.map(mapBroadcastRecord),
      page: normalized.page,
      pageSize: normalized.pageSize,
      total,
      totalPages: Math.ceil(total / normalized.pageSize),
    };
  }

  async getById(id: string): Promise<BroadcastRecord | null> {
    const row = await this.db.query.broadcasts.findFirst({
      where: and(eq(broadcasts.id, id), isNull(broadcasts.deletedAt)),
    });
    if (!row) {
      return null;
    }
    return { ...mapBroadcastRecord(row), attachments: await this.loadAttachments(id) };
  }

  private async assertAttachments(input: CreateBroadcastInput, actorId: string): Promise<void> {
    if (input.attachments.length === 0) {
      return;
    }
    const ids = input.attachments.flatMap((item) => [item.attachmentId, item.previewAttachmentId]);
    const rows = await this.db
      .select({
        id: fileAttachments.id,
        mimeType: fileAttachments.mimeType,
        fileSize: fileAttachments.fileSize,
        uploadedBy: fileAttachments.uploadedBy,
        messageId: fileAttachments.messageId,
      })
      .from(fileAttachments)
      .where(inArray(fileAttachments.id, ids));
    assertBroadcastAttachments(input.attachments, rows, actorId);
  }

  private async loadAttachments(broadcastId: string): Promise<BroadcastAttachmentView[]> {
    const rows = await this.db
      .select({
        position: broadcastAttachments.position,
        attachmentId: broadcastAttachments.attachmentId,
        previewAttachmentId: broadcastAttachments.previewAttachmentId,
      })
      .from(broadcastAttachments)
      .where(eq(broadcastAttachments.broadcastId, broadcastId))
      .orderBy(asc(broadcastAttachments.position));
    if (rows.length === 0) {
      return [];
    }

    const files = await this.db
      .select({ id: fileAttachments.id, r2Key: fileAttachments.r2Key })
      .from(fileAttachments)
      .where(inArray(fileAttachments.id, rows.flatMap((r) => [r.attachmentId, r.previewAttachmentId])));
    const keyById = new Map(files.map((file) => [file.id, file.r2Key]));
    const sign = (fileId: string) =>
      getSignedFileUrl(this.env, keyById.get(fileId) ?? '', PERSISTENT_ATTACHMENT_URL_TTL_SECONDS);

    return Promise.all(rows.map(async (r) => ({
      position: r.position,
      attachmentId: r.attachmentId,
      fileUrl: await sign(r.attachmentId),
      previewUrl: await sign(r.previewAttachmentId),
    })));
  }

  async listRecipients(
    broadcastId: string,
    page: number,
    pageSize: number,
    status?: BroadcastRecipientStatus
  ): Promise<BroadcastRecipientListResult> {
    const normalized = normalizePagination(page, pageSize);
    const filters = status
      ? and(eq(broadcastRecipients.broadcastId, broadcastId), eq(broadcastRecipients.status, status))
      : eq(broadcastRecipients.broadcastId, broadcastId);

    const [{ total = 0 } = { total: 0 }] = await this.db
      .select({ total: count() })
      .from(broadcastRecipients)
      .where(filters);

    const rows = await this.db
      .select({
        id: broadcastRecipients.id,
        broadcastId: broadcastRecipients.broadcastId,
        customerId: broadcastRecipients.customerId,
        platform: broadcastRecipients.platform,
        platformUserId: broadcastRecipients.platformUserId,
        resolvedTeamId: broadcastRecipients.resolvedTeamId,
        status: broadcastRecipients.status,
        errorReason: broadcastRecipients.errorReason,
        sentAt: broadcastRecipients.sentAt,
        createdAt: broadcastRecipients.createdAt,
        customerDisplayName: customerNameSql,
        customerAvatarUrl: customers.avatarUrl,
      })
      .from(broadcastRecipients)
      .leftJoin(customers, eq(customers.id, broadcastRecipients.customerId))
      .where(filters)
      .orderBy(desc(broadcastRecipients.createdAt), asc(broadcastRecipients.id))
      .limit(normalized.pageSize)
      .offset((normalized.page - 1) * normalized.pageSize);

    return {
      items: rows.map((row) => ({
        ...row,
        status: row.status as BroadcastRecipientStatus,
        errorReason: row.errorReason as BroadcastRecipientListResult['items'][number]['errorReason'],
      })),
      page: normalized.page,
      pageSize: normalized.pageSize,
      total,
      totalPages: Math.ceil(total / normalized.pageSize),
    };
  }
}

function validateCreateInput(input: CreateBroadcastInput): void {
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length < 1 || title.length > 100) {
    throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', 'Broadcast title must be 1-100 characters', 422);
  }
  if (content.length > 2000) {
    throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', 'Broadcast content must be at most 2000 characters', 422);
  }
  if (content.length === 0 && input.attachments.length === 0) {
    throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', 'Broadcast needs text or at least one image', 422);
  }
  if (input.tagIds.length !== 1) {
    throw new BroadcastServiceError(
      'PHASE1_SINGLE_TAG_ONLY',
      'Phase 1 accepts exactly one tag',
      422
    );
  }
}

function normalizePagination(page: number, pageSize: number): { page: number; pageSize: number } {
  return {
    page: Math.max(1, page),
    pageSize: Math.min(Math.max(1, pageSize), 100),
  };
}

function mapBroadcastRecord(row: typeof broadcasts.$inferSelect): BroadcastRecord {
  return {
    ...row,
    contentType: row.contentType as BroadcastRecord['contentType'],
    tagIds: JSON.parse(row.tagIds) as number[],
    matchMode: row.matchMode as BroadcastRecord['matchMode'],
    status: row.status as BroadcastRecord['status'],
    totalRecipients: row.totalRecipients ?? 0,
    sentCount: row.sentCount ?? 0,
    failedCount: row.failedCount ?? 0,
    skippedCount: row.skippedCount ?? 0,
  };
}
