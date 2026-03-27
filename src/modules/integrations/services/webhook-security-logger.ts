import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { webhookSecurityEvents } from '@/db/schema';
import { eq, gte, desc } from 'drizzle-orm';
import { AlertService, getDefaultAlertChannels } from '@/services/alert-service';
import { nowISO, nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';
import type { SecurityEvent, SecurityEventType } from './webhook-security-types';

const log = createContextLogger('WebhookSecurity');

export class WebhookSecurityLogger {
  constructor(private env: Bindings, private db: D1Database, private cache: KVNamespace) {}

  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const securityEvent: SecurityEvent = { id: `sec_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`, timestamp: nowISO(), ...event };
      const eventKey = `security_event:${securityEvent.id}`;
      await this.cache.put(eventKey, JSON.stringify(securityEvent), { expirationTtl: 86400 });
      const dbClient = createDbClient(this.db);
      await dbClient.insert(webhookSecurityEvents).values({ id: securityEvent.id, type: securityEvent.type, severity: securityEvent.severity, platform: securityEvent.platform, integrationId: securityEvent.integrationId ? parseInt(securityEvent.integrationId) : null, sourceIp: securityEvent.sourceIP || null, details: JSON.stringify(securityEvent.details), createdAt: securityEvent.timestamp });
      if (securityEvent.severity === 'critical' || securityEvent.severity === 'high') {
        log.error('SECURITY ALERT', { event: securityEvent });
        try {
          const alertChannels = getDefaultAlertChannels(this.env);
          if (alertChannels.length > 0) {
            const alertService = new AlertService(alertChannels, this.env);
            await alertService.sendAlert(`Security Event: ${this.formatEventType(securityEvent.type)}`, this.formatAlertMessage(securityEvent), securityEvent.severity, { platform: securityEvent.platform, integrationId: securityEvent.integrationId, sourceIP: securityEvent.sourceIP, eventType: securityEvent.type, details: securityEvent.details, timestamp: securityEvent.timestamp });
            log.info('Alert sent for security event', { severity: securityEvent.severity });
          } else { log.warn('No alert channels configured, skipping alert'); }
        } catch (alertError) { log.error('Failed to send alert', {}, alertError instanceof Error ? alertError : new Error(String(alertError))); }
      }
    } catch (error) { log.error('Failed to log security event', {}, error instanceof Error ? error : new Error(String(error))); }
  }

  async getSecurityStats(integrationId?: number, hours: number = 24): Promise<{ totalEvents: number; byType: Record<string, number>; bySeverity: Record<string, number>; recentEvents: Array<{ id: string; type: string; severity: string; platform: string; integrationId: number | null; sourceIp: string | null; details: unknown; createdAt: string }> }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const dbClient = createDbClient(this.db);
      let query = dbClient.select().from(webhookSecurityEvents).where(gte(webhookSecurityEvents.createdAt, since)).$dynamic();
      if (integrationId) query = query.where(eq(webhookSecurityEvents.integrationId, integrationId));
      const events = await query.orderBy(desc(webhookSecurityEvents.createdAt)).limit(100);
      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      events.forEach(event => { byType[event.type] = (byType[event.type] || 0) + 1; bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1; });
      return { totalEvents: events.length, byType, bySeverity, recentEvents: events.slice(0, 10).map(e => ({ id: e.id, type: e.type, severity: e.severity, platform: e.platform, integrationId: e.integrationId, sourceIp: e.sourceIp, details: e.details ? JSON.parse(e.details) : {}, createdAt: e.createdAt })) };
    } catch (error) { log.error('Failed to get security stats', {}, error instanceof Error ? error : new Error(String(error))); throw error; }
  }

  private formatEventType(type: SecurityEventType): string {
    const typeLabels: Record<SecurityEventType, string> = { signature_verification_failed: 'Signature Verification Failed', timestamp_validation_failed: 'Timestamp Validation Failed', replay_attack_detected: 'Replay Attack Detected', rate_limit_exceeded: 'Rate Limit Exceeded', invalid_source: 'Invalid Source IP', malformed_request: 'Malformed Request', suspicious_activity: 'Suspicious Activity' };
    return typeLabels[type] || type;
  }

  private formatAlertMessage(event: SecurityEvent): string {
    const messages: Record<SecurityEventType, string> = { signature_verification_failed: `Webhook signature verification failed for ${event.platform}.`, timestamp_validation_failed: `Webhook timestamp validation failed for ${event.platform}.`, replay_attack_detected: `Potential replay attack detected for ${event.platform}.`, rate_limit_exceeded: `Rate limit exceeded for ${event.platform}.`, invalid_source: `Invalid source IP detected for ${event.platform}.`, malformed_request: `Malformed webhook request from ${event.platform}.`, suspicious_activity: `Suspicious activity detected for ${event.platform}.` };
    let message = messages[event.type] || `Security event: ${event.type}`;
    if (event.details) { const detailsStr = Object.entries(event.details).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', '); if (detailsStr) message += `\n\nAdditional Details: ${detailsStr}`; }
    return message;
  }
}
