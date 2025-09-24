// Secure WebSocket Authentication Service
// Provides secure authentication without exposing JWT tokens in query parameters

import type { Bindings } from '../types';
import { verifyJWT } from '../utils/auth';

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

      if (Date.now() > challenge.expiresAt) {
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

      if (payload.teamId !== undefined) {
        result.teamId = payload.teamId;
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
    const now = Date.now();
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

    // Create a simple base64 encoded payload for URL safety
    return btoa(JSON.stringify(payload));
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
      const payload = JSON.parse(atob(token));

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
}