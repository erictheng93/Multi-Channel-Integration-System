# Period Comparison Integration Guide


 **Period Comparison ()**

- **** -
- **** -
- **KV ** - TTL (2-30 )
- **RESTful API** - REST endpoints
- **Vue 3 ** - UI

---


```

 Frontend (Vue 3)

 MetricComparison.vue
 MetricsComparisonDashboard.vue
 ComparisonDashboardExample.vue

 HTTP/REST


 Backend API (Cloudflare Workers)

 comparison-api.ts
 GET /api/analytics/comparison/metric
 GET /api/analytics/comparison/metrics ()
 GET /api/analytics/comparison/preset/conversation
 GET /api/analytics/comparison/preset/message
 GET /api/analytics/comparison/preset/user-activity
 GET /api/analytics/comparison/cache/stats


 Service Layer

 PeriodComparisonService
 compareMetric()
 compareMultipleMetrics()
 compareConversationMetrics()
 compareMessageMetrics()
 compareUserActivityMetrics()

 AnalyticsCacheService (KV Cache)
 Smart TTL Strategy (2-30 )
 Cache Hit Rate Tracking
 Automatic Invalidation


 Database (Cloudflare D1)
 Storage (Cloudflare KV)

```

---


### 1.


```typescript
// Example: 7
: 2025-01-23 2025-01-30
: 2025-01-16 2025-01-23 ()

//
1173090
```

****
-
-
-

### 2.


```typescript
changePercentage >= 5% 'up' ()
changePercentage <= -5% 'down' ()
-5% < changePercentage < 5% 'stable' ()
```

### 3.

 TTL

| | TTL () | |
|------------|---------|------|
| 1 | 120 | |
| 24 | 300 | |
| 7 | 600 | |
| > 7 | 1800 | |

****
```
analytics:cache:v1:comparison:{metric}:{hash}
```

---

## API

### Endpoint 1:

**GET** `/api/analytics/comparison/metric`

**Query Parameters:**
```typescript
{
 metric: string // -
 currentStart: string // - (ISO 8601)
 currentEnd: string // - (ISO 8601)
 previousStart?: string // - ()
 previousEnd?: string // - ()
 teamId?: number // -
 userId?: number // -
}
```

**Response:**
```json
{
 "success": true,
 "data": {
 "current": 1250,
 "previous": 1100,
 "change": 150,
 "changePercentage": 13.64,
 "trend": "up",
 "period": {
 "current": {
 "start": "2025-01-23T00:00:00Z",
 "end": "2025-01-30T23:59:59Z"
 },
 "previous": {
 "start": "2025-01-16T00:00:00Z",
 "end": "2025-01-22T23:59:59Z",
 "label": ""
 }
 }
 },
 "metadata": {
 "metric": "total_conversations",
 "processedAt": "2025-01-30T12:00:00Z"
 }
}
```

**:**
```typescript
// JavaScript/TypeScript
const response = await fetch(
 `/api/analytics/comparison/metric?` +
 `metric=total_conversations&` +
 `currentStart=2025-01-23T00:00:00Z&` +
 `currentEnd=2025-01-30T23:59:59Z&` +
 `teamId=5`,
 {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 }
);

const result = await response.json();
console.log(`: ${result.data.trend}`);
console.log(`: ${result.data.changePercentage}%`);
```

### Endpoint 2:

**GET** `/api/analytics/comparison/metrics`

**Query Parameters:**
```typescript
{
 metrics: string // -
 currentStart: string //
 currentEnd: string //
 previousStart?: string //
 previousEnd?: string //
 teamId?: number //
 userId?: number //
}
```

**Response:**
```json
{
 "success": true,
 "data": {
 "metrics": {
 "total_conversations": {
 "current": 1250,
 "previous": 1100,
 "change": 150,
 "changePercentage": 13.64,
 "trend": "up",
 "period": { ... }
 },
 "active_conversations": {
 "current": 450,
 "previous": 400,
 "change": 50,
 "changePercentage": 12.5,
 "trend": "up",
 "period": { ... }
 }
 },
 "summary": {
 "totalMetrics": 2,
 "improvedMetrics": 2,
 "declinedMetrics": 0,
 "stableMetrics": 0,
 "overallTrend": "positive"
 }
 },
 "metadata": {
 "metricsCount": 2,
 "processedAt": "2025-01-30T12:00:00Z"
 }
}
```

**:**
```typescript
const metrics = [
 'total_conversations',
 'active_conversations',
 'closed_conversations'
].join(',');

const response = await fetch(
 `/api/analytics/comparison/metrics?` +
 `metrics=${metrics}&` +
 `currentStart=2025-01-23T00:00:00Z&` +
 `currentEnd=2025-01-30T23:59:59Z`,
 {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 }
);
```

### Endpoint 3:

****
```
GET /api/analytics/comparison/preset/conversation
```
: `total_conversations`, `active_conversations`, `closed_conversations`

****
```
GET /api/analytics/comparison/preset/message
```
: `total_messages`, `customer_messages`, `agent_messages`

****
```
GET /api/analytics/comparison/preset/user-activity
```
: `active_users`, `total_activities`

**Query Parameters:**
```typescript
{
 currentStart: string //
 currentEnd: string //
 teamId?: number //
}
```

### Endpoint 4:

**GET** `/api/analytics/comparison/cache/stats`

**Response:**
```json
{
 "success": true,
 "data": {
 "hits": 156,
 "misses": 44,
 "sets": 44,
 "deletes": 0,
 "totalRequests": 200,
 "hitRate": 78.0
 }
}
```

---


### 1: MetricComparison ()

**:**
```vue
<template>
 <MetricComparison
 label=""
 :data="comparisonData"
 :expandable="true"
 :show-tooltip="true"
 />
</template>

<script setup lang="ts">
import MetricComparison from '@/components/analytics/MetricComparison.vue';
import type { ComparisonData } from '@/types/analytics';

const comparisonData: ComparisonData = {
 current: 1250,
 previous: 1100,
 change: 150,
 changePercentage: 13.64,
 trend: 'up',
 period: {
 current: {
 start: '2025-01-23T00:00:00Z',
 end: '2025-01-30T23:59:59Z'
 },
 previous: {
 start: '2025-01-16T00:00:00Z',
 end: '2025-01-22T23:59:59Z'
 }
 }
};
</script>
```

**:**
```vue
<MetricComparison
 label=""
 :data="responseTimeData"
 :value-formatter="formatTime"
/>

<script setup>
function formatTime(value: number): string {
 if (value < 60) return `${value.toFixed(0)}`;
 if (value < 3600) return `${(value / 60).toFixed(1)}`;
 return `${(value / 3600).toFixed(1)}`;
}
</script>
```

**:**
- ( up / down / stable)
- ( )
- Hover tooltip
- ()
-

### 2: MetricsComparisonDashboard ()

**:**
```vue
<template>
 <MetricsComparisonDashboard
 title=""
 preset="conversation"
 :auto-refresh="true"
 :refresh-interval="30000"
 />
</template>

<script setup>
import MetricsComparisonDashboard from '@/components/analytics/MetricsComparisonDashboard.vue';
</script>
```

**:**
```vue
<MetricsComparisonDashboard
 title=""
 :preset="null"
 :auto-refresh="false"
/>
```
 `preset` `null`

**Props :**

| Prop | | | |
|------|-----|--------|------|
| `title` | string | '' | |
| `preset` | 'conversation' \| 'message' \| 'user-activity' \| null | null | |
| `autoRefresh` | boolean | false | |
| `refreshInterval` | number | 30000 | () |

**:**
- (1173090)
-
-
-
-
-
-

### 3: ComparisonDashboardExample ()

**:**
```vue
<template>
 <ComparisonDashboardExample />
</template>

<script setup>
import ComparisonDashboardExample from '@/components/analytics/ComparisonDashboardExample.vue';
</script>
```

 Tab
- Tab
- Tab
- Tab
- Tab

---


### 1: Dashboard.vue

```vue
<!-- frontend/src/views/Dashboard.vue -->
<template>
 <div class="dashboard">
 <h1></h1>

 <!-- -->
 <section class="comparison-section">
 <MetricsComparisonDashboard
 title=""
 preset="conversation"
 :auto-refresh="true"
 />
 </section>
 </div>
</template>

<script setup lang="ts">
import MetricsComparisonDashboard from '@/components/analytics/MetricsComparisonDashboard.vue';
</script>
```

### 2: Analytics

```typescript
// frontend/src/router/index.ts
{
 path: '/analytics',
 name: 'Analytics',
 component: () => import('@/components/analytics/ComparisonDashboardExample.vue'),
 meta: { requiresAuth: true }
}
```

### 3:

```vue
<!-- frontend/src/views/Reports.vue -->
<template>
 <div class="reports">
 <!-- -->

 <!-- -->
 <section class="trend-analysis">
 <h2></h2>
 <div class="metrics-row">
 <MetricComparison
 v-for="metric in metrics"
 :key="metric.key"
 :label="metric.label"
 :data="metric.comparison"
 />
 </div>
 </section>
 </div>
</template>
```

---


### (Conversation Metrics)

| | | |
|---------|-----|------|
| `total_conversations` | | |
| `active_conversations` | | |
| `closed_conversations` | | |

### (Message Metrics)

| | | |
|---------|-----|------|
| `total_messages` | | |
| `customer_messages` | | |
| `agent_messages` | | |

### (User Activity Metrics)

| | | |
|---------|-----|------|
| `active_users` | | |
| `total_activities` | | |

### (Performance Metrics)

| | | |
|---------|-----|------|
| `average_response_time` | | () |
| `first_response_time` | | () |

---


### 1.


```typescript
//
const cacheKey = `analytics:cache:v1:comparison:${metric}:${hash}`;

// TTL
const ttl = getDurationBasedTTL(period);
// 1: 120s
// 24: 300s
// 7: 600s
// >7: 1800s

await cacheService.set(cacheKey, data, ttl);
```

**:** 85%

### 2.

 `Promise.all()`

```typescript
//
const comparisons = await Promise.all(
 metrics.map(metric => this.compareMetric({ metric, ... }))
);
```

**:** 3-5x faster vs

### 3.

- **** - Vue Virtual Scroller
- **Lazy Loading** -
- **** - debounce
- **** -

---


**AnalyticsCacheService (22 tests)**
```bash

 Get/Set TTL
 (//)

 TTL
```

**PeriodComparisonService (16 tests)**
```bash
 (1h, 24h, 7d, 30d)

 (up/down/stable)


```

**:**
```bash
# Analytics
npm run test -- tests/unit/modules/analytics/


npm run test:coverage -- tests/unit/modules/analytics/
```

### ()


- [ ] MetricComparison
- [ ]
- [ ] Tooltip
- [ ] Dashboard
- [ ] API

---


### 1: API 401 Unauthorized

**:** token

**:**
```typescript
// Authorization header
const token = localStorage.getItem('token');
if (!token) {
 //
 router.push('/login');
}

fetch(apiUrl, {
 headers: {
 'Authorization': `Bearer ${token}`
 }
});
```

### 2:

**:**

**:**
```typescript
//
const currentPeriod = {
 start: new Date(start).toISOString(),
 end: new Date(end).toISOString()
};

//
```

### 3:

**:**
1. API URL `.env`
2. Console
3. CORS
4. API endpoints

**Debug :**
```vue
<script setup>
import { watchEffect } from 'vue';

watchEffect(() => {
 console.log('Current Period:', currentPeriod.value);
 console.log('Comparison Data:', comparisonData.value);
 console.log('Loading State:', loading.value);
 console.log('Error State:', error.value);
});
</script>
```

### 4: TypeScript

**:**
```typescript
//
import type {
 ComparisonData,
 MultiMetricComparison,
 Period
} from '@/types/analytics';

//
const data: ComparisonData = {
 current: 0,
 previous: 0,
 change: 0,
 changePercentage: 0,
 trend: 'stable',
 period: { ... }
};
```

---


### 1.

 Chart.js ECharts

```vue
<MetricComparison :data="data">
 <template #history>
 <LineChart :data="historicalData" />
 </template>
</MetricComparison>
```

### 2.

```typescript
async function exportComparison() {
 const response = await fetch(
 `/api/analytics/comparison/export?format=pdf&...`
 );
 const blob = await response.blob();
 downloadFile(blob, 'comparison-report.pdf');
}
```

### 3.


```typescript
if (comparison.changePercentage > 50) {
 await sendAlert({
 type: 'spike',
 metric: 'total_conversations',
 change: comparison.changePercentage
 });
}
```

### 4.


```typescript
interface CustomMetric {
 key: string;
 formula: string; // 'total_messages / total_conversations'
 label: string;
}
```

---


### 1.

- **:** 1 +
- **:** 1
- **:** 7
- **:** 30
- **:** 90

### 2.

- **:** TTL (10-30 )
- **:** TTL (2-5 )
- **:** TTL (30 +)

### 3.

```typescript
try {
 const comparison = await comparisonService.compareMetric(...);
 return comparison;
} catch (error) {
 //
 console.warn('Comparison failed:', error);

 //
 return {
 current: 0,
 previous: 0,
 change: 0,
 changePercentage: 0,
 trend: 'stable'
 };
}
```

### 4. UI/UX

- **:** () / () / ()
- **:** (1,250)
- **:**
- **Tooltip:**
- **:** Skeleton Loader

---


- **:** `/docs/analytics/`
- **API :** `/docs/api/analytics-comparison.md`
- **Issue Tracker:** GitHub Issues
- **:** dev@multi-channel-system.shop

---


### v2.0.0 (2025-01-30)
-
-
- KV
- RESTful API endpoints
- Vue 3 UI
- (38 tests, 100% pass)

---

** Period Comparison **