import { DatabaseService } from './database';
import { KVService } from '../db';
import type {
  // AgentStatus
} from '../types/services';

export class ConversationService {
  constructor(
    private dbService: DatabaseService,
    private kv: KVService
  ) {}

  // Smart conversation assignment with load balancing
  async assignConversationToAgent(conversationId: string, agentId?: string) {
    // Acquire lock to prevent race conditions
    const lockId = await this.kv.acquireLock(`assign:${conversationId}`, 30);
    if (!lockId) {
      throw new Error('Conversation is being assigned by another process');
    }

    try {
      // If no agent specified, find the best available agent
      if (!agentId) {
        const bestAgent = await this.findBestAvailableAgent();
        if (!bestAgent) {
          throw new Error('No available agents');
        }
        agentId = bestAgent;
      }

      // Update conversation
      const conversation = await this.dbService.updateConversation(conversationId, {
        assignedUserId: agentId, // Keep as string to match agents table TEXT id
        status: 'in-progress',
        updatedAt: new Date().toISOString()
      });

      // Update agent status
      await this.dbService.setAgentOnlineStatus(agentId, true);

      // Publish assignment event
      await this.kv.publishEvent('conversation_assigned', {
        conversationId,
        agentId,
        timestamp: new Date().toISOString()
      });

      return conversation;
    } finally {
      await this.kv.releaseLock(`assign:${conversationId}`, lockId);
    }
  }

  private async findBestAvailableAgent(): Promise<string | null> {
    // Get all online agents with their current workload
    const agents = await this.dbService.getAllAgents();

    const agentWorkloads = await Promise.all(
      agents.map(async (agent) => {
        const status = await this.dbService.getAgentOnlineStatus(agent.id.toString());
        const activeCount = await this.dbService.getActiveConversationCount(agent.id.toString());
        
        return {
          agent,
          isOnline: status?.isOnline || false,
          activeConversations: activeCount,
          lastSeen: status?.lastSeen
        };
      })
    );

    // Find agent with least workload who is online
    const availableAgents = agentWorkloads
      .filter((a) => a.isOnline)
      .sort((a, b) => a.activeConversations - b.activeConversations);

    return availableAgents[0]?.agent?.id?.toString() || null;
  }

  // Real-time message handling with caching
  async sendMessage(conversationId: string, senderId: string, content: string, senderType: 'user' | 'agent') {
    // Rate limiting check
    const rateLimit = await this.kv.checkRateLimit(`messages:${senderId}`, 60, 60); // 60 messages per minute
    if (!rateLimit.allowed) {
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds`);
    }

    // Create message  
    const message = await this.dbService.createMessage({
      conversationId,
      senderType,
      agentSenderId: senderType === 'agent' ? senderId : null,
      customerSenderId: senderType === 'user' ? parseInt(senderId) || null : null,
      content,
      messageType: 'text'
    });

    // Invalidate message cache
    await this.dbService.invalidateMessageCache(conversationId);

    // Update conversation last activity
    await this.dbService.updateConversation(conversationId, {
      lastMessageAt: new Date().toISOString()
    });

    // Publish real-time event
    await this.kv.publishEvent(`conversation:${conversationId}`, {
      type: 'new_message',
      message,
      timestamp: new Date().toISOString()
    });

    return message;
  }

  // Bulk operations for admin dashboard
  async bulkAssignConversations(conversationIds: string[], agentId: string) {
    const lockIds = [];
    
    try {
      // Acquire locks for all conversations
      for (const convId of conversationIds) {
        const lockId = await this.kv.acquireLock(`assign:${convId}`, 60);
        if (!lockId) {
          throw new Error(`Failed to acquire lock for conversation ${convId}`);
        }
        lockIds.push({ convId, lockId });
      }

      // Perform bulk update
      const result = await this.dbService.batchUpdateConversationStatus(
        conversationIds, 
        'in-progress', 
        agentId // Keep as string to match database schema
      );

      // Publish bulk assignment event
      await this.kv.publishEvent('bulk_assignment', {
        conversationIds,
        agentId,
        count: result,
        timestamp: new Date().toISOString()
      });

      return result;
    } finally {
      // Release all locks
      for (const { convId, lockId } of lockIds) {
        await this.kv.releaseLock(`assign:${convId}`, lockId);
      }
    }
  }

  // Analytics and reporting
  async getConversationAnalytics(timeRange: 'day' | 'week' | 'month' = 'day') {
    const cacheKey = `analytics:conversations:${timeRange}`;
    const cached = await this.kv.getCache(cacheKey);
    
    if (cached) return cached;

    // Calculate analytics from database
    const stats = await this.dbService.getConversationStats();
    
    // Add time-based metrics
    const now = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case 'day':
        startTime.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startTime.setDate(now.getDate() - 7);
        break;
      case 'month':
        startTime.setMonth(now.getMonth() - 1);
        break;
    }

    const analytics = {
      ...stats,
      timeRange,
      generatedAt: new Date().toISOString(),
      // Add more metrics as needed
    };

    // Cache for appropriate duration
    const ttl = timeRange === 'day' ? 300 : timeRange === 'week' ? 1800 : 3600;
    await this.kv.setCache(cacheKey, analytics, ttl);

    return analytics;
  }
}