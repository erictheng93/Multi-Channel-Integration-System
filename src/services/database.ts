import { eq, desc, and, or, like } from 'drizzle-orm';
import { Database, KVService } from '../db';
import * as schema from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseService {
  constructor(
    private db: Database,
    private kv: KVService
  ) {}

  // User operations
  async createUser(userData: Omit<schema.NewUser, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = uuidv4();
    const user = await this.db.insert(schema.users).values({
      id,
      ...userData,
    }).returning();

    // Cache the user
    await this.kv.cacheUser(id, user[0]);
    
    return user[0];
  }

  async getUserById(id: string) {
    // Try cache first
    const cached = await this.kv.getCachedUser(id);
    if (cached) return cached;

    const user = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).get();
    
    if (user) {
      await this.kv.cacheUser(id, user);
    }
    
    return user;
  }

  async getUserByPlatformId(platformId: string, platform: string) {
    const cacheKey = `user:${platform}:${platformId}`;
    const cached = await this.kv.getCache(cacheKey);
    if (cached) return cached;

    const user = await this.db.select().from(schema.users)
      .where(and(
        eq(schema.users.platformId, platformId),
        eq(schema.users.platform, platform)
      )).get();

    if (user) {
      await this.kv.setCache(cacheKey, user, 3600);
    }

    return user;
  }

  async updateUser(id: string, updates: Partial<schema.NewUser>) {
    const user = await this.db.update(schema.users)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, id))
      .returning();

    // Invalidate cache
    await this.kv.invalidateUserCache(id);
    
    return user[0];
  }

  // Agent operations
  async createAgent(agentData: Omit<schema.NewAgent, 'id' | 'createdAt' | 'updatedAt'>) {
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

  // Conversation operations
  async createConversation(conversationData: Omit<schema.NewConversation, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = uuidv4();
    const conversation = await this.db.insert(schema.conversations).values({
      id,
      ...conversationData,
    }).returning();

    // Multi-layer caching
    await Promise.all([
      this.kv.cacheConversation(id, conversation[0]),
      // Cache by user for quick lookup
      this.kv.setCache(`user_conversations:${conversationData.userId}`, null, 0), // Invalidate user's conversation list
      // Cache conversation count for dashboard
      this.incrementConversationCount(conversationData.status || 'pending')
    ]);
    
    return conversation[0];
  }

  async getConversationById(id: string) {
    // Try cache first
    const cached = await this.kv.getCachedConversation(id);
    if (cached) return cached;

    const conversation = await this.db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, id)).get();

    if (conversation) {
      await this.kv.cacheConversation(id, conversation);
    }

    return conversation;
  }

  async getConversationsByUserId(userId: string, limit: number = 50) {
    return await this.db.select().from(schema.conversations)
      .where(eq(schema.conversations.userId, userId))
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(limit);
  }

  async getConversationsByAgentId(agentId: string, status?: string, limit: number = 50) {
    const conditions = [eq(schema.conversations.agentId, agentId)];
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
      userId: schema.conversations.userId,
      agentId: schema.conversations.agentId,
      platform: schema.conversations.platform,
      status: schema.conversations.status,
      title: schema.conversations.title,
      lastMessageAt: schema.conversations.lastMessageAt,
      createdAt: schema.conversations.createdAt,
      updatedAt: schema.conversations.updatedAt,
    })
    .from(schema.conversations)
    .leftJoin(schema.agents, eq(schema.conversations.agentId, schema.agents.id))
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
      return await this.getConversationsByAgentId(agent.id, status, limit);
    }
  }

  async updateConversation(id: string, updates: Partial<schema.NewConversation>) {
    const conversation = await this.db.update(schema.conversations)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(schema.conversations.id, id))
      .returning();

    // Invalidate cache
    await this.kv.invalidateConversationCache(id);
    
    return conversation[0];
  }

  // Message operations
  async createMessage(messageData: Omit<schema.NewMessage, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = uuidv4();
    const message = await this.db.insert(schema.messages).values({
      id,
      ...messageData,
    }).returning();

    // Update conversation last message time
    await this.updateConversation(messageData.conversationId, {
      lastMessageAt: new Date().toISOString(),
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

  async markMessagesAsRead(conversationId: string, _agentId: string) {
    return await this.db.update(schema.messages)
      .set({ isRead: true })
      .where(and(
        eq(schema.messages.conversationId, conversationId),
        eq(schema.messages.senderType, 'user')
      ));
  }

  // File attachment operations
  async createFileAttachment(attachmentData: Omit<schema.NewFileAttachment, 'id' | 'createdAt'>) {
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
  async createDelayedMessage(messageData: Omit<schema.NewDelayedMessage, 'id' | 'createdAt' | 'updatedAt'>) {
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
        eq(schema.conversations.agentId, agentId),
        or(
          eq(schema.conversations.status, 'pending'),
          eq(schema.conversations.status, 'in-progress')
        )
      ));
    
    return conversations.length;
  }

  // Batch operations with cache invalidation
  async batchUpdateConversationStatus(conversationIds: string[], status: string, agentId?: string) {
    const updates = conversationIds.map(id => 
      this.db.update(schema.conversations)
        .set({ 
          status, 
          agentId: agentId || null,
          updatedAt: new Date().toISOString() 
        })
        .where(eq(schema.conversations.id, id))
    );

    await Promise.all(updates);

    // Batch cache invalidation
    const cacheInvalidations = conversationIds.map(id => 
      this.kv.invalidateConversationCache(id)
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
      .leftJoin(schema.users, eq(schema.conversations.userId, schema.users.id))
      .where(or(
        like(schema.conversations.title, `%${query}%`),
        like(schema.users.displayName, `%${query}%`)
      ))
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

    // If conversation has an assigned agent
    if (conversation.agentId) {
      // Team leaders can access conversations assigned to agents in their team
      if (agent.role === 'team' && agent.teamId) {
        const assignedAgent = await this.getAgentById(conversation.agentId);
        return assignedAgent?.teamId === agent.teamId;
      }
      
      // Agents can only access their own conversations
      return conversation.agentId === agent.id;
    }

    // For unassigned conversations:
    // Team leaders can access unassigned conversations (to potentially assign them)
    if (agent.role === 'team') {
      return true;
    }

    // Agents can access unassigned conversations to potentially take them
    return agent.role === 'agent';
  }
}