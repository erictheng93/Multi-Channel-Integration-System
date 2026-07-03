import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Bindings, DbUser } from '@/types';
import type { Database } from '@/db/drizzle-factory';
import {
  broadcastRecipients,
  broadcasts,
  channelIntegrations,
  conversations,
  messages,
} from '@/db/schema';
import { nowISO } from '@/utils/timestamp';
import {
  createTextMessage,
  getLineMessageQuota,
  getLineMessageUsage,
  multicastLineMessage,
} from '@/utils/line';
import { createContextLogger } from '@/utils/logger';
import { ChannelCredentialService } from '@modules/integrations/services/channel-credential-service';
import {
  BroadcastServiceError,
  type BroadcastRecipientErrorReason,
  type BroadcastSendStats,
} from '@modules/broadcast/types';
import {
  BROADCAST_IN_ARRAY_CHUNK_SIZE,
  BROADCAST_MESSAGE_INSERT_CHUNK_SIZE,
  chunkItems,
} from './d1-chunks';

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
        const groupSent = await this.sendLineGroup(group, broadcast.content);
        sentRecipients.push(...groupSent);
      }

      await this.writeBackConversationMessages(broadcastId, broadcast.content, actor, sentRecipients);

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

  private async sendLineGroup(group: TokenGroup, content: string): Promise<PendingRecipient[]> {
    try {
      const result = await multicastLineMessage(
        group.token,
        group.recipients.map((recipient) => recipient.platformUserId),
        [createTextMessage(content)]
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
        messageType: 'text',
        isSent: true,
        sentAt: timestamp,
        deliveryStatus: 'delivered',
        senderName: actor.displayName,
        metadata: JSON.stringify({ broadcastId }),
        createdAt: timestamp,
      } satisfies typeof messages.$inferInsert];
    });

    if (messageRows.length > 0) {
      for (const messageChunk of chunkItems(messageRows, BROADCAST_MESSAGE_INSERT_CHUNK_SIZE)) {
        await this.db.insert(messages).values(messageChunk);
      }
    }
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
