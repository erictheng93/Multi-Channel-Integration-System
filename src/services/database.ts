import { eq, desc, and, or, like } from 'drizzle-orm';
import { Database, KVService } from '../db';
import * as schema from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseService {
  constructor(
    private db: Database,
    private kv: KVService
  ) {}

  // Customer operations (replacing user operations)
  async createCustomer(customerData: Omit<schema.NewCustomer, 'id' | 'createdAt' | 'updatedAt'>) {
    const customer = await this.db.insert(schema.customers).values({
      ...customerData,
    }).returning();

    // Cache the customer
    if (customer[0]) {
      await this.kv.setCache(`customer:${customer[0].id}`, customer[0], 3600);
    }
    
    return customer[0];
  }

  async getCustomerById(id: number) {
    // Try cache first
    const cached = await this.kv.getCache(`customer:${id}`);
    if (cached) return cached;

    const customer = await this.db.select().from(schema.customers).where(eq(schema.customers.id, id)).get();
    
    if (customer) {
      await this.kv.setCache(`customer:${id}`, customer, 3600);
    }
    
    return customer;
  }

  async getCustomerByPlatformId(platformUserId: string, platform: string) {
    const cacheKey = `customer:${platform}:${platformUserId}`;
    const cached = await this.kv.getCache(cacheKey);
    if (cached) return cached;

    const customer = await this.db.select().from(schema.customers)
      .where(and(
        eq(schema.customers.platformUserId, platformUserId),
        eq(schema.customers.platform, platform)
      )).get();

    if (customer) {
      await this.kv.setCache(cacheKey, customer, 3600);
    }

    return customer;
  }

  async updateCustomer(id: number, updates: Partial<schema.NewCustomer>) {
    const customer = await this.db.update(schema.customers)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(schema.customers.id, id))
      .returning();

    // Invalidate cache
    await this.kv.deleteCache(`customer:${id}`);
    
    return customer[0];
  }

  // Agent operations
  async createAgent(agentData: any) {
    const id = uuidv4();
    const agent = await this.db.insert(schema.agents).values({
      id,
      ...agentData,
    }).returning();

    return agent[0];
  }

  async getAgentById(id: string) {
    return await this.db.select().from(schema.agents).where(eq(schema.agents.id, id)).get();
  }

  async getAgentByEmail(email: string) {
    return await this.db.select().from(schema.agents)
      .where(eq(schema.agents.email, email)).get();
  }

  async updateAgentLastLogin(id: string) {
    return await this.db.update(schema.agents)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(schema.agents.id, id))
      .returning();
  }

  // Conversation operations - 並行化優化
  async createConversation(conversationData: Omit<schema.NewConversation, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = uuidv4();
    
    // 並行執行：資料庫插入
    const conversation = await this.db.insert(schema.conversations).values({
      id,
      ...conversationData,
    }).returning();

    // 並行執行：多層快取操作與統計更新
    if (conversation[0]) {
      const parallelCacheOperations = [
        // 快取對話資料
        this.kv.setCache(`conversation:${conversation[0].id}`, conversation[0], 3600),
        // 清除客戶對話列表快取（觸發重新載入）
        this.kv.setCache(`customer_conversations:${conversationData.customerId}`, null, 0),
        // 更新對話統計數量（背景執行）
        this.incrementConversationCount(conversationData.status || 'active')
      ];

      // 並行執行所有快取操作，不阻塞回應
      Promise.all(parallelCacheOperations).catch((error) => {
        console.warn('Cache operations partially failed:', error);
        // 快取失敗不影響主要業務邏輯
      });
    }
    
    return conversation[0];
  }

  async getConversationById(id: string) {
    // Try cache first
    const cached = await this.kv.getCache(`conversation:${id}`);
    if (cached) return cached;

    // Fetch conversation with team and agent information using LEFT JOIN
    const result = await this.db.select()
      .from(schema.conversations)
      .leftJoin(schema.teams, eq(schema.conversations.assignedTeamId, schema.teams.id))
      .leftJoin(schema.agents, eq(schema.conversations.assignedUserId, schema.agents.id))
      .where(eq(schema.conversations.id, id))
      .get();

    if (!result) return null;

    // Enrich conversation with team and agent data
    const conversation = {
      ...result.conversations,
      assignedTeam: result.teams ? {
        id: result.teams.id,
        name: result.teams.name,
        description: result.teams.description
      } : null,
      assignedAgent: result.agents ? {
        id: result.agents.id,
        email: result.agents.email,
        name: result.agents.displayName, // Map displayName to name for consistency
        displayName: result.agents.displayName,
        role: result.agents.role,
        teamId: result.agents.teamId,
        isActive: result.agents.isActive,
        createdAt: result.agents.createdAt,
        lastActive: result.agents.lastActive
      } : null
    };

    // Cache the enriched conversation
    await this.kv.setCache(`conversation:${id}`, conversation, 3600);

    return conversation;
  }

  async getConversationsByCustomerId(customerId: number, limit: number = 50) {
    return await this.db.select().from(schema.conversations)
      .where(eq(schema.conversations.customerId, customerId))
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(limit);
  }

  async getConversationsByAgentId(assignedUserId: number, status?: string, limit: number = 50) {
    const conditions = [eq(schema.conversations.assignedUserId, String(assignedUserId))];
    if (status) {
      conditions.push(eq(schema.conversations.status, status));
    }

    return await this.db.select().from(schema.conversations)
      .where(and(...conditions))
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(limit);
  }

  // Team-based conversation queries for role-based access control
  async getConversationsByTeamId(teamId: number, status?: string, limit: number = 50) {
    const conditions = [];
    if (status) {
      conditions.push(eq(schema.conversations.status, status));
    }

    // Get all conversations where the assigned agent belongs to the specified team
    return await this.db.select({
      id: schema.conversations.id,
      customerId: schema.conversations.customerId,
      assignedUserId: schema.conversations.assignedUserId,
      assignedTeamId: schema.conversations.assignedTeamId,
      status: schema.conversations.status,
      lastMessageAt: schema.conversations.lastMessageAt,
      createdAt: schema.conversations.createdAt,
      updatedAt: schema.conversations.updatedAt,
    })
    .from(schema.conversations)
    .leftJoin(schema.agents, eq(schema.conversations.assignedUserId, schema.agents.id))
    .where(and(
      eq(schema.agents.teamId, teamId),
      ...conditions
    ))
    .orderBy(desc(schema.conversations.lastMessageAt))
    .limit(limit);
  }

  async getAllConversations(status?: string, limit: number = 50) {
    const conditions = [];
    if (status) {
      conditions.push(eq(schema.conversations.status, status));
    }

    return await this.db.select().from(schema.conversations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(limit);
  }

  // Role-based conversation access method
  async getConversationsByRole(agent: schema.Agent, status?: string, limit: number = 50) {
    if (agent.role === 'admin') {
      // Admin can see all conversations
      return await this.getAllConversations(status, limit);
    } else if (agent.role === 'team' && agent.teamId) {
      // Team leaders can see all conversations in their team
      return await this.getConversationsByTeamId(agent.teamId, status, limit);
    } else {
      // Agents can only see their own conversations
      const agentIdAsNumber = parseInt(agent.id) || 0;
      return await this.getConversationsByAgentId(agentIdAsNumber, status, limit);
    }
  }

  async updateConversation(id: string, updates: Partial<schema.NewConversation>) {
    console.log('🔧 [DatabaseService] updateConversation called:', {
      id,
      updates,
      timestamp: new Date().toISOString()
    });

    try {
      const conversation = await this.db.update(schema.conversations)
        .set({ ...updates, updatedAt: new Date().toISOString() })
        .where(eq(schema.conversations.id, id))
        .returning();

      console.log('✅ [DatabaseService] Update executed, result:', {
        success: !!conversation,
        resultLength: conversation?.length,
        updatedConversation: conversation[0] ? {
          id: conversation[0].id,
          status: conversation[0].status,
          assignedTeamId: conversation[0].assignedTeamId,
          assignedUserId: conversation[0].assignedUserId
        } : null
      });

      // Invalidate cache
      await this.kv.deleteCache(`conversation:${id}`);
      console.log('🗑️  [DatabaseService] Cache cleared for conversation:', id);

      return conversation[0];
    } catch (error) {
      console.error('❌ [DatabaseService] updateConversation failed:', error);
      throw error;
    }
  }

  // Message operations - 並行化優化
  async createMessage(messageData: any) {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    // 並行執行：訊息插入 & 對話更新
    const [message] = await Promise.all([
      this.db.insert(schema.messages).values({
        id,
        ...messageData,
      }).returning(),
      // 並行更新對話最後訊息時間
      this.updateConversation(messageData.conversationId, {
        lastMessageAt: timestamp,
      })
    ]);

    // 背景清除訊息快取（不阻塞回應）
    this.invalidateMessageCache(messageData.conversationId).catch((error) => {
      console.warn('Message cache invalidation failed:', error);
    });

    return message[0];
  }

  async getMessagesByConversationId(conversationId: string, limit: number = 100, offset: number = 0) {
    return await this.db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async markMessagesAsRead(_conversationId: string, _agentId: string) {
    // Note: Currently there's no isRead field in messages table
    // This is a placeholder for future implementation
    return Promise.resolve({ success: true });
  }

  // File attachment operations
  async createFileAttachment(attachmentData: any) {
    const id = uuidv4();
    return await this.db.insert(schema.fileAttachments).values({
      id,
      ...attachmentData,
    }).returning();
  }

  async getFileAttachmentsByMessageId(messageId: string) {
    return await this.db.select().from(schema.fileAttachments)
      .where(eq(schema.fileAttachments.messageId, messageId));
  }

  // Delayed message operations
  async createDelayedMessage(messageData: any) {
    const id = uuidv4();
    return await this.db.insert(schema.delayedMessages).values({
      id,
      ...messageData,
    }).returning();
  }

  async getPendingDelayedMessages(beforeTime: string) {
    return await this.db.select().from(schema.delayedMessages)
      .where(and(
        eq(schema.delayedMessages.status, 'pending'),
        eq(schema.delayedMessages.scheduledAt, beforeTime) // This should be <= comparison
      ));
  }

  async updateDelayedMessageStatus(id: string, status: string) {
    return await this.db.update(schema.delayedMessages)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.delayedMessages.id, id))
      .returning();
  }

  // Agent status management (keeping the more advanced version)
  async setAgentOnlineStatus(agentId: string, isOnline: boolean) {
    const key = `agent:${agentId}:status`;
    const statusData = {
      isOnline,
      lastSeen: new Date().toISOString(),
      activeConversations: isOnline ? await this.getActiveConversationCount(agentId) : 0
    };
    
    await this.kv.setCache(key, statusData, 300); // 5 minutes TTL
    return statusData;
  }

  async getAgentOnlineStatus(agentId: string) {
    return await this.kv.getCache(`agent:${agentId}:status`);
  }

  async getActiveConversationCount(agentId: string) {
    const conversations = await this.db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.assignedUserId, agentId.toString()),
        or(
          eq(schema.conversations.status, 'pending'),
          eq(schema.conversations.status, 'in-progress')
        )
      ));
    
    return conversations.length;
  }

  // Batch operations with cache invalidation
  async batchUpdateConversationStatus(conversationIds: string[], status: string, assignedUserId?: string) {
    const updates = conversationIds.map(id => 
      this.db.update(schema.conversations)
        .set({ 
          status, 
          assignedUserId: assignedUserId || null,
          updatedAt: new Date().toISOString() 
        })
        .where(eq(schema.conversations.id, id))
    );

    await Promise.all(updates);

    // Batch cache invalidation
    const cacheInvalidations = conversationIds.map(id => 
      this.kv.deleteCache(`conversation:${id}`)
    );
    await Promise.all(cacheInvalidations);

    return conversationIds.length;
  }

  // Analytics and statistics with caching
  async getConversationStats() {
    const statuses = ['pending', 'in-progress', 'closed'];
    const stats: Record<string, number> = {};
    
    for (const status of statuses) {
      const cached = await this.kv.getCache(`stats:conversations:${status}`);
      if (cached !== null) {
        stats[status] = cached;
      } else {
        // Fallback to DB query and cache result
        const count = await this.db.select().from(schema.conversations)
          .where(eq(schema.conversations.status, status));
        stats[status] = count.length;
        await this.kv.setCache(`stats:conversations:${status}`, stats[status], 3600);
      }
    }
    
    return stats;
  }

  // Message caching for recent conversations
  async invalidateMessageCache(conversationId: string) {
    await this.kv.deleteCache(`messages:${conversationId}:recent`);
  }

  // Search functionality
  async searchConversations(query: string, limit: number = 20) {
    return await this.db.select()
      .from(schema.conversations)
      .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
      .where(
        like(schema.customers.displayName, `%${query}%`)
      )
      .limit(limit);
  }

  async searchMessages(query: string, conversationId?: string, limit: number = 50) {
    let whereCondition = like(schema.messages.content, `%${query}%`);
    
    if (conversationId) {
      const conversationCondition = eq(schema.messages.conversationId, conversationId);
      whereCondition = and(whereCondition, conversationCondition)!;
    }

    return await this.db.select()
      .from(schema.messages)
      .where(whereCondition)
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit);
  }

  // Advanced caching methods
  async incrementConversationCount(status: string) {
    const key = `stats:conversations:${status}`;
    const current = await this.kv.getCache(key) || 0;
    await this.kv.setCache(key, current + 1, 3600);
  }

  // Message caching for recent conversations
  async getCachedRecentMessages(conversationId: string, limit: number = 20) {
    const cacheKey = `messages:${conversationId}:recent`;
    const cached = await this.kv.getCache(cacheKey);
    
    if (cached) return cached;

    const messages = await this.getMessagesByConversationId(conversationId, limit);
    await this.kv.setCache(cacheKey, messages, 600); // 10 minutes
    
    return messages;
  }

  // Get all active agents
  async getAllAgents() {
    return await this.db.select().from(schema.agents)
      .where(eq(schema.agents.isActive, true));
  }

  // Team management operations
  async createTeam(teamData: Omit<schema.NewTeam, 'id' | 'createdAt' | 'updatedAt'>) {
    return await this.db.insert(schema.teams).values({
      ...teamData,
    }).returning();
  }

  async getTeamById(id: number) {
    const result = await this.db.select().from(schema.teams)
      .where(eq(schema.teams.id, id));
    return result[0] || null;
  }

  async getAllTeams(includeInactive: boolean = false) {
    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(schema.teams.isActive, true));
    }

    return await this.db.select().from(schema.teams)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.teams.name);
  }

  async updateTeam(id: number, updates: Partial<schema.NewTeam>) {
    return await this.db.update(schema.teams)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(schema.teams.id, id))
      .returning();
  }

  async deleteTeam(id: number) {
    // Check if there are agents still assigned to this team
    const agents = await this.db.select().from(schema.agents)
      .where(eq(schema.agents.teamId, id));
    
    if (agents.length > 0) {
      throw new Error('Cannot delete team with assigned agents');
    }

    return await this.db.delete(schema.teams)
      .where(eq(schema.teams.id, id));
  }

  async getAgentsByTeamId(teamId: number) {
    return await this.db.select().from(schema.agents)
      .where(eq(schema.agents.teamId, teamId))
      .orderBy(schema.agents.displayName);
  }

  // Permission validation methods
  async canAgentAccessConversation(agent: schema.Agent, conversationId: string): Promise<boolean> {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) {
      return false;
    }

    // Admin can access all conversations
    if (agent.role === 'admin') {
      return true;
    }

    // For unassigned conversations (no assignedTeamId): all users can see them
    if (!conversation.assignedTeamId) {
      return true;
    }

    // For assigned conversations: only users from the assigned team can access
    if (agent.teamId && agent.teamId === conversation.assignedTeamId) {
      return true;
    }

    // Default: deny access
    return false;
  }
}