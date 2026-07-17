// Secure WebSocket Authentication Service
// Provides secure authentication without exposing JWT tokens in query parameters

import type { Bindings } from '../types';
import { validateAccessTokenPayload } from '@/middleware/auth';
import { canConversationBeAccessedBy } from './conversation-access';
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

  constructor(private env: Bindings) {}

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

    console.log(`[WebSocketAuth] Challenge generated for user ${userId}: ${challengeId}`);
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
        console.log(`[WebSocketAuth] Invalid challenge ID: ${challengeId}`);
        return { isValid: false };
      }

      if (nowMs() > challenge.expiresAt) {
        console.log(`[WebSocketAuth] Expired challenge: ${challengeId}`);
        this.challenges.delete(challengeId);
        return { isValid: false };
      }

      // Verify JWT token
      const payload = await validateAccessTokenPayload(this.env, token);
      if (!payload) {
        console.log(`[WebSocketAuth] Invalid JWT token`);
        return { isValid: false };
      }

      // Verify signature (HMAC of challengeId + token)
      const expectedSignature = await this.generateSignature(challengeId, token);
      if (signature !== expectedSignature) {
        console.log(`[WebSocketAuth] Invalid signature`);
        return { isValid: false };
      }

      // Clean up used challenge
      this.challenges.delete(challengeId);

      console.log(`[WebSocketAuth] Authentication successful for user ${payload.userId}`);

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
      console.error('[WebSocketAuth] Verification error:', error);
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

    // 使用 UTF-8 安全的編碼函數
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
      // 使用 UTF-8 安全的解碼函數
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

  /**
   * Check if user has access to a conversation
   *
   * Shares the same access predicate as the realtime path
   * (canConversationBeAccessedBy): a single indexed lookup of the target
   * conversation instead of scanning every conversation the agent could see.
   */
  async authorizeConversationAccess(
    userId: string,
    userRole: string,
    conversationId: string,
    teamIds: number[] = []
  ): Promise<boolean> {
    // Admins have access to all conversations
    if (userRole === 'admin') {
      console.log(`[WebSocketAuth] Admin ${userId} granted access to conversation ${conversationId}`);
      return true;
    }

    try {
      const { allowed } = await canConversationBeAccessedBy(
        this.env,
        { userId, role: userRole, allowedTeamIds: teamIds },
        conversationId
      );

      if (allowed) {
        console.log(`[WebSocketAuth] Agent ${userId} granted access to conversation ${conversationId}`);
      } else {
        console.log(`[WebSocketAuth] Agent ${userId} denied access to conversation ${conversationId}`);
      }

      return allowed;
    } catch (error) {
      // Fail closed for this request only: a transient D1 error denies this
      // single upgrade attempt instead of throwing out of the auth middleware.
      console.error('[WebSocketAuth] Conversation access check failed:', error);
      return false;
    }
  }
}
