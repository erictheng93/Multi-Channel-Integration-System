import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';

export interface SecurityValidationResult {
  valid: boolean; errors: string[]; warnings: string[];
  details: { signatureValid?: boolean; timestampValid?: boolean; replayCheckPassed?: boolean; rateLimitOk?: boolean; sourceVerified?: boolean; };
  metadata?: { requestId?: string; timestamp?: string; sourceIP?: string; platform?: IntegrationPlatform; retryAfterMs?: number; };
}

export interface ReplayCheckResult { isDuplicate: boolean; firstSeen?: string; occurrences: number; }
export interface RateLimitResult { allowed: boolean; current: number; limit: number; resetAt: string; retryAfterMs?: number; }

export type SecurityEventType = 'signature_verification_failed' | 'timestamp_validation_failed' | 'replay_attack_detected' | 'rate_limit_exceeded' | 'invalid_source' | 'malformed_request' | 'suspicious_activity';

export interface SecurityEvent {
  id: string; type: SecurityEventType; severity: 'low' | 'medium' | 'high' | 'critical';
  platform: IntegrationPlatform; integrationId?: string; sourceIP?: string;
  details: Record<string, unknown>; timestamp: string;
}
