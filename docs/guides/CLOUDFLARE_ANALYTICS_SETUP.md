# Cloudflare Analytics Setup Guide

## Overview

This guide explains how to set up and configure Cloudflare Analytics for monitoring your Multi-Channel Integration System, including WebSocket connections, Durable Objects performance, and real-time metrics.

---

## (Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Cloudflare Analytics Integration │
├─────────────────────────────────────────────────────────────────────────────────┤
│ │
│  ┌─────────────────┐ ┌────────────────┐ ┌─────────────────────────────┐ │
│  │ Workers │───│ Analytics │───│ Dashboard / Grafana │   │
│  │ (src/index.ts)  │ │ Engine │    │ (Visualization) │   │
│  └─────────────────┘ └────────────────┘ └─────────────────────────────┘ │
│ │                      │ │
│ │                      │ │
│  ┌───────┴───────┐ ┌────────┴───────┐ ┌─────────────────────────────┐ │
│  │ Durable │    │ Workers │    │ External Analytics │    │
│  │ Objects │    │ Logpush │    │ (Optional) │    │
│  │ Metrics │    │ (to R2/S3) │    │ • Grafana Cloud │    │
│  └───────────────┘ └────────────────┘ │ • Datadog │    │
│ │ • New Relic │    │
│ └─────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Enable Workers Analytics Engine

### 1.1 Update wrangler.toml

Add Analytics Engine binding to your `wrangler.toml`:

```toml
# =================== ANALYTICS ENGINE ===================
# Enables custom metrics and analytics for WebSocket monitoring

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "multi_channel_metrics"
```

### 1.2 Update TypeScript Types

Add to `src/types/index.ts`:

```typescript
export interface Bindings {
  // ... existing bindings

  // Analytics Engine
  ANALYTICS: AnalyticsEngineDataset;
}

// Analytics Engine Dataset interface
interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}
```

---

## Step 2: Create Analytics Service

Create `src/services/analytics-service.ts`:

```typescript
/**
 * Cloudflare Analytics Service
 * Writes custom metrics to Analytics Engine
 */

import type { Bindings } from '../types';

export interface MetricEvent {
  // Dimension indexes (up to 20)
  metric: string; // index1: metric name
  source: string; // index2: source (websocket, api, cron)
  status: string; // index3: success/failure
  doType?: string; // index4: DO type

  // Numeric values (up to 20)
  value?: number; // double1: primary metric value
  latency?: number; // double2: latency in ms
  count?: number; // double3: count/quantity
  errorRate?: number; // double4: error rate (0-1)

  // String blobs (up to 20, for debugging)
  eventId?: string; // blob1
  userId?: string; // blob2
  conversationId?: string;  // blob3
}

export class AnalyticsService {
  private analytics: AnalyticsEngineDataset | null;
  private enabled: boolean;

  constructor(env: Bindings) {
    this.analytics = env.ANALYTICS || null;
    this.enabled = !!this.analytics;
  }

  /**
   * Write a metric event to Analytics Engine
   */
  writeMetric(event: MetricEvent): void {
    if (!this.enabled || !this.analytics) {
      return;
    }

    try {
      this.analytics.writeDataPoint({
        indexes: [
          event.metric,
          event.source,
          event.status,
          event.doType || 'none'
        ],
        doubles: [
          event.value || 0,
          event.latency || 0,
          event.count || 1,
          event.errorRate || 0
        ],
        blobs: [
          event.eventId || '',
          event.userId || '',
          event.conversationId || ''
        ]
      });
    } catch (error) {
      console.error('Analytics write failed:', error);
    }
  }

  // =================== Convenience Methods ===================

  /**
   * Track WebSocket connection event
   */
  trackConnection(event: {
    type: 'connect' | 'disconnect' | 'reconnect';
    userId?: string;
    latency?: number;
    success: boolean;
  }): void {
    this.writeMetric({
      metric: 'websocket_connection',
      source: 'websocket',
      status: event.success ? 'success' : 'failure',
      latency: event.latency,
      userId: event.userId
    });
  }

  /**
   * Track message broadcast
   */
  trackBroadcast(event: {
    conversationId: string;
    recipientCount: number;
    latency: number;
    success: boolean;
  }): void {
    this.writeMetric({
      metric: 'message_broadcast',
      source: 'websocket',
      status: event.success ? 'success' : 'failure',
      count: event.recipientCount,
      latency: event.latency,
      conversationId: event.conversationId
    });
  }

  /**
   * Track Durable Object operation
   */
  trackDOOperation(event: {
    doType: string;
    operation: string;
    latency: number;
    success: boolean;
  }): void {
    this.writeMetric({
      metric: `do_${event.operation}`,
      source: 'durable_object',
      status: event.success ? 'success' : 'failure',
      doType: event.doType,
      latency: event.latency
    });
  }

  /**
   * Track Circuit Breaker state change
   */
  trackCircuitBreaker(event: {
    fromState: string;
    toState: string;
    errorRate: number;
  }): void {
    this.writeMetric({
      metric: 'circuit_breaker_state',
      source: 'circuit_breaker',
      status: event.toState,
      errorRate: event.errorRate
    });
  }

  /**
   * Track health check result
   */
  trackHealthCheck(event: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    healthyInstances: number;
    totalInstances: number;
    latency: number;
  }): void {
    this.writeMetric({
      metric: 'health_check',
      source: 'cron',
      status: event.status,
      count: event.healthyInstances,
      value: event.totalInstances,
      latency: event.latency
    });
  }
}

// Factory function
export function createAnalyticsService(env: Bindings): AnalyticsService {
  return new AnalyticsService(env);
}
```

---

## Step 3: Integrate Analytics

### 3.1 In WebSocket Broadcast Service

Add to `src/services/websocket-broadcast-service.ts`:

```typescript
import { createAnalyticsService, type AnalyticsService } from './analytics-service';

export class WebSocketBroadcastService {
  private analytics: AnalyticsService;

  constructor(env: Bindings) {
    // ... existing code
    this.analytics = createAnalyticsService(env);
  }

  private async broadcastToWebSocket(event: DurableObjectEvent): Promise<boolean> {
    const startTime = Date.now();

    // ... existing broadcast logic

    const latency = Date.now() - startTime;

    // Track broadcast metric
    this.analytics.trackBroadcast({
      conversationId: event.conversationId || 'unknown',
      recipientCount: successCount,
      latency,
      success: successCount > 0
    });

    return successCount > 0;
  }
}
```

### 3.2 In Scheduled Health Check

Add to `src/handlers/scheduled-health-check.ts`:

```typescript
import { createAnalyticsService } from '../services/analytics-service';

export async function handleScheduledHealthCheck(env: Bindings): Promise<void> {
  const analytics = createAnalyticsService(env);
  const startTime = Date.now();

  // Perform health check
  const stats = await monitor.performHealthCheck();

  const latency = Date.now() - startTime;

  // Track health check metric
  analytics.trackHealthCheck({
    status: stats.unhealthyInstances === 0 ? 'healthy' :
            stats.unhealthyInstances < stats.totalInstances * 0.3 ? 'degraded' : 'unhealthy',
    healthyInstances: stats.healthyInstances,
    totalInstances: stats.totalInstances,
    latency
  });
}
```

---

## Step 4: Query Analytics Data

### 4.1 GraphQL API

Query your metrics using Cloudflare GraphQL Analytics API:

```graphql
query WebSocketMetrics {
  viewer {
    accounts(filter: { accountTag: "YOUR_ACCOUNT_ID" }) {
      workersAnalyticsEngineAdaptiveGroups(
        limit: 1000
        filter: {
          datetime_geq: "2025-01-01T00:00:00Z"
          datetime_lt: "2025-01-08T00:00:00Z"
          AND: [
            { index1: "websocket_connection" }
          ]
        }
        orderBy: [datetime_ASC]
      ) {
        sum {
          double3  # count
        }
        avg {
          double2  # latency
        }
        dimensions {
          index2 # source
          index3 # status
          datetime(precision: HOUR)
        }
      }
    }
  }
}
```

### 4.2 REST API Example

```bash
curl -X POST "https://api.cloudflare.com/client/v4/graphql" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "query": "query { viewer { accounts(filter: {accountTag: \"YOUR_ACCOUNT_ID\"}) { workersAnalyticsEngineAdaptiveGroups(limit: 100, filter: {datetime_geq: \"2025-01-07T00:00:00Z\"}) { sum { double3 } dimensions { index1 index3 } } } } }"
  }'
```

---

## Step 5: Set Up Dashboards

### Option A: Cloudflare Dashboard (Built-in)

1. Go to Cloudflare Dashboard → Workers & Pages → Analytics
2. Select your worker (`mcis-worker`)
3. View built-in metrics:
   - Requests per second
   - CPU time
   - Errors
   - Duration percentiles

### Option B: Grafana Cloud Integration

1. Create Grafana Cloud account
2. Install Cloudflare data source plugin
3. Configure API token with Analytics Read permissions
4. Create dashboards using the GraphQL queries above

Example Grafana Dashboard JSON:
```json
{
  "panels": [
    {
      "title": "WebSocket Connections",
      "type": "timeseries",
      "datasource": "Cloudflare",
      "targets": [
        {
          "queryType": "analyticsEngine",
          "metric": "websocket_connection",
          "aggregation": "sum"
        }
      ]
    },
    {
      "title": "Average Latency",
      "type": "gauge",
      "datasource": "Cloudflare",
      "targets": [
        {
          "queryType": "analyticsEngine",
          "metric": "message_broadcast",
          "aggregation": "avg",
          "field": "latency"
        }
      ]
    }
  ]
}
```

### Option C: Logpush to External Systems

Configure Workers Logpush to send logs to:
- R2 (for long-term storage)
- S3 (AWS)
- Datadog
- Splunk
- New Relic

In `wrangler.toml`:
```toml
# Logpush configuration (Enterprise only)
[logpush]
enabled = true
dataset = "workers_trace_events"
destination = "r2://your-bucket/logs"
```

---

## Step 6: Configure Observability

### 6.1 Enable Observability in wrangler.toml

Already configured:
```toml
# Observability
[observability]
enabled = true
```

This enables:
- Worker Traces
- Tail logs
- Error tracking
- Performance metrics

### 6.2 Use wrangler tail for Real-time Logs

```bash
# Real-time logs
wrangler tail

# Filtered by status
wrangler tail --status error

# JSON format for parsing
wrangler tail --format=json

# Search for specific patterns
wrangler tail --search "circuit_breaker"
```

---

## Step 7: Set Up Alerts

### 7.1 Cloudflare Notifications

1. Go to Cloudflare Dashboard → Notifications
2. Create new notification:
   - **Type**: Workers Health Alert
   - **Worker**: mcis-worker
   - **Trigger**: Error rate > 5%
   - **Delivery**: Email/Slack/Webhook

### 7.2 Custom Alert Webhook

Create a webhook handler in your worker:

```typescript
// In src/handlers/monitoring-main.ts

monitoringHandler.post('/webhook/alert', async (c) => {
  const alert = await c.req.json();

  // Forward to Slack
  await fetch(c.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: ` Alert: ${alert.message}`,
      attachments: [{
        color: alert.severity === 'critical' ? 'danger' : 'warning',
        fields: [
          { title: 'Metric', value: alert.metric, short: true },
          { title: 'Value', value: String(alert.value), short: true }
        ]
      }]
    })
  });

  return c.json({ success: true });
});
```

---

## Metrics Reference

| Metric Name | Description | Source |
|-------------|-------------|--------|
| `websocket_connection` | WebSocket connect/disconnect events | websocket |
| `message_broadcast` | Message broadcast operations | websocket |
| `do_health_check` | Durable Object health checks | durable_object |
| `do_broadcast` | DO broadcast operations | durable_object |
| `circuit_breaker_state` | Circuit breaker state changes | circuit_breaker |
| `health_check` | Scheduled health check results | cron |
| `api_request` | API request metrics | api |

---

## Best Practices

1. **Sampling**: For high-volume metrics, implement sampling to reduce costs
2. **Batching**: Batch multiple metrics into single writes where possible
3. **Error Handling**: Always wrap analytics calls in try-catch
4. **Privacy**: Never log PII in analytics blobs
5. **Retention**: Configure appropriate retention periods (7-90 days)
6. **Alerts**: Set up alerts for critical metrics (error rate, latency)
7. **Dashboards**: Create role-specific dashboards (ops, dev, business)

---

## Troubleshooting

### Analytics Not Writing
1. Check `ANALYTICS` binding in wrangler.toml
2. Verify dataset name matches
3. Check for errors in wrangler tail logs

### Missing Metrics
1. Ensure `writeDataPoint` is called
2. Check index/blob/double limits (max 20 each)
3. Verify data types (strings for indexes/blobs, numbers for doubles)

### GraphQL Errors
1. Check API token permissions
2. Verify account ID
3. Check date range format (ISO 8601)

---

## Cost Considerations

- **Analytics Engine**: First 10M writes/month free, then $0.25/million
- **Logpush**: Enterprise feature, contact Cloudflare for pricing
- **Grafana Cloud**: Free tier available, paid plans for higher volume

For most workloads, the free tier is sufficient for monitoring a WebSocket system with < 100K concurrent users.
