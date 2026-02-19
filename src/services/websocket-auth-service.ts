// Secure WebSocket Authentication Service
// Provides secure authentication without exposing JWT tokens in query parameters

import type { Bindings } from '../types';
import { verifyJWT } from '../utils/auth';
import { createDbClient } from '../db/drizzle-factory';
import { conversations } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { nowMs } from '@/utils/timestamp'

/**
 * UTF-8 安全的 Base64 編碼
 * 使用 TextEncoder 支持所有 Unicode 字符
 */
function base64Encode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const binaryString = String.fromCharCode(...data);
  return btoa(binaryString);
}

/**
 * UTF-8 安全的 Base64 解碼
 * 使用 TextDecoder 支持所有 Unicode 字符
 */
function base64Decode(str: string): string {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

export interface WebSocketAuthChallenge {
  challengeId: string;
  expiresAt: number;
}

export interface WebSocketAuthResponse {
  challengeId: string;
  token: string;
  signature: string;
}

export class WebSocketAuthService {
  private challenges = new Map<string, WebSocketAuthChallenge>();
  private readonly CHALLENGE_TTL = 30000; // 30 seconds
  private readonly CONVERSATION_CACHE_TTL = 300; // 5 minutes

  constructor(
    private env: Bindings,
    private db?: D1Database,
    private cache?: KVNamespace
  ) {}

  /**
   * Generate authentication challenge for WebSocket connection
   * This is called via HTTP API before WebSocket upgrade
   */
  async generateChallenge(userId: string): Promise<WebSocketAuthChallenge> {
    const challengeId = crypto.randomUUID();
    const challenge: WebSocketAuthChallenge = {
      challengeId,
      expiresAt: Date.now() + this.CHALLENGE_TTL
    };

    // Store challenge temporarily
    this.challenges.set(challengeId, challenge);

    // Clean up expired challenges
    this.cleanupExpiredChallenges();

    console.log(`🔐 [WebSocketAuth] Challenge generated for user ${userId}: ${challengeId}`);
    return challenge;
  }

  /**
   * Verify authentication response during WebSocket handshake
   */
  async verifyAuthResponse(authResponse: WebSocketAuthResponse): Promise<{
    isValid: boolean;
    userId?: string;
    role?: string;
    teamId?: number;
  }> {
    try {
      const { challengeId, token, signature } = authResponse;

      // Check if challenge exists and is not expired
      const challenge = this.challenges.get(challengeId);
      if (!challenge) {
        console.log(`❌ [WebSocketAuth] Invalid challenge ID: ${challengeId}`);
        return { isValid: false };
      }

      if (nowMs() > challenge.expiresAt) {
        console.log(`❌ [WebSocketAuth] Expired challenge: ${challengeId}`);
        this.challenges.delete(challengeId);
        return { isValid: false };
      }

      // Verify JWT token
      const payload = await verifyJWT(token, this.env.JWT_SECRET);
      if (!payload) {
        console.log(`❌ [WebSocketAuth] Invalid JWT token`);
        return { isValid: false };
      }

      // Verify signature (HMAC of challengeId + token)
      const expectedSignature = await this.generateSignature(challengeId, token);
      if (signature !== expectedSignature) {
        console.log(`❌ [WebSocketAuth] Invalid signature`);
        return { isValid: false };
      }

      // Clean up used challenge
      this.challenges.delete(challengeId);

      console.log(`✅ [WebSocketAuth] Authentication successful for user ${payload.userId}`);

      const result: { isValid: boolean; userId?: string; role?: string; teamId?: number; } = {
        isValid: true,
        userId: String(payload.userId || '0'),
        role: payload.role || 'agent'
      };

      if (payload.primaryTeamId !== undefined) {
        result.teamId = payload.primaryTeamId;
      }

      return result;

    } catch (error) {
      console.error('❌ [WebSocketAuth] Verification error:', error);
      return { isValid: false };
    }
  }

  /**
   * Generate HMAC signature for challenge + token
   */
  private async generateSignature(challengeId: string, token: string): Promise<string> {
    const data = challengeId + ':' + token;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.env.JWT_SECRET);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Clean up expired challenges
   */
  private cleanupExpiredChallenges(): void {
    const now = nowMs();
    for (const [challengeId, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(challengeId);
      }
    }
  }

  /**
   * Create temporary connection token for WebSocket URL
   * This is a short-lived token that doesn't contain sensitive data
   */
  async createConnectionToken(userId: string, challengeId: string): Promise<string> {
    const payload = {
      sub: 'websocket_connection',
      userId,
      challengeId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 // 1 minute
    };

    // ✅ 使用 UTF-8 安全的編碼函數
    return base64Encode(JSON.stringify(payload));
  }

  /**
   * Verify connection token from WebSocket URL
   */
  async verifyConnectionToken(token: string): Promise<{
    isValid: boolean;
    userId?: string;
    challengeId?: string;
  }> {
    try {
      // ✅ 使用 UTF-8 安全的解碼函數
      const payload = JSON.parse(base64Decode(token));

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return { isValid: false };
      }

      if (payload.sub !== 'websocket_connection') {
        return { isValid: false };
      }

      return {
        isValid: true,
        userId: payload.userId,
        challengeId: payload.challengeId
      };
    } catch {
      return { isValid: false };
    }
  }

  // =================== P2-3: Agent Conversation List from Database ===================

  /**
   * Get conversations assigned to an agent from database
   * P2-3 IMPLEMENTED: Replace hardcoded conversation list with database query
   */
  private async getAgentConversations(
    agentId: string,
    teamId?: number
  ): Promise<string[]> {
    if (!this.db) {
      console.warn('[WebSocketAuth] Database not available, returning empty conversation list');
      return [];
    }

    try {
      const dbClient = createDbClient(this.db);

      // Note: Individual assignment (assignedUserId) removed - only team-based access control
      // Query conversations assigned to agent's team
      let conversationIds: string[] = [];

      if (teamId) {
        const teamAssigned = await dbClient
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.assignedTeamId, teamId));

        conversationIds = teamAssigned.map(c => c.id);
      }

      // Include unassigned conversations (available pool)
      const unassigned = await dbClient
        .select({ id: conversations.id })
        .from(conversations)
        .where(isNull(conversations.assignedTeamId));

      conversationIds.push(...unassigned.map(c => c.id));

      // Remove duplicates
      const uniqueIds = [...new Set(conversationIds)];

      console.log(`📋 [WebSocketAuth] Agent ${agentId} has access to ${uniqueIds.length} conversations`);
      return uniqueIds;
    } catch (error) {
      console.error('[WebSocketAuth] Error fetching agent conversations:', error);
      return [];
    }
  }

  /**
   * Get agent conversations with caching
   * P2-3 IMPLEMENTED: 5-minute TTL cache for performance
   */
  async getAgentConversationsWithCache(
    agentId: string,
    teamId?: number
  ): Promise<string[]> {
    if (!this.cache) {
      // No cache available, query database directly
      return this.getAgentConversations(agentId, teamId);
    }

    const cacheKey = `agent_conversations:${agentId}`;

    try {
      // Try cache first
      const cached = await this.cache.get(cacheKey, 'json');
      if (cached && Array.isArray(cached)) {
        console.log(`💾 [WebSocketAuth] Cache hit for agent ${agentId} conversations`);
        return cached as string[];
      }
    } catch (cacheError) {
      console.warn('[WebSocketAuth] Cache read error:', cacheError);
    }

    // Fetch from database
    const conversationIds = await this.getAgentConversations(agentId, teamId);

    // Cache for 5 minutes
    try {
      await this.cache.put(cacheKey, JSON.stringify(conversationIds), {
        expirationTtl: this.CONVERSATION_CACHE_TTL
      });
      console.log(`💾 [WebSocketAuth] Cached ${conversationIds.length} conversations for agent ${agentId}`);
    } catch (cacheError) {
      console.warn('[WebSocketAuth] Cache write error:', cacheError);
    }

    return conversationIds;
  }

  /**
   * Check if user has access to a conversation
   * P2-3 IMPLEMENTED: Database-backed authorization
   */
  async authorizeConversationAccess(
    userId: string,
    userRole: string,
    conversationId: string,
    teamId?: number
  ): Promise<boolean> {
    // Admins have access to all conversations
    if (userRole === 'admin') {
      console.log(`✅ [WebSocketAuth] Admin ${userId} granted access to conversation ${conversationId}`);
      return true;
    }

    // For agents, check database (with caching)
    const allowedConversations = await this.getAgentConversationsWithCache(userId, teamId);
    const hasAccess = allowedConversations.includes(conversationId);

    if (hasAccess) {
      console.log(`✅ [WebSocketAuth] Agent ${userId} granted access to conversation ${conversationId}`);
    } else {
      console.log(`❌ [WebSocketAuth] Agent ${userId} denied access to conversation ${conversationId}`);
    }

    return hasAccess;
  }

  /**
   * Invalidate agent conversation cache
   * P2-3 IMPLEMENTED: Call this when conversation assignments change
   */
  async invalidateAgentConversationCache(agentId: string): Promise<void> {
    if (!this.cache) {
      return;
    }

    const cacheKey = `agent_conversations:${agentId}`;

    try {
      await this.cache.delete(cacheKey);
      console.log(`🗑️  [WebSocketAuth] Invalidated conversation cache for agent ${agentId}`);
    } catch (error) {
      console.error('[WebSocketAuth] Failed to invalidate cache:', error);
    }
  }
}