# Analytics Module ()

> **Version:** 2.0.0
> **Status:** Production Ready
> **TypeScript Path:** `@analytics/*`


 SSE


- **** -
- **** -
- **** - JSONCSVPDF
- **** -
- **SSE ** - Server-Sent Events
- **** -
- **** -
- **KPI ** -
- **** -
- **** -

## API (49)

### (9)

```
GET /api/analytics/conversations #
GET /api/analytics/messages #
GET /api/analytics/users #
GET /api/analytics/performance #
POST /api/analytics/custom #
POST /api/analytics/export #
GET /api/analytics/health #
GET /api/analytics/stats #
GET /api/analytics/insights #
```

### (15)

```
GET /api/analytics/dashboard/config/:id #
POST /api/analytics/dashboard/config/:id #
DELETE /api/analytics/dashboard/config/:id #
GET /api/analytics/dashboard/widgets/:id # Widget
POST /api/analytics/dashboard/widgets # Widget
PUT /api/analytics/dashboard/widgets/:id # Widget
DELETE /api/analytics/dashboard/widgets/:id # Widget
POST /api/analytics/dashboard/layout #
GET /api/analytics/dashboard/list #
POST /api/analytics/dashboard/clone/:id #
POST /api/analytics/dashboard/share/:id #
GET /api/analytics/dashboard/templates #
POST /api/analytics/dashboard/export/:id #
GET /api/analytics/dashboard/metrics #
GET /api/analytics/dashboard/health #
```

### (10)

```
GET /api/analytics/realtime/sse/:id # SSE
POST /api/analytics/realtime/subscription #
DELETE /api/analytics/realtime/subscription/:id #
GET /api/analytics/realtime/connections #
POST /api/analytics/realtime/broadcast #
GET /api/analytics/realtime/metrics #
GET /api/analytics/realtime/status #
POST /api/analytics/realtime/ping #
GET /api/analytics/realtime/config #
PUT /api/analytics/realtime/config #
```

### (15)

```
POST /api/analytics/reports/generate #
GET /api/analytics/reports/:id #
DELETE /api/analytics/reports/:id #
GET /api/analytics/reports/list #
GET /api/analytics/reports/download/:id #
POST /api/analytics/reports/:id/export #
POST /api/analytics/reports/schedule #
GET /api/analytics/reports/schedule/list #
PUT /api/analytics/reports/schedule/:id #
DELETE /api/analytics/reports/schedule/:id #
GET /api/analytics/reports/templates #
POST /api/analytics/reports/preview #
GET /api/analytics/reports/history #
GET /api/analytics/reports/stats #
GET /api/analytics/reports/health #
```


```typescript
import { AnalyticsService } from '@analytics/services';

const analyticsService = new AnalyticsService({
 database: db,
 kv: kvNamespace,
 env: env
});

// 7
const result = await analyticsService.getConversationAnalytics({
 timeRange: '7d',
 metrics: ['total_conversations', 'active_conversations', 'response_time'],
 filters: {
 teamId: 1,
 platform: 'line'
 },
 groupBy: ['date', 'platform']
});

console.log(result.data);
```


```typescript
import { DashboardService } from '@analytics/services';

const dashboardService = new DashboardService(db, kv);

const dashboard = await dashboardService.createDashboard({
 name: 'Customer Support Dashboard',
 layout: {
 type: 'grid',
 columns: 12,
 gap: 16
 },
 widgets: [
 {
 id: 'widget-1',
 type: 'metric',
 title: 'Active Conversations',
 dataSource: {
 type: 'analytics',
 query: 'conversation_count',
 parameters: { status: 'active' }
 },
 position: { x: 0, y: 0, width: 4, height: 2 }
 },
 {
 id: 'widget-2',
 type: 'chart',
 title: 'Response Time Trend',
 dataSource: {
 type: 'metrics',
 query: 'response_time_trend'
 },
 position: { x: 4, y: 0, width: 8, height: 4 }
 }
 ]
});
```

### SSE

```typescript
//
const eventSource = new EventSource('/api/analytics/realtime/sse/dashboard-1?widgets=widget-1,widget-2', {
 headers: {
 'Authorization': `Bearer ${token}`
 }
});

eventSource.addEventListener('widget_update', (event) => {
 const data = JSON.parse(event.data);
 console.log('Widget updated:', data);
 updateUI(data);
});

eventSource.addEventListener('heartbeat', (event) => {
 console.log('Connection alive');
});

eventSource.onerror = (error) => {
 console.error('SSE error:', error);
 eventSource.close();
};
```


```typescript
import { ReportsService } from '@analytics/services';

const reportsService = new ReportsService(db);

//
const report = await reportsService.generateReport({
 type: 'agent_performance',
 timeRange: {
 start: '2025-09-01',
 end: '2025-09-30'
 },
 format: 'pdf',
 options: {
 includeCharts: true,
 groupBy: 'week'
 }
});

// URL
console.log(`Download at: ${report.downloadUrl}`);
```


```
src/modules/analytics/
 handlers/
 analytics-main.ts # API (9)
 dashboard-main.ts # API (15)
 realtime-dashboard-main.ts # (10)
 reports-main.ts # API (15)
 comparison-api.ts # API
 index.ts
 services/
 analytics-core.ts #
 analytics-cache-service.ts #
 period-comparison-service.ts #
 metrics-collector.ts #
 dashboard-service.ts #
 widget-manager.ts # Widget
 realtime-dashboard-service.ts #
 report-scheduler-service.ts #
 reports-service.ts #
 layout-service.ts #
 index.ts
 middleware/
 analytics-auth.ts #
 metrics-middleware.ts #
 index.ts
 types/
 analytics-types.ts #
 metrics-types.ts #
 dashboard-types.ts #
 reports-types.ts #
 index.ts
 utils/
 calculation-helpers.ts #
 index.ts
 constants/
 metrics-definitions.ts #
 index.ts
 index.ts
```


- `@shared/database` - Schema
- `@shared/utils` -
- `@auth/*` -
- `@session/*` -


- `hono` - Web
- `drizzle-orm` - ORM
- `zod` -
- `@hono/zod-validator` - Zod


```typescript
interface AnalyticsModuleConfig {
 enableRealTimeMetrics: boolean; //
 metricsRetentionDays: number; //
 dashboardRefreshInterval: number; // (ms)
 exportFormats: ('json' | 'csv' | 'pdf')[];
 aggregationLevels: ('hourly' | 'daily' | 'weekly' | 'monthly')[];
 dashboard: {
 maxWidgetsPerDashboard: number; // Widget
 enableRealTimeDashboard: boolean;
 maxSSEConnections: number; // SSE
 defaultRefreshInterval: number;
 };
 layout: {
 breakpoints: {
 mobile: number;
 tablet: number;
 desktop: number;
 large: number;
 };
 defaultColumns: {
 mobile: number;
 tablet: number;
 desktop: number;
 large: number;
 };
 };
}
```


- **Metric Card** -
- **Line Chart** -
- **Bar Chart** -
- **Pie Chart** -
- **Area Chart** -
- **Gauge** -
- **Table** -
- **Heatmap** -
- **Progress Bar** -
- **Status Indicator** -


- `total_conversations` -
- `active_conversations` -
- `completed_conversations` -
- `average_response_time` -
- `conversation_duration` -


- `total_messages` -
- `messages_per_conversation` -
- `messages_per_hour` -
- `message_delivery_rate` -


- `active_users` -
- `new_users` -
- `user_engagement` -
- `user_retention` -


- `api_response_time` - API
- `error_rate` -
- `throughput` -
- `uptime` -


```bash

npm run test -- src/modules/analytics


npm run test:e2e -- analytics


npm run test:performance -- analytics
```


1. ****
 - KV TTL: 5-15
 -
 -

2. ****
 -
 -
 -

3. **SSE **
 - 1000
 -
 -


- ****: < 500ms (P95)
- ****: < 2s ( Widget)
- **SSE **: < 100ms
- ****: < 5s ()
- ****: 1000+ SSE connections
- ****: > 80%


### Q:

A: `MetricsCollector`

```typescript
metricsCollector.register({
 name: 'custom_metric',
 calculate: async (params) => {
 //
 return value;
 }
});
```

### Q: SSE

A:

### Q:

A: +


### v2.0.0 (2025-09-30)
- TypeScript `@analytics/*`
- 49 API
-
- SSE
-

### v1.0.0
-

---

****: Multi-Channel Integration System Team
****: 2025-09-30