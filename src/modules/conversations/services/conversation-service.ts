// Conversation Service
// 對話服務層

import { createDbClient } from '@/db/drizzle-factory';
import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import { conversations, messages, customers, agents, teams, conversationTransfers } from '@/db/schema';
import { validateReplyToMessageId } from '@/utils/validate-reply-to';
import type {
  Conversation,
  NewConversation,
  ConversationWithDetails,
  ConversationListRequest,
  ConversationListResponse,
  ConversationAssignRequest,
  ConversationAssignResponse,
  ConversationServiceInterface,
  ConversationMetrics,
  ConversationSearchRequest,
  NewMessage,
  Message,
  ConversationTransfer,
  NewConversationTransfer,
  LatestMessageSummary
} from '../types/conversation-types';

export class ConversationService implements ConversationServiceInterface {
  private db: DrizzleD1Database;
  private rawDb: D1Database;

  constructor(database: D1Database) {
    this.db = drizzle(database);
    this.rawDb = database;
  }

  // Create new conversation
  async createConversation(data: NewConversation): Promise<Conversation> {
    const conversationData = {
      ...data,
      id: data.id || crypto.randomUUID(),
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString()
    };

    await this.db.insert(conversations).values(conversationData);

    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationData.id))
      .limit(1);

    if (!conversation) {
      throw new Error(`Failed to create conversation with ID: ${conversationData.id}`);
    }

    return conversation;
  }

  // Get conversation by ID with details
  // Performance optimized: Single query with subqueries (was 3 separate queries - N+1 fix)
  async getConversation(id: string): Promise<ConversationWithDetails | null> {
    // Single optimized query with subqueries for message count and latest message
    const [result] = await this.db
      .select({
        // Conversation fields
        conversation: conversations,
        // Customer fields (LEFT JOIN)
        customer: customers,
        // Agent fields (LEFT JOIN)
        agent: {
          id: agents.id,
          displayName: agents.displayName,
          email: agents.email
        },
        // Message count via subquery (eliminates separate query)
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM messages
          WHERE messages.conversation_id = ${conversations.id}
        )`.as('messageCount'),
        // Latest message content via subquery (eliminates separate query)
        latestMessageId: sql<string>`(
          SELECT id FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageId'),
        latestMessageContent: sql<string>`(
          SELECT content FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageContent'),
        latestMessageSenderType: sql<string>`(
          SELECT sender_type FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageSenderType'),
        latestMessageCreatedAt: sql<string>`(
          SELECT created_at FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageCreatedAt'),
        latestMessageType: sql<string>`(
          SELECT message_type FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageType')
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      // Note: Agent join removed - only team assignment is supported now
      .where(eq(conversations.id, id))
      .limit(1);

    if (!result) return null;

    // Construct latest message object from subquery results
    const latestMessage: LatestMessageSummary | undefined = result.latestMessageId ? {
      id: result.latestMessageId,
      conversationId: id,
      content: result.latestMessageContent || '',
      senderType: result.latestMessageSenderType || 'customer',
      messageType: result.latestMessageType || 'text',
      createdAt: result.latestMessageCreatedAt || null
    } : undefined;

    return {
      ...result.conversation,
      customer: result.customer || undefined,
      latestMessage: latestMessage,
      messageCount: result.messageCount || 0
      // Note: assignedAgent removed - only team assignment is supported now
    };
  }

  // Update conversation
  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    await this.db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, id));

    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!conversation) {
      throw new Error(`Failed to update conversation with ID: ${id}`);
    }

    return conversation;
  }

  // Delete conversation
  async deleteConversation(id: string): Promise<boolean> {
    try {
      // Delete related messages first
      await this.db.delete(messages).where(eq(messages.conversationId, id));

      // Delete conversation transfers
      await this.db.delete(conversationTransfers).where(eq(conversationTransfers.conversationId, id));

      // Delete conversation
      await this.db.delete(conversations).where(eq(conversations.id, id));

      return true;
    } catch (error) {
      console.error('Delete conversation error:', error);
      return false;
    }
  }

  // List conversations with pagination
  // Performance optimized: Uses subqueries instead of LEFT JOIN + GROUP BY (N+1 fix)
  async listConversations(params: ConversationListRequest): Promise<ConversationListResponse> {
    const {
      page = 1,
      limit = 20,
      status,
      teamId,
      agentId,
      customerId
    } = params;

    const offset = (page - 1) * Math.min(limit, 100);
    const actualLimit = Math.min(limit, 100);

    // Build where conditions
    // Note: agentId filter removed - only team-based filtering is supported now
    const whereConditions = [];
    if (status) whereConditions.push(eq(conversations.status, status));
    if (teamId) whereConditions.push(eq(conversations.assignedTeamId, teamId));
    // Note: Individual agent filter (agentId) removed - only team assignment is supported
    if (customerId) whereConditions.push(eq(conversations.customerId, parseInt(customerId)));

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get conversations with details using subqueries (eliminates GROUP BY overhead)
    const conversationList = await this.db
      .select({
        conversation: conversations,
        customer: customers,
        agent: {
          id: agents.id,
          displayName: agents.displayName,
          email: agents.email
        },
        // Message count via subquery (more efficient than LEFT JOIN + GROUP BY)
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM messages
          WHERE messages.conversation_id = ${conversations.id}
        )`.as('messageCount'),
        // Latest message fields via subqueries for conversation list preview
        latestMessageId: sql<string>`(
          SELECT id FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageId'),
        latestMessageContent: sql<string>`(
          SELECT content FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageContent'),
        latestMessageSenderType: sql<string>`(
          SELECT sender_type FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageSenderType'),
        latestMessageCreatedAt: sql<string>`(
          SELECT created_at FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageCreatedAt'),
        latestMessageType: sql<string>`(
          SELECT message_type FROM messages
          WHERE messages.conversation_id = ${conversations.id}
          ORDER BY created_at DESC LIMIT 1
        )`.as('latestMessageType')
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      // Note: Individual assignment (assignedUserId) removed - only team-based assignment is supported
      .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
      .where(whereClause)
      .orderBy(desc(conversations.updatedAt))
      .limit(actualLimit)
      .offset(offset);

    // Get total count
    const totalResult = await this.db
      .select({ total: count() })
      .from(conversations)
      .where(whereClause);

    const total = totalResult[0]?.total ?? 0;

    return {
      conversations: conversationList.map(row => {
        // Construct latest message object from subquery results
        const latestMessage: LatestMessageSummary | undefined = row.latestMessageId ? {
          id: row.latestMessageId,
          conversationId: row.conversation.id,
          content: row.latestMessageContent || '',
          senderType: row.latestMessageSenderType || 'customer',
          messageType: row.latestMessageType || 'text',
          createdAt: row.latestMessageCreatedAt || null
        } : undefined;

        return {
          ...row.conversation,
          customer: row.customer || undefined,
          latestMessage,
          messageCount: row.messageCount || 0,
          assignedAgent: row.agent || undefined
        };
      }),
      pagination: {
        page,
        limit: actualLimit,
        total,
        totalPages: Math.ceil(total / actualLimit)
      }
    };
  }

  // Search conversations
  async searchConversations(params: ConversationSearchRequest): Promise<ConversationListResponse> {
    // Implementation would include full-text search logic
    // For now, fallback to list with basic filtering
    return this.listConversations({
      page: params.page,
      limit: params.limit,
      status: params.filters?.status?.[0] as 'active' | 'assigned' | 'pending' | undefined,
    });
  }

  // Assign conversation (only team assignment is supported now)
  async assignConversation(id: string, params: ConversationAssignRequest): Promise<ConversationAssignResponse> {
    // Note: userId removed - only team assignment is supported now
    if (!params.teamId) {
      throw new Error('Team ID is required for assignment');
    }

    const updateData: any = {
      assignedTeamId: params.teamId,
      updatedAt: new Date().toISOString()
    };

    await this.db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, id));

    // Create transfer record if reason provided
    let transfer: ConversationTransfer | undefined;
    if (params.reason) {
      const transferData: NewConversationTransfer = {
        conversationId: id,
        toTeamId: params.teamId,
        transferReason: params.reason,
        transferredBy: 'system', // 應該從 context 獲取
        transferType: 'manual',
        createdAt: new Date().toISOString()
      };

      await this.db.insert(conversationTransfers).values(transferData);

      const [createdTransfer] = await this.db
        .select()
        .from(conversationTransfers)
        .where(eq(conversationTransfers.conversationId, id))
        .orderBy(desc(conversationTransfers.createdAt))
        .limit(1);

      if (!createdTransfer) {
        throw new Error('Failed to create transfer record');
      }

      transfer = createdTransfer;
    }

    return {
      success: true,
      conversationId: id,
      assignedTo: {
        type: 'team',
        id: params.teamId,
        name: 'Assigned successfully'
      },
      transfer
    };
  }

  // Transfer conversation (only team-based transfer is supported now)
  // @deprecated Use transferConversationToTeam instead
  async transferConversation(id: string, fromTeamId: number | null, toTeamId: number, reason?: string): Promise<ConversationTransfer> {
    // Update conversation assignment (team only)
    await this.db
      .update(conversations)
      .set({
        assignedTeamId: toTeamId,
        updatedAt: new Date().toISOString()
      })
      .where(eq(conversations.id, id));

    // Create transfer record (team-based)
    const transferData: NewConversationTransfer = {
      conversationId: id,
      fromTeamId: fromTeamId,
      toTeamId: toTeamId,
      transferReason: reason || 'Manual transfer',
      transferredBy: 'system',
      transferType: 'manual',
      createdAt: new Date().toISOString()
    };

    await this.db.insert(conversationTransfers).values(transferData);

    const [transfer] = await this.db
      .select()
      .from(conversationTransfers)
      .where(eq(conversationTransfers.conversationId, id))
      .orderBy(desc(conversationTransfers.createdAt))
      .limit(1);

    if (!transfer) {
      throw new Error('Failed to create transfer record');
    }

    return transfer;
  }

  // Add message to conversation
  async addMessage(conversationId: string, messageData: NewMessage): Promise<Message> {
    // Validate replyToMessageId if provided (prevents orphan FK references)
    if (messageData.replyToMessageId) {
      const validation = await validateReplyToMessageId(
        this.rawDb,
        messageData.replyToMessageId,
        conversationId
      );
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid replyToMessageId');
      }
    }

    const message = {
      ...messageData,
      id: messageData.id || crypto.randomUUID(),
      conversationId,
      createdAt: messageData.createdAt || new Date().toISOString()
    };

    await this.db.insert(messages).values(message);

    // Update conversation updated time
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(conversations.id, conversationId));

    const [createdMessage] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.id, message.id))
      .limit(1);

    if (!createdMessage) {
      throw new Error(`Failed to create message with ID: ${message.id}`);
    }

    return createdMessage;
  }

  // Get messages for conversation
  async getMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(Math.min(limit, 100))
      .offset(offset);
  }

  // Update conversation status
  async updateStatus(id: string, status: string, reason?: string): Promise<Conversation> {
    return this.updateConversation(id, { status });
  }

  // Note: closeConversation and reopenConversation have been removed
  // Closed/resolved statuses are no longer part of the conversation lifecycle

  // Get conversation metrics
  async getConversationMetrics(filters?: any): Promise<ConversationMetrics> {
    // Get basic counts
    const [totalCount] = await this.db
      .select({ count: count() })
      .from(conversations);

    const [activeCount] = await this.db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.status, 'active'));

    // Get team distribution
    const teamDistribution = await this.db
      .select({
        teamId: conversations.assignedTeamId,
        count: count()
      })
      .from(conversations)
      .where(sql`${conversations.assignedTeamId} IS NOT NULL`)
      .groupBy(conversations.assignedTeamId);

    return {
      totalConversations: totalCount?.count || 0,
      openConversations: activeCount?.count || 0,
      closedConversations: 0, // closed status removed
      avgResponseTime: 0, // Would require message analysis
      avgResolutionTime: 0, // Would require time calculation
      teamDistribution: teamDistribution.map(item => ({
        teamId: item.teamId!,
        teamName: `Team ${item.teamId}`, // Would need to join with teams table
        count: item.count
      }))
    };
  }
}