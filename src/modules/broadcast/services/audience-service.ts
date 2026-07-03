import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '@/db/drizzle-factory';
import { customers, customerTags, tags } from '@/db/schema';
import type { BroadcastAudienceMember, BroadcastAudiencePreview } from '@modules/broadcast/types';
import { BroadcastServiceError } from '@modules/broadcast/types';

export class BroadcastAudienceService {
  constructor(private readonly db: Database) {}

  async resolveSingleTagAudience(tagId: number): Promise<BroadcastAudienceMember[]> {
    await this.ensureActiveTag(tagId);

    return this.db
      .select({
        customerId: customers.id,
        platform: customers.platform,
        platformUserId: customers.platformUserId,
        resolvedTeamId: customers.sourceTeamId,
      })
      .from(customerTags)
      .innerJoin(customers, eq(customers.id, customerTags.customerId))
      .where(and(eq(customerTags.tagId, tagId), isNull(customers.deletedAt)));
  }

  async previewSingleTagAudience(tagId: number): Promise<BroadcastAudiencePreview> {
    const audience = await this.resolveSingleTagAudience(tagId);

    return summarizeAudience(audience);
  }

  private async ensureActiveTag(tagId: number): Promise<void> {
    const tag = await this.db.query.tags.findFirst({
      columns: { id: true },
      where: and(eq(tags.id, tagId), eq(tags.isActive, true), isNull(tags.deletedAt)),
    });

    if (!tag) {
      throw new BroadcastServiceError('TAG_NOT_FOUND', 'Broadcast tag was not found', 404);
    }
  }
}

export function summarizeAudience(audience: BroadcastAudienceMember[]): BroadcastAudiencePreview {
  const byPlatform: BroadcastAudiencePreview['byPlatform'] = {
    line: 0,
    facebook: 0,
  };

  for (const member of audience) {
    byPlatform[member.platform] = (byPlatform[member.platform] ?? 0) + 1;
  }

  const unsupportedCount = audience.length - byPlatform.line;
  const skipped =
    unsupportedCount > 0
      ? [{ reason: 'platform_not_supported_phase1' as const, count: unsupportedCount }]
      : [];

  return {
    total: audience.length,
    byPlatform,
    sendable: byPlatform.line,
    skipped,
  };
}
