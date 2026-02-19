// Room Auth Service
// Challenge-response auth flow, challenge generation, JWT verification

import type { WebSocketAuthChallenge } from '../../services/websocket-auth-service';
import type { RoomContext, RoomHelpers } from './room-helpers';
import { testSafeLog, testSafeError, getEmojiPrefix } from '../../utils/test-logger';
import { nowMs } from '@/utils/timestamp'

/**
 * Handles all authentication logic for ConversationRoom:
 * - Full mode: Token-based + Challenge-Response authentication
 * - Simplified mode: Query parameter authentication
 * - Challenge generation and verification
 * - HMAC signature generation
 */
export class RoomAuthService {
  constructor(
    private ctx: RoomContext,
    private helpers: RoomHelpers
  ) {}

  /**
   * Full mode authentication: Token-based or Challenge-Response
   */
  async authenticateFullMode(url: URL, request: Request): Promise<{
    success: boolean;
    userId?: string;
    role?: string;
    error?: string;
    status?: number;
  }> {
    const challengeId = url.searchParams.get('challengeId');
    const signature = url.searchParams.get('signature');
    const token = url.searchParams.get('token');

    // Authentication Method 1: Token-based (recommended, used by frontend)
    if (token) {
      testSafeLog(`${getEmojiPrefix('INFO')}[ConversationRoom] Using token authentication`);

      try {
        const { verifyJWT } = await import('../../utils/auth');
        if (!this.ctx.env.JWT_SECRET) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        const payload = await verifyJWT(token, this.ctx.env.JWT_SECRET);

        testSafeLog(`${getEmojiPrefix('CHECK')}[ConversationRoom] Token valid for user ${payload.userId} with role ${payload.role}`);
        return {
          success: true,
          userId: String(payload.userId),
          role: payload.role
        };
      } catch (error) {
        testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Token validation failed:`, error);
        return {
          success: false,
          error: 'Unauthorized - Invalid token',
          status: 401
        };
      }
    }
    // Authentication Method 2: Challenge-Response (backward compatibility)
    else if (challengeId && signature) {
      testSafeLog(`${getEmojiPrefix('INFO')}[ConversationRoom] Using challenge-response authentication`);

      const authResult = await this.verifyAuthResponse(challengeId, signature);
      if (!authResult.isValid || !authResult.userId || !authResult.role) {
        return {
          success: false,
          error: 'Unauthorized - Invalid challenge response',
          status: 401
        };
      }

      return {
        success: true,
        userId: authResult.userId,
        role: authResult.role
      };
    }
    // No valid authentication method provided
    else {
      return {
        success: false,
        error: 'Missing authentication parameters. Provide either token or challengeId+signature.',
        status: 400
      };
    }
  }

  /**
   * Simplified mode authentication: Query parameters only
   */
  async authenticateSimplifiedMode(url: URL): Promise<{
    success: boolean;
    userId?: string;
    role?: string;
    error?: string;
    status?: number;
  }> {
    const userId = url.searchParams.get('userId');
    const token = url.searchParams.get('token');
    const role = url.searchParams.get('role') as 'admin' | 'agent';

    if (!userId || !token || !role) {
      return {
        success: false,
        error: 'Missing required parameters (userId, token, role)',
        status: 400
      };
    }

    return {
      success: true,
      userId,
      role
    };
  }

  /**
   * Generate authentication challenge for WebSocket connection (Full Mode Only)
   * Called via HTTP before WebSocket upgrade
   */
  async handleGenerateChallenge(request: Request): Promise<Response> {
    try {
      // Verify the request contains a valid JWT token
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.substring(7);

      // Verify JWT token
      const { verifyJWT } = await import('../../utils/auth');
      const payload = await verifyJWT(token, this.ctx.env.JWT_SECRET);

      if (!payload || !payload.userId) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Generate challenge
      const challengeId = crypto.randomUUID();
      const challenge: WebSocketAuthChallenge = {
        challengeId,
        expiresAt: Date.now() + this.ctx.CHALLENGE_TTL
      };

      // Store challenge in Durable Object storage for persistence
      await this.ctx.state.storage.put(`challenge:${challengeId}`, {
        ...challenge,
        userId: payload.userId,
        role: payload.role,
        token
      });

      // Also keep in memory for fast access
      this.ctx.challenges.set(challengeId, challenge);

      // Clean up expired challenges
      this.cleanupExpiredChallenges();

      testSafeLog(`${getEmojiPrefix('INFO')}[ConversationRoom] Challenge generated for user ${payload.userId}: ${challengeId}`);

      return new Response(JSON.stringify({
        challengeId,
        expiresAt: challenge.expiresAt,
        ttl: this.ctx.CHALLENGE_TTL
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Challenge generation error:`, error);
      return new Response(JSON.stringify({ error: 'Failed to generate challenge' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Verify authentication response during WebSocket handshake (Full Mode Only)
   */
  async verifyAuthResponse(challengeId: string, signature: string): Promise<{
    isValid: boolean;
    userId?: string;
    role?: 'admin' | 'agent';
    teamId?: number;
  }> {
    try {
      // Check if challenge exists in storage
      const challengeData = await this.ctx.state.storage.get(`challenge:${challengeId}`) as any;

      if (!challengeData) {
        testSafeLog(`[ConversationRoom] Invalid challenge ID: ${challengeId}`);
        return { isValid: false };
      }

      // Check if challenge is expired
      if (nowMs() > challengeData.expiresAt) {
        testSafeLog(`[ConversationRoom] Expired challenge: ${challengeId}`);
        await this.ctx.state.storage.delete(`challenge:${challengeId}`);
        this.ctx.challenges.delete(challengeId);
        return { isValid: false };
      }

      // Verify signature (HMAC of challengeId + token)
      const expectedSignature = await this.generateSignature(challengeId, challengeData.token);
      if (signature !== expectedSignature) {
        testSafeLog(`[ConversationRoom] Invalid signature for challenge ${challengeId}`);
        return { isValid: false };
      }

      // Clean up used challenge
      await this.ctx.state.storage.delete(`challenge:${challengeId}`);
      this.ctx.challenges.delete(challengeId);

      testSafeLog(`${getEmojiPrefix('CHECK')}[ConversationRoom] Authentication successful for user ${challengeData.userId}`);

      return {
        isValid: true,
        userId: String(challengeData.userId),
        role: challengeData.role || 'agent',
        teamId: challengeData.teamId
      };

    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Auth verification error:`, error);
      return { isValid: false };
    }
  }

  /**
   * Generate HMAC signature for challenge + token (Full Mode Only)
   */
  async generateSignature(challengeId: string, token: string): Promise<string> {
    const data = challengeId + ':' + token;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.ctx.env.JWT_SECRET);
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
   * Clean up expired challenges (Full Mode Only)
   */
  cleanupExpiredChallenges(): void {
    const now = nowMs();
    for (const [challengeId, challenge] of this.ctx.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.ctx.challenges.delete(challengeId);
        this.ctx.state.storage.delete(`challenge:${challengeId}`).catch(() => {});
      }
    }
  }
}
