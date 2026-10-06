import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Bindings, DbUser, LineReplyMessage } from '@/types';
import type { Database } from '@/db/drizzle-factory';
import {
  broadcastAttachments,
  broadcastRecipients,
  broadcasts,
  channelIntegrations,
  conversations,
  fileAttachments,
  messages,
} from '@/db/schema';
import { nowISO } from '@/utils/timestamp';
import {
  getLineMessageQuota,
  getLineMessageUsage,
  multicastLineMessage,
} from '@/utils/line';
import { getSignedFileUrl, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS } from '@/utils/file-url';
import { createContextLogger } from '@/utils/logger';
import { ChannelCredentialService } from '@modules/integrations/services/channel-credential-service';
import {
  BroadcastServiceError,
  type BroadcastRecipientErrorReason,
  type BroadcastSendStats,
} from '@modules/broadcast/types';
import {
  BROADCAST_ATTACHMENT_INSERT_CHUNK_SIZE,
  BROADCAST_IN_ARRAY_CHUNK_SIZE,
  BROADCAST_WRITE_UNITS_PER_BATCH,
  chunkItems,
  runInBatches,
} from './d1-chunks';
import {
  assertObjectsExist,
  buildBroadcastLineMessages,
  groupWriteBackUnits,
  type BroadcastImageFile,
} from './broadcast-content';

const log = createContextLogger('BroadcastSender');
const PHASE1_LINE_RECIPIENT_LIMIT = 5000;

type PendingRecipient = typeof broadcastRecipients.$inferSelect;

type TokenGroup = {
  token: string;
  recipients: PendingRecipient[];
};

export class BroadcastSenderService {
  private readonly credentialService: ChannelCredentialService;

  constructor(
    private readonly db: Database,
    private readonly env: Bindings
  ) {
    this.credentialService = new ChannelCredentialService(env);
  }

  async send(broadcastId: string, actor: DbUser): Promise<BroadcastSendStats> {
    const broadcast = await this.db.query.broadcasts.findFirst({
      where: and(eq(broadcasts.id, broadcastId), isNull(broadcasts.deletedAt)),
    });

    if (!broadcast) {
      throw new BroadcastServiceError('BROADCAST_NOT_FOUND', 'Broadcast not found', 404);
    }

    const transitioned = await this.db
      .update(broadcasts)
      .set({ status: 'sending', updatedAt: nowISO() })
      .where(and(eq(broadcasts.id, broadcastId), eq(broadcasts.status, 'draft')))
      .returning({ id: broadcasts.id });

    if (transitioned.length === 0) {
      throw new BroadcastServiceError(
        'INVALID_BROADCAST_STATUS',
        'Broadcast is not in draft status',
        409
      );
    }

    try {
      const images = await this.loadImages(broadcastId);
      const lineMessages = buildBroadcastLineMessages(broadcast.content, images);

      const pendingRecipients = await this.db
        .select()
        .from(broadcastRecipients)
        .where(
          and(
            eq(broadcastRecipients.broadcastId, broadcastId),
            eq(broadcastRecipients.status, 'pending')
          )
        );

      const lineRecipients = pendingRecipients.filter((recipient) => recipient.platform === 'line');
      const unsupportedRecipients = pendingRecipients.filter((recipient) => recipient.platform !== 'line');

      if (lineRecipients.length > PHASE1_LINE_RECIPIENT_LIMIT) {
        await this.restoreDraftStatus(broadcastId);
        throw new BroadcastServiceError(
          'LINE_RECIPIENT_LIMIT_EXCEEDED',
          'Phase 1 supports at most 5000 LINE recipients',
          422
        );
      }

      await this.markRecipients(unsupportedRecipients, 'skipped', 'platform_not_supported_phase1');

      const tokenGroups = await this.resolveTokenGroups(lineRecipients);
      await this.markRecipients(tokenGroups.skippedNoCredentials, 'skipped', 'no_channel_credentials');

      const quotaPassedGroups: TokenGroup[] = [];
      let quotaBlockedCount = 0;
      for (const group of tokenGroups.sendable) {
        const quotaPassed = await this.hasQuota(group.token, group.recipients.length);
        if (quotaPassed) {
          quotaPassedGroups.push(group);
        } else {
          quotaBlockedCount += group.recipients.length;
          await this.markRecipients(group.recipients, 'skipped', 'quota_insufficient');
        }
      }

      if (quotaPassedGroups.length === 0 && lineRecipients.length > 0 && quotaBlockedCount > 0) {
        const stats = await this.finalizeBroadcast(broadcastId);
        throw new BroadcastServiceError(
          'QUOTA_INSUFFICIENT',
          `LINE quota is insufficient for ${stats.skippedCount} recipient(s)`,
          409
        );
      }

      const sentRecipients: PendingRecipient[] = [];
      for (const group of quotaPassedGroups) {
        const groupSent = await this.sendLineGroup(group, lineMessages);
        sentRecipients.push(...groupSent);
      }

      try {
        await this.writeBackConversationMessages(broadcastId, broadcast.content, images, actor, sentRecipients);
      } catch (error) {
        log.error(
          'Broadcast write-back failed',
          { broadcastId, sentCount: sentRecipients.length },
          error instanceof Error ? error : String(error)
        );
      }

      return this.finalizeBroadcast(broadcastId);
    } catch (error) {
      if (error instanceof BroadcastServiceError) {
        throw error;
      }

      log.error('Broadcast send failed unexpectedly', { broadcastId }, error instanceof Error ? error : String(error));
      await this.failRemainingPendingRecipients(broadcastId);
      return this.finalizeBroadcast(broadcastId);
    }
  }

  private async loadImages(broadcastId: string): Promise<Array<BroadcastImageFile & { previewUrl: string }>> {
    const links = await this.db
      .select({
        attachmentId: broadcastAttachments.attachmentId,
        previewAttachmentId: broadcastAttachments.previewAttachmentId,
      })
      .from(broadcastAttachments)
      .where(eq(broadcastAttachments.broadcastId, broadcastId))
      .orderBy(asc(broadcastAttachments.position));
    if (links.length === 0) {
      return [];
    }

    const files = await this.db
      .select()
      .from(fileAttachments)
      .where(inArray(fileAttachments.id, links.flatMap((l) => [l.attachmentId, l.previewAttachmentId])));
    const byId = new Map(files.map((file) => [file.id, file]));
    const keys = links.flatMap((link) => {
      const original = byId.get(link.attachmentId);
      const preview = byId.get(link.previewAttachmentId);
      return [original?.r2Key, preview?.r2Key].filter((key): key is string => Boolean(key));
    });
    try {
      await assertObjectsExist(keys, (key) => this.env.R2_BUCKET.head(key));
    } catch (error) {
      const detail = error instanceof Error ? error.message.replace('Image object missing in storage: ', '') : String(error);
      throw new Error(`Broadcast ${broadcastId} image object missing in storage: ${detail}`);
    }
    const sign = (r2Key: string) => getSignedFileUrl(this.env, r2Key, PERSISTENT_ATTACHMENT_URL_TTL_SECONDS);

    return Promise.all(links.map(async (link) => {
      const original = byId.get(link.attachmentId);
      const preview = byId.get(link.previewAttachmentId);
      if (!original || !preview) {
        throw new Error(`Broadcast ${broadcastId} references a missing attachment`);
      }
      return {
        filename: original.filename,
        mimeType: original.mimeType,
        fileSize: original.fileSize,
        r2Key: original.r2Key,
        url: await sign(original.r2Key),
        previewUrl: await sign(preview.r2Key),
      };
    }));
  }

  private async resolveTokenGroups(recipients: PendingRecipient[]): Promise<{
    sendable: TokenGroup[];
    skippedNoCredentials: PendingRecipient[];
  }> {
    const byTeam = new Map<number | null, PendingRecipient[]>();
    for (const recipient of recipients) {
      const key = recipient.resolvedTeamId ?? null;
      byTeam.set(key, [...(byTeam.get(key) ?? []), recipient]);
    }

    const byToken = new Map<string, PendingRecipient[]>();
    const skippedNoCredentials: PendingRecipient[] = [];

    for (const [teamId, teamRecipients] of byTeam.entries()) {
      const token = teamId ? await this.getTeamLineAccessToken(teamId) : null;
      const resolvedToken = token ?? this.env.LINE_CHANNEL_ACCESS_TOKEN;

      if (!resolvedToken) {
        skippedNoCredentials.push(...teamRecipients);
        continue;
      }

      byToken.set(resolvedToken, [...(byToken.get(resolvedToken) ?? []), ...teamRecipients]);
    }

    return {
      sendable: [...byToken.entries()].map(([token, groupRecipients]) => ({
        token,
        recipients: groupRecipients,
      })),
      skippedNoCredentials,
    };
  }

  private async getTeamLineAccessToken(teamId: number): Promise<string | null> {
    const integration = await this.db.query.channelIntegrations.findFirst({
      where: and(
        eq(channelIntegrations.teamId, teamId),
        eq(channelIntegrations.platform, 'line'),
        eq(channelIntegrations.isActive, true)
      ),
      orderBy: desc(channelIntegrations.createdAt),
    });

    if (!integration) {
      return null;
    }

    const credentials = await this.credentialService.getDecryptedCredentials(integration);
    return credentials.accessToken ?? null;
  }

  private async hasQuota(token: string, recipientCount: number): Promise<boolean> {
    const [quota, usage] = await Promise.all([
      getLineMessageQuota(token),
      getLineMessageUsage(token),
    ]);

    if (!quota.success || !usage.success) {
      log.warn('LINE quota precheck failed; blocking group conservatively', {
        quotaError: quota.error,
        usageError: usage.error,
      });
      return false;
    }

    if (quota.type !== 'limited') {
      return true;
    }

    const remaining = (quota.value ?? 0) - (usage.totalUsage ?? 0);
    return remaining >= recipientCount;
  }

  private async sendLineGroup(group: TokenGroup, lineMessages: LineReplyMessage[]): Promise<PendingRecipient[]> {
    try {
      const result = await multicastLineMessage(
        group.token,
        group.recipients.map((recipient) => recipient.platformUserId),
        lineMessages
      );
      const failedUserIds = new Set(result.failedUserIds ?? []);
      const failed = group.recipients.filter((recipient) => failedUserIds.has(recipient.platformUserId));
      const sent = group.recipients.filter((recipient) => !failedUserIds.has(recipient.platformUserId));

      await this.markRecipients(failed, 'failed', 'line_api_failed');
      await this.markRecipients(sent, 'sent');
      return sent;
    } catch (error) {
      log.error('LINE multicast threw during broadcast send', {}, error instanceof Error ? error : String(error));
      await this.markRecipients(group.recipients, 'failed', 'line_api_failed');
      return [];
    }
  }

  private async writeBackConversationMessages(
    broadcastId: string,
    content: string,
    images: BroadcastImageFile[],
    actor: DbUser,
    sentRecipients: PendingRecipient[]
  ): Promise<void> {
    if (sentRecipients.length === 0) {
      return;
    }

    const customerIds = sentRecipients
      .map((recipient) => recipient.customerId)
      .filter((customerId): customerId is number => customerId !== null);
    if (customerIds.length === 0) {
      return;
    }

    const conversationRows: Array<{
      id: string;
      customerId: number;
      createdAt: string | null;
    }> = [];
    for (const customerIdChunk of chunkItems(customerIds, BROADCAST_IN_ARRAY_CHUNK_SIZE)) {
      const rows = await this.db
        .select({
          id: conversations.id,
          customerId: conversations.customerId,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .where(and(inArray(conversations.customerId, customerIdChunk), isNull(conversations.deletedAt)))
        .orderBy(desc(conversations.createdAt));
      conversationRows.push(...rows);
    }

    const latestByCustomer = new Map<number, string>();
    for (const conversation of conversationRows) {
      if (!latestByCustomer.has(conversation.customerId)) {
        latestByCustomer.set(conversation.customerId, conversation.id);
      }
    }

    const timestamp = nowISO();
    const messageRows = sentRecipients.flatMap((recipient) => {
      if (recipient.customerId === null) {
        return [];
      }
      const conversationId = latestByCustomer.get(recipient.customerId);
      if (!conversationId) {
        return [];
      }

      return [{
        id: crypto.randomUUID(),
        conversationId,
        senderType: 'agent',
        agentSenderId: String(actor.id),
        content,
        messageType: images.length > 0 ? 'file' : 'text',
        isSent: true,
        sentAt: timestamp,
        deliveryStatus: 'delivered',
        senderName: actor.displayName,
        metadata: JSON.stringify({ broadcastId }),
        createdAt: timestamp,
      } satisfies typeof messages.$inferInsert];
    });

    const units = groupWriteBackUnits(messageRows, images, String(actor.id), timestamp).map((unit) => [
      this.db.insert(messages).values(unit.messages),
      ...chunkItems(unit.attachments, BROADCAST_ATTACHMENT_INSERT_CHUNK_SIZE)
        .map((chunk) => this.db.insert(fileAttachments).values(chunk)),
    ] as const);
    // Whole units per batch: a message and its images commit in the same transaction.
    await runInBatches(units, BROADCAST_WRITE_UNITS_PER_BATCH, (batch) => {
      const [first, ...rest] = batch.flat();
      return this.db.batch([first, ...rest]);
    });
  }

  private async markRecipients(
    recipients: PendingRecipient[],
    status: 'sent' | 'failed' | 'skipped',
    errorReason?: BroadcastRecipientErrorReason
  ): Promise<void> {
    if (recipients.length === 0) {
      return;
    }

    const now = nowISO();
    for (const recipientChunk of chunkItems(recipients, BROADCAST_IN_ARRAY_CHUNK_SIZE)) {
      await this.db
        .update(broadcastRecipients)
        .set({
          status,
          errorReason: errorReason ?? null,
          sentAt: status === 'sent' ? now : null,
        })
        .where(inArray(broadcastRecipients.id, recipientChunk.map((recipient) => recipient.id)));
    }
  }

  private async failRemainingPendingRecipients(broadcastId: string): Promise<void> {
    await this.db
      .update(broadcastRecipients)
      .set({ status: 'failed', errorReason: 'line_api_failed' })
      .where(
        and(
          eq(broadcastRecipients.broadcastId, broadcastId),
          eq(broadcastRecipients.status, 'pending')
        )
      );
  }

  private async restoreDraftStatus(broadcastId: string): Promise<void> {
    await this.db
      .update(broadcasts)
      .set({ status: 'draft', updatedAt: nowISO() })
      .where(eq(broadcasts.id, broadcastId));
  }

  private async finalizeBroadcast(broadcastId: string): Promise<BroadcastSendStats> {
    const recipients = await this.db
      .select({ status: broadcastRecipients.status })
      .from(broadcastRecipients)
      .where(eq(broadcastRecipients.broadcastId, broadcastId));

    const sentCount = recipients.filter((recipient) => recipient.status === 'sent').length;
    const failedCount = recipients.filter((recipient) => recipient.status === 'failed').length;
    const skippedCount = recipients.filter((recipient) => recipient.status === 'skipped').length;
    const status = failedCount === 0 && sentCount > 0
      ? 'completed'
      : sentCount > 0
        ? 'partial_failed'
        : 'failed';

    const stats: BroadcastSendStats = {
      broadcastId,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      skippedCount,
      status,
    };

    await this.db
      .update(broadcasts)
      .set({
        totalRecipients: stats.totalRecipients,
        sentCount,
        failedCount,
        skippedCount,
        status,
        sentAt: nowISO(),
        updatedAt: nowISO(),
      })
      .where(eq(broadcasts.id, broadcastId));

    return stats;
  }
}
