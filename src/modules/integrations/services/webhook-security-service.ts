// Webhook Security Service - Thin Orchestrator
// Delegates to sub-modules for each security concern

import type { Bindings } from '@/types';
import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import type { SecurityValidationResult } from './webhook-security-types';
import { WebhookSignatureVerifier } from './webhook-signature-verifier';
import { WebhookTimestampValidator } from './webhook-timestamp-validator';
import { WebhookReplayDetector } from './webhook-replay-detector';
import { WebhookRateLimiter } from './webhook-rate-limiter';
import { WebhookSecurityLogger } from './webhook-security-logger';
import { WebhookSourceVerifier } from './webhook-source-verifier';
import { nowISO } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookSecurity');

// Re-export for backward compatibility
export type { SecurityValidationResult } from './webhook-security-types';

/**
 * Webhook Security Service (Orchestrator)
 *
 * Coordinates enterprise-grade webhook security verification:
 * - HMAC signature verification (LINE, Facebook)
 * - Timestamp validation (anti-replay)
 * - Request ID deduplication
 * - Rate limiting
 * - Source IP verification
 * - Security event logging and alerting
 */
export class WebhookSecurityService {
  private readonly signatureVerifier: WebhookSignatureVerifier;
  private readonly timestampValidator: WebhookTimestampValidator;
  private readonly replayDetector: WebhookReplayDetector;
  private readonly rateLimiter: WebhookRateLimiter;
  private readonly securityLogger: WebhookSecurityLogger;
  private readonly sourceVerifier: WebhookSourceVerifier;

  constructor(
    env: Bindings,
    private db: D1Database,
    private cache: KVNamespace,
    options?: {
      enableIPWhitelist?: boolean;
    }
  ) {
    this.signatureVerifier = new WebhookSignatureVerifier(
      (integrationId) => this.getIntegrationCredentials(integrationId)
    );
    this.timestampValidator = new WebhookTimestampValidator();
    this.replayDetector = new WebhookReplayDetector(cache);
    this.rateLimiter = new WebhookRateLimiter(cache);
    this.securityLogger = new WebhookSecurityLogger(env, db, cache);
    this.sourceVerifier = new WebhookSourceVerifier({
      enableIPWhitelist: options?.enableIPWhitelist
    });
  }

  /**
   * Full webhook security validation pipeline:
   * signature -> timestamp -> replay -> rate-limit -> source
   */
  async validateWebhookSecurity(
    platform: IntegrationPlatform,
    integrationId: string,
    headers: Record<string, string>,
    body: string | unknown,
    sourceIP?: string
  ): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      valid: false,
      errors: [],
      warnings: [],
      details: {},
      metadata: {
        platform,
        sourceIP,
        timestamp: nowISO()
      }
    };

    try {
      // Parse body if string
      let parsedBody: Record<string, unknown> = body as Record<string, unknown>;
      if (typeof body === 'string') {
        try {
          parsedBody = JSON.parse(body) as Record<string, unknown>;
        } catch {
          // Keep as-is if parse fails
        }
      }

      // 1. Signature verification
      const signatureResult = await this.signatureVerifier.verifySignature(
        platform, integrationId, headers, body
      );
      result.details.signatureValid = signatureResult.valid;

      if (!signatureResult.valid) {
        result.errors.push(`Signature verification failed: ${signatureResult.error}`);
        await this.securityLogger.logSecurityEvent({
          type: 'signature_verification_failed',
          severity: 'high',
          platform,
          integrationId,
          sourceIP,
          details: { error: signatureResult.error }
        });
        return result;
      }

      // 2. Timestamp validation
      const timestampResult = this.timestampValidator.validateTimestamp(
        platform, headers, parsedBody
      );
      result.details.timestampValid = timestampResult.valid;

      if (!timestampResult.valid) {
        result.errors.push(`Timestamp validation failed: ${timestampResult.error}`);
        await this.securityLogger.logSecurityEvent({
          type: 'timestamp_validation_failed',
          severity: 'medium',
          platform,
          integrationId,
          sourceIP,
          details: { error: timestampResult.error }
        });
        return result;
      }

      // 3. Replay attack detection
      const requestId = this.replayDetector.extractRequestId(
        platform, headers, parsedBody
      );
      if (requestId) {
        result.metadata!.requestId = requestId;
        const replayCheck = await this.replayDetector.checkReplayAttack(requestId);
        result.details.replayCheckPassed = !replayCheck.isDuplicate;

        if (replayCheck.isDuplicate) {
          result.errors.push('Duplicate request detected (replay attack)');
          await this.securityLogger.logSecurityEvent({
            type: 'replay_attack_detected',
            severity: 'critical',
            platform,
            integrationId,
            sourceIP,
            details: {
              requestId,
              firstSeen: replayCheck.firstSeen,
              occurrences: replayCheck.occurrences
            }
          });
          return result;
        }
      }

      // 4. Rate limiting
      const rateLimitResult = await this.rateLimiter.enforceRateLimit(
        integrationId, platform
      );
      result.details.rateLimitOk = rateLimitResult.allowed;

      if (!rateLimitResult.allowed) {
        result.errors.push(
          `Rate limit exceeded: ${rateLimitResult.current}/${rateLimitResult.limit}`
        );
        if (result.metadata) {
          result.metadata.retryAfterMs = rateLimitResult.retryAfterMs;
        }
        await this.securityLogger.logSecurityEvent({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          platform,
          integrationId,
          sourceIP,
          details: {
            current: rateLimitResult.current,
            limit: rateLimitResult.limit,
            resetAt: rateLimitResult.resetAt
          }
        });
        return result;
      }

      // 5. Source verification
      const sourceResult = await this.sourceVerifier.verifySource(
        platform, sourceIP, headers
      );
      result.details.sourceVerified = sourceResult.valid;

      if (!sourceResult.valid) {
        result.warnings.push(
          `Source verification warning: ${sourceResult.warning}`
        );
      }

      // All checks passed
      result.valid = true;
      return result;
    } catch (error) {
      result.errors.push(
        `Security validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      log.error(
        'Validation error',
        {},
        error instanceof Error ? error : new Error(String(error))
      );
      return result;
    }
  }

  /**
   * Get security event statistics (delegates to logger)
   */
  async getSecurityStats(
    integrationId?: number,
    hours: number = 24
  ): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentEvents: Array<{
      id: string;
      type: string;
      severity: string;
      platform: string;
      integrationId: number | null;
      sourceIp: string | null;
      details: unknown;
      createdAt: string;
    }>;
  }> {
    return this.securityLogger.getSecurityStats(integrationId, hours);
  }

  /**
   * Clear rate limit counter for an integration (admin)
   */
  async clearRateLimit(integrationId: string): Promise<boolean> {
    return this.rateLimiter.clearRateLimit(integrationId);
  }

  /**
   * Get integration credentials from KV cache or D1
   */
  private async getIntegrationCredentials(
    integrationId: string
  ): Promise<{ channelSecret?: string; appSecret?: string } | null> {
    try {
      const cacheKey = `integration_credentials:${integrationId}`;
      const cached = await this.cache.get(cacheKey, 'json');
      if (cached) {
        return cached as { channelSecret?: string; appSecret?: string };
      }

      const query = `
        SELECT platform, credentials FROM integrations WHERE id = ? AND status = 'active'
      `;

      const result = await this.db
        .prepare(query)
        .bind(integrationId)
        .first() as {
        platform: string;
        credentials: string;
      } | null;

      if (!result) {
        return null;
      }

      const credentials = JSON.parse(result.credentials) as {
        channelSecret?: string;
        appSecret?: string;
      };

      await this.cache.put(cacheKey, JSON.stringify(credentials), {
        expirationTtl: 300
      });

      return credentials;
    } catch (error) {
      log.error(
        'Failed to get credentials',
        {},
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }
}
