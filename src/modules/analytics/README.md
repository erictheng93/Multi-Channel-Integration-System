# Analytics Module

> **Version:** 3.0.0
> **Status:** Production Ready

## Overview

Comprehensive analytics system with dashboards, custom widgets, metrics collection, and data export.

## Features

- **Core Analytics** - Conversation, message, user, and performance metrics
- **Custom Dashboards** - Configurable widget-based dashboards with drag-and-drop layout
- **Real-time Dashboard** - WebSocket-based live metric updates
- **Period Comparison** - Compare metrics across time periods
- **Data Export** - JSON, CSV, PDF export formats
- **KPI Tracking** - Key performance indicator monitoring
- **Caching** - KV-based analytics cache for performance

## API Endpoints (34)

### Core Analytics (9)

```
GET  /api/analytics/conversations # Conversation analytics
GET  /api/analytics/messages # Message analytics
GET  /api/analytics/users # User analytics
GET  /api/analytics/performance # Performance analytics
POST /api/analytics/custom # Custom query
POST /api/analytics/export # Export data
GET  /api/analytics/health # Health check
GET  /api/analytics/stats # Statistics
GET  /api/analytics/insights # AI insights
```

### Dashboard (15)

```
GET /api/analytics/dashboard/config/:id # Get dashboard config
POST /api/analytics/dashboard/config/:id # Save dashboard config
DELETE /api/analytics/dashboard/config/:id # Delete dashboard
GET /api/analytics/dashboard/widgets/:id # Get widget
POST /api/analytics/dashboard/widgets # Create widget
PUT /api/analytics/dashboard/widgets/:id # Update widget
DELETE /api/analytics/dashboard/widgets/:id # Delete widget
POST /api/analytics/dashboard/layout # Update layout
GET /api/analytics/dashboard/list # List dashboards
POST /api/analytics/dashboard/clone/:id # Clone dashboard
POST /api/analytics/dashboard/share/:id # Share dashboard
GET /api/analytics/dashboard/templates # Get templates
POST /api/analytics/dashboard/export/:id # Export dashboard
GET /api/analytics/dashboard/metrics # Dashboard metrics
GET /api/analytics/dashboard/health # Dashboard health
```

### Real-time Dashboard

```
POST /api/analytics/realtime/subscription # Get WebSocket channels for dashboard updates
DELETE /api/analytics/realtime/subscription/:id # Release client-side subscription
POST /api/analytics/realtime/broadcast # Broadcast widget/config update via WebSocket
POST /api/analytics/realtime/trigger-update/:dashboardId/:widgetId # Trigger widget refresh broadcast
POST /api/analytics/realtime/trigger-update/:dashboardId # Trigger dashboard refresh broadcast
GET /api/analytics/realtime/status # WebSocket connection status
GET /api/analytics/realtime/health # Health check
POST /api/analytics/realtime/cleanup # Cleanup hook for compatibility
```

> **Note**: Real-time updates use WebSocket via Durable Objects. Clients subscribe to the returned WebSocket channels; the legacy interval-polling transition path has been removed. The SSE endpoint (`/realtime/sse/:id`) was removed in Feb 2026.

## Structure

```
src/modules/analytics/
  handlers/
    analytics-main.ts # Core analytics API
    dashboard-main.ts # Dashboard API
    realtime-dashboard-main.ts # Real-time dashboard API
    comparison-api.ts # Period comparison API
  services/
    analytics-core.ts # Core analytics engine
    analytics-cache-service.ts # KV caching layer
    dashboard-service.ts # Dashboard CRUD
    widget-manager.ts # Widget lifecycle
    realtime-dashboard-service.ts # Real-time updates
    layout-service.ts # Dashboard layout
    metrics-collector.ts # Metrics collection
    period-comparison-service.ts # Time comparison
  middleware/
    analytics-auth.ts # Authorization
    metrics-middleware.ts # Request metrics
  types/
    analytics-types.ts
    metrics-types.ts
    dashboard-types.ts
    reports-types.ts # Shared type definitions
```

> **Note**: Report generation is handled by `src/modules/reports/` (single source of truth). The analytics module provides types only.

## Usage

```typescript
import { AnalyticsService } from '@analytics/services';

const analytics = new AnalyticsService({ database: db, kv, env });

const result = await analytics.getConversationAnalytics({
  timeRange: '7d',
  metrics: ['total_conversations', 'active_conversations', 'response_time'],
  filters: { teamId: 1, platform: 'line' },
  groupBy: ['date', 'platform']
});
```
