import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/db/drizzle-factory';
import { broadcastRecipients, broadcasts, customers } from '@/db/schema';
import { nowISO } from '@/utils/timestamp';
import { BroadcastAudienceService } from '@modules/broadcast/services/audience-service';
import {
  BroadcastServiceError,
  type BroadcastListResult,
  type BroadcastRecord,
  type BroadcastRecipientListResult,
  type BroadcastRecipientStatus,
  type CreateBroadcastInput,
} from '@modules/broadcast/types';
import { BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE, chunkItems } from './d1-chunks';

export class BroadcastService {
  private readonly audienceService: BroadcastAudienceService;

  constructor(private readonly db: Database) {
    this.audienceService = new BroadcastAudienceService(db);
  }

  async preview(tagId: number) {
    return this.audienceService.previewSingleTagAudience(tagId);
  }

  async create(input: CreateBroadcastInput, createdBy: string): Promise<BroadcastRecord> {
    validateCreateInput(input);

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
      contentType: 'text',
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
    return row ? mapBroadcastRecord(row) : null;
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
        customerDisplayName: customers.displayName,
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
  if (content.length < 1 || content.length > 2000) {
    throw new BroadcastServiceError('INVALID_BROADCAST_INPUT', 'Broadcast content must be 1-2000 characters', 422);
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
