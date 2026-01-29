# P2 Security Tasks Implementation Plan

**Date**: 2025-11-20
**Status**: Ready to implement
**Estimated Total Time**: 14-20 hours
**Priority**: MEDIUM (After P0/P1 completion)

---

## Overview

This document outlines the implementation plan for 7 P2 (Medium Priority) security enhancements identified in the URGENT_TASKS_COMPLETION_REPORT.md.

**Prerequisites**:
- ✅ P0/P1 tasks completed (6/6)
- ✅ Worker running successfully
- ✅ Test infrastructure in place
- ✅ Documentation complete

---

## Task List Summary

| # | Task | Priority | Est. Time | Status |
|---|------|----------|-----------|--------|
| P2-1 | IP Whitelist Implementation | Medium | 2-3h | Pending |
| P2-2 | Session Access Permissions | Medium | 2-3h | Pending |
| P2-3 | Agent Conversation List from DB | Medium | 1-2h | Pending |
| P2-4 | Security Monitoring Table | Medium | 2-3h | Pending |
| P2-5 | Alert System Integration | Medium | 3-4h | Pending |
| P2-6 | Statistics Querying from D1 | Medium | 1-2h | Pending |
| P2-7 | Real-time Analytics Enhancement | Medium | 2-3h | Pending |

**Total**: 14-20 hours

---

## P2-1: IP Whitelist Implementation

**File**: `src/modules/integrations/services/webhook-security-service.ts:676`
**Estimated Time**: 2-3 hours
**Priority**: Medium
**TODO Reference**: Line 676-678

### Current State
```typescript
// TODO: 實作 IP 白名單檢查
// LINE 官方 IP: https://developers.line.biz/en/reference/messaging-api/#ip-addresses
// Facebook 官方 IP: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#ip-ranges
```

### Implementation Plan

#### 1. LINE Official IP Ranges
**Source**: https://developers.line.biz/en/reference/messaging-api/#ip-addresses

```typescript
const LINE_IP_RANGES = [
  '147.92.128.0/17',  // LINE official IPs
  '203.104.128.0/17'  // LINE backup IPs
];
```

#### 2. Facebook Official IP Ranges
**Source**: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#ip-ranges

```typescript
const FACEBOOK_IP_RANGES = [
  '31.13.24.0/21',
  '31.13.64.0/18',
  '66.220.144.0/20',
  '69.63.176.0/20',
  '69.171.224.0/19',
  '74.119.76.0/22',
  '103.4.96.0/22',
  '157.240.0.0/17',
  '173.252.64.0/18',
  '179.60.192.0/22',
  '185.60.216.0/22',
  '204.15.20.0/22'
];
```

#### 3. Implementation Steps

**Step 1**: Create IP validation utility
```typescript
// src/utils/ip-validator.ts

import { IPAddress } from 'ipaddr.js'; // Need to install

export interface IPRange {
  cidr: string;
  platform: 'line' | 'facebook' | 'whatsapp';
}

export class IPValidator {
  private allowedRanges: IPRange[];

  constructor(ranges: IPRange[]) {
    this.allowedRanges = ranges;
  }

  /**
   * Check if IP is in allowed ranges
   */
  isAllowed(ip: string, platform: string): boolean {
    // Implementation using ipaddr.js
  }

  /**
   * Parse CIDR notation
   */
  private parseCIDR(cidr: string): { network: IPAddress; prefixLength: number } {
    // Implementation
  }
}
```

**Step 2**: Update WebhookSecurityService
```typescript
// src/modules/integrations/services/webhook-security-service.ts:676

private async verifySource(
  platform: IntegrationPlatform,
  sourceIP?: string,
  headers?: Record<string, string>
): Promise<{ valid: boolean; warning?: string }> {
  try {
    // IP Whitelist Check
    if (sourceIP) {
      const ipValidator = new IPValidator(this.getIPRanges(platform));

      if (!ipValidator.isAllowed(sourceIP, platform)) {
        return {
          valid: false,
          warning: `IP ${sourceIP} not in ${platform} whitelist`
        };
      }
    }

    // User-Agent check (existing)
    if (headers) {
      const userAgent = headers['user-agent'] || headers['User-Agent'] || '';

      switch (platform) {
        case 'line':
          if (!userAgent.includes('LineBotWebhook')) {
            return {
              valid: true,
              warning: 'Unexpected User-Agent for LINE webhook'
            };
          }
          break;

        case 'facebook':
        case 'instagram':
          if (!userAgent.includes('facebookplatform') && !userAgent.includes('Instagram')) {
            return {
              valid: true,
              warning: 'Unexpected User-Agent for Facebook/Instagram webhook'
            };
          }
          break;
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('[WebhookSecurity] Source verification error:', error);
    return { valid: true }; // Fail open to avoid blocking legitimate traffic
  }
}

private getIPRanges(platform: IntegrationPlatform): IPRange[] {
  const ranges: IPRange[] = [];

  switch (platform) {
    case 'line':
      ranges.push(
        { cidr: '147.92.128.0/17', platform: 'line' },
        { cidr: '203.104.128.0/17', platform: 'line' }
      );
      break;

    case 'facebook':
    case 'instagram':
      ranges.push(
        { cidr: '31.13.24.0/21', platform: 'facebook' },
        { cidr: '31.13.64.0/18', platform: 'facebook' },
        { cidr: '66.220.144.0/20', platform: 'facebook' },
        { cidr: '69.63.176.0/20', platform: 'facebook' },
        { cidr: '69.171.224.0/19', platform: 'facebook' },
        { cidr: '74.119.76.0/22', platform: 'facebook' },
        { cidr: '103.4.96.0/22', platform: 'facebook' },
        { cidr: '157.240.0.0/17', platform: 'facebook' },
        { cidr: '173.252.64.0/18', platform: 'facebook' },
        { cidr: '179.60.192.0/22', platform: 'facebook' },
        { cidr: '185.60.216.0/22', platform: 'facebook' },
        { cidr: '204.15.20.0/22', platform: 'facebook' }
      );
      break;
  }

  return ranges;
}
```

**Step 3**: Add configuration option
```typescript
// Add to webhook-security-service.ts constructor

private readonly IP_WHITELIST_ENABLED: boolean;

constructor(
  private env: Bindings,
  private db: D1Database,
  private cache: KVNamespace,
  options?: {
    enableIPWhitelist?: boolean;
  }
) {
  this.IP_WHITELIST_ENABLED = options?.enableIPWhitelist ?? true;
}
```

#### 4. Dependencies
```bash
npm install ipaddr.js
npm install -D @types/ipaddr.js
```

#### 5. Testing
```typescript
// Test cases
describe('IP Whitelist', () => {
  it('should allow LINE official IP', () => {
    const validator = new IPValidator([...]);
    expect(validator.isAllowed('147.92.150.1', 'line')).toBe(true);
  });

  it('should block non-whitelisted IP', () => {
    const validator = new IPValidator([...]);
    expect(validator.isAllowed('1.2.3.4', 'line')).toBe(false);
  });
});
```

#### 6. Configuration
```env
# .env.example
IP_WHITELIST_ENABLED=true
IP_WHITELIST_STRICT_MODE=false  # Fail closed if true, fail open if false
```

---

## P2-2: Session Access Permissions

**File**: `src/modules/sessions/services/session-service.ts:145`
**Estimated Time**: 2-3 hours
**Priority**: Medium
**TODO Reference**: Line 145

### Current State
```typescript
// TODO: 加入會話訪問權限檢查
// 確保代理只能訪問被分配到的對話會話
```

### Implementation Plan

#### 1. Add Permission Check Method
```typescript
// src/modules/sessions/services/session-service.ts

/**
 * Check if user has access to session
 */
async canAccessSession(
  sessionId: string,
  userId: string,
  userRole: 'admin' | 'agent'
): Promise<boolean> {
  try {
    // Admins have access to all sessions
    if (userRole === 'admin') {
      return true;
    }

    // Get session details
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Get conversation details
    const conversation = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, session.conversation_id))
      .limit(1);

    if (conversation.length === 0) {
      return false;
    }

    const conv = conversation[0];

    // Check if agent is assigned to this conversation
    if (conv.assignedUserId === userId) {
      return true;
    }

    // Check if agent is in the same team as the conversation
    if (conv.assignedTeamId) {
      const agent = await this.db
        .select()
        .from(agents)
        .where(eq(agents.id, userId))
        .limit(1);

      if (agent.length > 0 && agent[0].teamId === conv.assignedTeamId) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[SessionService] Permission check error:', error);
    return false;
  }
}
```

#### 2. Update Session Methods
```typescript
// Modify getSession method
async getSession(sessionId: string, userId?: string, userRole?: string): Promise<ConversationSession | null> {
  try {
    // Permission check if user context provided
    if (userId && userRole) {
      const hasAccess = await this.canAccessSession(sessionId, userId, userRole as 'admin' | 'agent');
      if (!hasAccess) {
        console.warn(`[SessionService] Access denied: User ${userId} cannot access session ${sessionId}`);
        return null;
      }
    }

    // Existing implementation...
    const result = await this.db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.id, sessionId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('[SessionService] Get session error:', error);
    return null;
  }
}
```

#### 3. Add to Handler
```typescript
// src/handlers/session-handler.ts (or equivalent)

app.get('/api/sessions/:sessionId', jwtAuth, async (c) => {
  const sessionId = c.req.param('sessionId');
  const agent = c.get('agent');

  const sessionService = new SessionService(c.env.DB);

  const session = await sessionService.getSession(
    sessionId,
    agent.id,
    agent.role
  );

  if (!session) {
    return errorResponse(c, 'Session not found or access denied', 404);
  }

  return successResponse(c, session);
});
```

#### 4. Testing
```typescript
describe('Session Permissions', () => {
  it('should allow admin to access any session', async () => {
    const canAccess = await sessionService.canAccessSession(
      'session-123',
      'admin-1',
      'admin'
    );
    expect(canAccess).toBe(true);
  });

  it('should allow agent to access assigned conversation session', async () => {
    // Test with assigned agent
  });

  it('should deny agent access to unassigned session', async () => {
    // Test with non-assigned agent
  });
});
```

---

## P2-3: Agent Conversation List from Database

**File**: `src/services/websocket-auth-service.ts:89`
**Estimated Time**: 1-2 hours
**Priority**: Medium
**TODO Reference**: Line 89

### Current State
```typescript
// TODO: 從數據庫查詢該代理被分配的對話列表
const allowedConversations = ['conv-1', 'conv-2']; // 暫時寫死，應該從數據庫查詢
```

### Implementation Plan

#### 1. Add Database Query Method
```typescript
// src/services/websocket-auth-service.ts

/**
 * Get conversations assigned to agent
 */
private async getAgentConversations(
  agentId: string,
  teamId?: number
): Promise<string[]> {
  try {
    // Query conversations where agent is directly assigned
    const directAssigned = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.assignedUserId, agentId));

    const conversationIds = directAssigned.map(c => c.id);

    // If agent has team, also get team-assigned conversations
    if (teamId) {
      const teamAssigned = await this.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.assignedTeamId, teamId),
            isNull(conversations.assignedUserId) // Not directly assigned
          )
        );

      conversationIds.push(...teamAssigned.map(c => c.id));
    }

    return [...new Set(conversationIds)]; // Remove duplicates
  } catch (error) {
    console.error('[WebSocketAuth] Error fetching agent conversations:', error);
    return [];
  }
}
```

#### 2. Update Authorization Method
```typescript
// Replace line 89
async authorizeConversationAccess(
  userId: string,
  userRole: string,
  conversationId: string,
  teamId?: number
): Promise<boolean> {
  // Admin has access to all conversations
  if (userRole === 'admin') {
    return true;
  }

  // For agents, check database
  const allowedConversations = await this.getAgentConversations(userId, teamId);

  return allowedConversations.includes(conversationId);
}
```

#### 3. Add Caching
```typescript
/**
 * Get agent conversations with caching
 */
private async getAgentConversationsWithCache(
  agentId: string,
  teamId?: number
): Promise<string[]> {
  const cacheKey = `agent_conversations:${agentId}`;

  // Try cache first
  const cached = await this.cache.get(cacheKey, 'json');
  if (cached) {
    return cached as string[];
  }

  // Fetch from database
  const conversations = await this.getAgentConversations(agentId, teamId);

  // Cache for 5 minutes
  await this.cache.put(cacheKey, JSON.stringify(conversations), {
    expirationTtl: 300
  });

  return conversations;
}
```

#### 4. Add Cache Invalidation
```typescript
/**
 * Invalidate agent conversation cache
 * Call this when conversation assignments change
 */
async invalidateAgentConversationCache(agentId: string): Promise<void> {
  const cacheKey = `agent_conversations:${agentId}`;
  await this.cache.delete(cacheKey);
}
```

#### 5. Update Conversation Assignment Handler
```typescript
// When conversation is assigned/unassigned, invalidate cache
await websocketAuthService.invalidateAgentConversationCache(agentId);
```

---

## P2-4: Security Monitoring Table Creation

**File**: `src/modules/integrations/services/webhook-security-service.ts:729`
**Estimated Time**: 2-3 hours
**Priority**: Medium
**TODO Reference**: Lines 729-745

### Current State
```typescript
// TODO: 建立 webhook_security_events 表
/*
await this.db.prepare(`
  INSERT INTO webhook_security_events (
    id, type, severity, platform, integration_id, source_ip, details, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).bind(...).run();
*/
```

### Implementation Plan

#### 1. Create Migration
```sql
-- drizzle/XXXX_create_webhook_security_events.sql

CREATE TABLE IF NOT EXISTS webhook_security_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  platform TEXT NOT NULL,
  integration_id TEXT,
  source_ip TEXT,
  details TEXT,  -- JSON string
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Indexes for common queries
  CONSTRAINT fk_integration
    FOREIGN KEY (integration_id)
    REFERENCES channel_integrations(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_platform
  ON webhook_security_events(platform);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_created_at
  ON webhook_security_events(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_severity
  ON webhook_security_events(severity);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_type
  ON webhook_security_events(type);

CREATE INDEX IF NOT EXISTS idx_webhook_security_events_integration
  ON webhook_security_events(integration_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_webhook_security_events_platform_severity
  ON webhook_security_events(platform, severity, created_at DESC);
```

#### 2. Create Drizzle Schema
```typescript
// src/db/schema.ts

export const webhookSecurityEvents = sqliteTable('webhook_security_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  severity: text('severity', {
    enum: ['low', 'medium', 'high', 'critical']
  }).notNull(),
  platform: text('platform').notNull(),
  integrationId: text('integration_id').references(() => channelIntegrations.id, {
    onDelete: 'cascade'
  }),
  sourceIp: text('source_ip'),
  details: text('details'), // JSON string
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`)
});

export type WebhookSecurityEvent = typeof webhookSecurityEvents.$inferSelect;
export type NewWebhookSecurityEvent = typeof webhookSecurityEvents.$inferInsert;
```

#### 3. Update WebhookSecurityService
```typescript
// src/modules/integrations/services/webhook-security-service.ts:714

private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
  try {
    const securityEvent: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event
    };

    // Record to KV (fast query)
    const eventKey = `security_event:${securityEvent.id}`;
    await this.cache.put(eventKey, JSON.stringify(securityEvent), {
      expirationTtl: 86400 // Keep for 24 hours
    });

    // Record to D1 (persistence) - NOW IMPLEMENTED
    await this.db
      .insert(webhookSecurityEvents)
      .values({
        id: securityEvent.id,
        type: securityEvent.type,
        severity: securityEvent.severity,
        platform: securityEvent.platform,
        integrationId: securityEvent.integrationId || null,
        sourceIp: securityEvent.sourceIP || null,
        details: JSON.stringify(securityEvent.details),
        createdAt: securityEvent.timestamp
      });

    // Trigger alerts for critical events
    if (securityEvent.severity === 'critical' || securityEvent.severity === 'high') {
      console.error('[SECURITY ALERT]', securityEvent);
      // TODO: Integrate alert system (Email, Slack, etc.) - P2-5
    }

  } catch (error) {
    console.error('[WebhookSecurity] Failed to log security event:', error);
  }
}
```

#### 4. Add Query Methods
```typescript
/**
 * Get security statistics
 */
async getSecurityStats(
  integrationId?: string,
  hours: number = 24
): Promise<{
  totalEvents: number;
  byType: Record<SecurityEventType, number>;
  bySeverity: Record<string, number>;
  recentEvents: SecurityEvent[];
}> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Build query
    let query = this.db
      .select()
      .from(webhookSecurityEvents)
      .where(gte(webhookSecurityEvents.createdAt, since));

    if (integrationId) {
      query = query.where(eq(webhookSecurityEvents.integrationId, integrationId));
    }

    const events = await query.orderBy(desc(webhookSecurityEvents.createdAt)).limit(100);

    // Calculate statistics
    const byType: Record<SecurityEventType, number> = {} as any;
    const bySeverity: Record<string, number> = {};

    events.forEach(event => {
      byType[event.type as SecurityEventType] = (byType[event.type as SecurityEventType] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      byType,
      bySeverity,
      recentEvents: events.slice(0, 10).map(e => ({
        id: e.id,
        type: e.type as SecurityEventType,
        severity: e.severity as 'low' | 'medium' | 'high' | 'critical',
        platform: e.platform as IntegrationPlatform,
        integrationId: e.integrationId,
        sourceIP: e.sourceIp,
        details: JSON.parse(e.details || '{}'),
        timestamp: e.createdAt
      }))
    };
  } catch (error) {
    console.error('[WebhookSecurity] Failed to get security stats:', error);
    throw error;
  }
}
```

#### 5. Add API Endpoint
```typescript
// src/handlers/security-monitoring.ts (NEW)

import { Hono } from 'hono';
import { jwtAuth } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';

export const securityMonitoring = new Hono();

/**
 * Get security event statistics
 * GET /api/security/events/stats
 */
securityMonitoring.get('/events/stats', jwtAuth, async (c) => {
  const agent = c.get('agent');

  // Only admins can view security events
  if (agent.role !== 'admin') {
    return errorResponse(c, 'Unauthorized', 403);
  }

  const hours = parseInt(c.req.query('hours') || '24');
  const integrationId = c.req.query('integrationId');

  const webhookSecurity = new WebhookSecurityService(
    c.env,
    c.env.DB,
    c.env.CACHE
  );

  const stats = await webhookSecurity.getSecurityStats(integrationId, hours);

  return successResponse(c, stats);
});

/**
 * Get recent security events
 * GET /api/security/events
 */
securityMonitoring.get('/events', jwtAuth, async (c) => {
  const agent = c.get('agent');

  if (agent.role !== 'admin') {
    return errorResponse(c, 'Unauthorized', 403);
  }

  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const platform = c.req.query('platform');
  const severity = c.req.query('severity');

  // Query logic...

  return successResponse(c, { events, total });
});
```

---

## P2-5: Alert System Integration

**File**: `src/modules/integrations/services/webhook-security-service.ts:750`
**Estimated Time**: 3-4 hours
**Priority**: Medium
**TODO Reference**: Line 750

### Implementation Plan

#### 1. Create Alert Service
```typescript
// src/services/alert-service.ts (NEW)

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook';
  config: EmailConfig | SlackConfig | WebhookConfig;
  enabled: boolean;
}

export interface EmailConfig {
  to: string[];
  from: string;
  subject: string;
}

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export class AlertService {
  constructor(
    private channels: AlertChannel[],
    private env: Bindings
  ) {}

  async sendAlert(
    title: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): Promise<void> {
    const enabledChannels = this.channels.filter(c => c.enabled);

    for (const channel of enabledChannels) {
      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmailAlert(channel.config as EmailConfig, title, message, severity, metadata);
            break;
          case 'slack':
            await this.sendSlackAlert(channel.config as SlackConfig, title, message, severity, metadata);
            break;
          case 'webhook':
            await this.sendWebhookAlert(channel.config as WebhookConfig, title, message, severity, metadata);
            break;
        }
      } catch (error) {
        console.error(`[AlertService] Failed to send ${channel.type} alert:`, error);
      }
    }
  }

  private async sendEmailAlert(...) { /* Implementation */ }
  private async sendSlackAlert(...) { /* Implementation */ }
  private async sendWebhookAlert(...) { /* Implementation */ }
}
```

#### 2. Integrate with WebhookSecurityService
```typescript
// Update line 750 in webhook-security-service.ts

// Trigger alerts for critical events
if (securityEvent.severity === 'critical' || securityEvent.severity === 'high') {
  console.error('[SECURITY ALERT]', securityEvent);

  // Integrate alert system
  const alertService = new AlertService(this.getAlertChannels(), this.env);

  await alertService.sendAlert(
    `Security Alert: ${securityEvent.type}`,
    `A ${securityEvent.severity} severity security event was detected`,
    securityEvent.severity,
    {
      platform: securityEvent.platform,
      integrationId: securityEvent.integrationId,
      sourceIP: securityEvent.sourceIP,
      details: securityEvent.details
    }
  );
}
```

---

## P2-6: Statistics Querying from D1

**File**: `src/monitoring/cors-monitor.ts:180`
**Estimated Time**: 1-2 hours
**Priority**: Medium

### Implementation Plan

Replace KV-based statistics with D1 queries for better persistence and querying capabilities.

---

## P2-7: Real-time Analytics Enhancement

**Estimated Time**: 2-3 hours
**Priority**: Medium

### Implementation Plan

Add real-time security metrics dashboard with WebSocket updates.

---

## Implementation Order

### Phase 1: Database & Monitoring (4-6 hours)
1. **P2-4**: Security Monitoring Table (2-3h) - Foundation
2. **P2-3**: Agent Conversation List (1-2h) - Quick win
3. **P2-6**: Statistics Querying (1-2h) - Depends on P2-4

### Phase 2: Security Hardening (4-6 hours)
4. **P2-1**: IP Whitelist (2-3h) - High impact
5. **P2-2**: Session Permissions (2-3h) - Important

### Phase 3: Alerting & Analytics (5-7 hours)
6. **P2-5**: Alert System (3-4h) - Depends on P2-4
7. **P2-7**: Real-time Analytics (2-3h) - Final polish

---

## Testing Strategy

Each task should include:
1. Unit tests for new functions
2. Integration tests for database operations
3. E2E tests for API endpoints
4. Performance tests for query-heavy operations

---

## Success Criteria

- [ ] All 7 P2 tasks implemented
- [ ] Tests passing (>80% coverage)
- [ ] Documentation updated
- [ ] No performance degradation
- [ ] Production deployment successful

---

## Notes

- Start with P2-4 (monitoring table) as it's foundational
- IP whitelist (P2-1) has highest security impact
- Alert system (P2-5) depends on monitoring table
- Real-time analytics (P2-7) is lowest priority

**Status**: Ready to begin implementation
**Next Action**: Start with P2-4 (Security Monitoring Table)
