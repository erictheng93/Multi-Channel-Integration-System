// Conversation Service
// 對話服務層

import { createDbClient } from '../../../db/drizzle-factory';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import { conversations, messages, customers, agents, conversationTransfers } from '@/db/schema';
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
  NewConversationTransfer
} from '../types/conversation-types';

export class ConversationService implements ConversationServiceInterface {
  private db: DrizzleD1Database;

  constructor(database: D1Database) {
    this.db = drizzle(database);
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
  async getConversation(id: string): Promise<ConversationWithDetails | null> {
    const [result] = await this.db
      .select({
        conversation: conversations,
        customer: customers,
        agent: {
          id: agents.id,
          displayName: agents.displayName,
          email: agents.email
        }
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .leftJoin(agents, eq(conversations.assignedUserId, agents.id))
      .where(eq(conversations.id, id))
      .limit(1);

    if (!result) return null;

    // Get latest message
    const [latestMessage] = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    // Get message count
    const messageCountResult = await this.db
      .select({ messageCount: count() })
      .from(messages)
      .where(eq(messages.conversationId, id));

    return {
      ...result.conversation,
      customer: result.customer || undefined,
      latestMessage: latestMessage || undefined,
      messageCount: messageCountResult[0]?.messageCount || 0,
      assignedAgent: result.agent || undefined
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
    const whereConditions = [];
    if (status) whereConditions.push(eq(conversations.status, status));
    if (teamId) whereConditions.push(eq(conversations.assignedTeamId, teamId));
    if (agentId) whereConditions.push(eq(conversations.assignedUserId, agentId));
    if (customerId) whereConditions.push(eq(conversations.customerId, parseInt(customerId)));

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get conversations with details
    const conversationList = await this.db
      .select({
        conversation: conversations,
        customer: customers,
        agent: {
          id: agents.id,
          displayName: agents.displayName,
          email: agents.email
        },
        messageCount: count(messages.id)
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .leftJoin(agents, eq(conversations.assignedUserId, agents.id))
      .leftJoin(messages, eq(conversations.id, messages.conversationId))
      .where(whereClause)
      .groupBy(conversations.id)
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
      conversations: conversationList.map(row => ({
        ...row.conversation,
        customer: row.customer || undefined,
        messageCount: row.messageCount,
        assignedAgent: row.agent || undefined
      })),
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
      status: params.filters?.status?.[0] as 'open' | 'closed' | 'pending' | undefined,
    });
  }

  // Assign conversation
  async assignConversation(id: string, params: ConversationAssignRequest): Promise<ConversationAssignResponse> {
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (params.teamId) updateData.assignedTeamId = params.teamId;
    if (params.userId) updateData.assignedUserId = params.userId;

    await this.db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, id));

    // Create transfer record if reason provided
    let transfer: ConversationTransfer | undefined;
    if (params.reason && params.userId) {
      const transferData: NewConversationTransfer = {
        conversationId: id,
        toUserId: params.userId,
        toTeamId: params.teamId || null,
        transferReason: params.reason,
        transferredBy: params.userId, // 假設是相同用戶進行轉移，實際應該從 context 獲取
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
        type: params.teamId ? 'team' : 'user',
        id: params.teamId || params.userId!,
        name: 'Assigned successfully'
      },
      transfer
    };
  }

  // Transfer conversation
  async transferConversation(id: string, fromAgentId: string, toAgentId: string, reason?: string): Promise<ConversationTransfer> {
    // Update conversation assignment
    await this.db
      .update(conversations)
      .set({
        assignedUserId: toAgentId,
        updatedAt: new Date().toISOString()
      })
      .where(eq(conversations.id, id));

    // Create transfer record
    const transferData: NewConversationTransfer = {
      conversationId: id,
      fromUserId: fromAgentId,
      toUserId: toAgentId,
      transferReason: reason || 'Manual transfer',
      transferredBy: fromAgentId,
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

  // Close conversation
  async closeConversation(id: string, reason?: string): Promise<Conversation> {
    return this.updateConversation(id, {
      status: 'closed',
      closedAt: new Date().toISOString()
    });
  }

  // Reopen conversation
  async reopenConversation(id: string): Promise<Conversation> {
    return this.updateConversation(id, {
      status: 'open',
      closedAt: null
    });
  }

  // Get conversation metrics
  async getConversationMetrics(filters?: any): Promise<ConversationMetrics> {
    // Get basic counts
    const [totalCount] = await this.db
      .select({ count: count() })
      .from(conversations);

    const [openCount] = await this.db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.status, 'open'));

    const [closedCount] = await this.db
      .select({ count: count() })
      .from(conversations)
      .where(eq(conversations.status, 'closed'));

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
      openConversations: openCount?.count || 0,
      closedConversations: closedCount?.count || 0,
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