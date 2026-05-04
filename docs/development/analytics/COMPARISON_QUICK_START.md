# -
## Period Comparison Quick Start Guide

****: API
****: 15
****: API

---

## (3 )

### Step 1:

```vue
<!-- Dashboard -->
<script setup lang="ts">
import MetricsComparisonDashboard from '@/components/analytics/MetricsComparisonDashboard.vue';
</script>

<template>
 <div class="dashboard">
 <!-- -->

 <!-- : -->
 <MetricsComparisonDashboard
 title=""
 preset="conversation"
 :auto-refresh="true"
 :refresh-interval="30000"
 />
 </div>
</template>
```

### Step 2: API ()

```typescript
// src/index.ts
import { comparisonAPI } from './modules/analytics';

//
app.route('/api/analytics/comparison', comparisonAPI);
```

### Step 3:

```bash

bun run dev

# ()
cd frontend && bun run dev


# http://localhost:3000/dashboard
```

---


### 1:

```vue
<MetricsComparisonDashboard
 title=""
 preset="conversation"
 :auto-refresh="true"
 :refresh-interval="30000"
/>
```

****:
- 3 :
- 30
-

### 2:

```vue
<MetricsComparisonDashboard
 title=""
 preset="message"
 :auto-refresh="false"
/>
```

****:
- 3 :
-

### 3:

```vue
<MetricsComparisonDashboard
 title=""
 preset="user-activity"
 :auto-refresh="true"
 :refresh-interval="60000"
/>
```

****:
- 2 :
- 60

### 4:

```vue
<MetricsComparisonDashboard
 title=""
 :preset="null"
 :auto-refresh="false"
/>
```

****:
-
-

---

## API

### API 1:

```typescript
// ( 7 vs 7 )
const response = await fetch(
 '/api/analytics/comparison/metric?' + new URLSearchParams({
 metric: 'total_conversations',
 currentStart: '2025-09-23T00:00:00Z',
 currentEnd: '2025-09-30T23:59:59Z'
 }),
 {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 }
);

const result = await response.json();
console.log(result.data);
/*
{
 current: 1234,
 previous: 1072,
 change: 162,
 changePercentage: 15.11,
 trend: "up",
 period: {
 current: { start: "...", end: "..." },
 previous: { start: "...", end: "..." }
 }
}
*/
```

### API 2:

```typescript
const response = await fetch(
 '/api/analytics/comparison/metrics?' + new URLSearchParams({
 metrics: 'total_conversations,active_conversations,closed_conversations',
 currentStart: '2025-09-23T00:00:00Z',
 currentEnd: '2025-09-30T23:59:59Z'
 }),
 {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 }
);

const result = await response.json();
console.log(result.data.metrics);
// { total_conversations: {...}, active_conversations: {...}, ... }
console.log(result.data.summary);
// { totalMetrics: 3, improvedMetrics: 2, declinedMetrics: 0, ... }
```

### API 3:

```typescript
//
const response = await fetch(
 '/api/analytics/comparison/preset/conversation?' + new URLSearchParams({
 currentStart: '2025-09-23T00:00:00Z',
 currentEnd: '2025-09-30T23:59:59Z',
 teamId: '5' //
 }),
 {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 }
);
```

****:
- `conversation`:
- `message`:
- `user-activity`:

### API 4:

```typescript
const response = await fetch('/api/analytics/comparison/cache/stats', {
 headers: {
 'Authorization': `Bearer ${token}`
 }
});

const result = await response.json();
console.log(result.data);
/*
{
 hits: 42,
 misses: 8,
 totalRequests: 50,
 hitRate: 84.0,
 sets: 8,
 deletes: 2
}
*/
```

---


```vue
<script setup lang="ts">
import MetricComparison from '@/components/analytics/MetricComparison.vue';

const comparisonData = {
 current: 1234,
 previous: 1072,
 change: 162,
 changePercentage: 15.11,
 trend: 'up',
 period: {
 current: { start: '2025-09-23T00:00:00Z', end: '2025-09-30T23:59:59Z' },
 previous: { start: '2025-09-16T00:00:00Z', end: '2025-09-22T23:59:59Z' }
 }
};
</script>

<template>
 <MetricComparison
 label=""
 :data="comparisonData"
 :expandable="true"
 :show-tooltip="true"
 />
</template>
```


```vue
<script setup lang="ts">
//
const timeFormatter = (seconds: number) => {
 if (seconds < 60) return `${seconds.toFixed(0)}`;
 if (seconds < 3600) return `${(seconds / 60).toFixed(1)}`;
 return `${(seconds / 3600).toFixed(1)}`;
};

//
const percentFormatter = (value: number) => {
 return `${value.toFixed(2)}%`;
};
</script>

<template>
 <MetricComparison
 label=""
 :data="responseTimeData"
 :value-formatter="timeFormatter"
 />

 <MetricComparison
 label=""
 :data="conversionData"
 :value-formatter="percentFormatter"
 />
</template>
```


```vue
<template>
 <MetricComparison
 label=""
 :data="comparisonData"
 :expandable="true"
 >
 <template #history>
 <div class="custom-history">
 <!-- -->
 <LineChart :data="historicalData" />
 </div>
 </template>
 </MetricComparison>
</template>
```

---


### MetricsComparisonDashboard Props

| | | | |
|------|------|--------|------|
| `title` | `string` | `''` | |
| `preset` | `'conversation' \| 'message' \| 'user-activity' \| null` | `null` | |
| `autoRefresh` | `boolean` | `false` | |
| `refreshInterval` | `number` | `30000` | () |

### MetricComparison Props

| | | | |
|------|------|--------|------|
| `label` | `string` | **** | |
| `data` | `ComparisonData` | **** | |
| `expandable` | `boolean` | `true` | |
| `showTooltip` | `boolean` | `true` | Tooltip |
| `valueFormatter` | `(value: number) => string` | `toLocaleString` | |

---


| | | |
|------|----------|------|
| ** 1 ** | 1 | |
| **** | 00:00 | |
| ** 7 ** | 7 | |
| ** 30 ** | 30 | |
| ** 90 ** | 90 | |
| **** | | |

---


| | | | |
|------|------|------|----------|
| **** | | | > +5% |
| **** | | | < -5% |
| **** | | | -5% +5% |


| | | |
|------|------|----------|
| **positive** | | > |
| **negative** | | > |
| **neutral** | | |
| **mixed** | | = |

---


 TTL

| | TTL | |
|----------|-----|------|
| 1 | 2 | |
| 1 | 5 | |
| 1 | 10 | |
| > 1 | 30 | |

****:
- TTL 85%+
- (< 1 )
-


```vue
<!-- : -->
<MetricsComparisonDashboard
 preset="conversation"
 :auto-refresh="true"
 :refresh-interval="30000"
/>

<!-- : -->
<MetricsComparisonDashboard
 preset="conversation"
 :auto-refresh="true"
 :refresh-interval="5000"
/>
<!-- -->
```

---

## (FAQ)

### Q1:

**A**: `PeriodComparisonService` `getMetricValue` case

```typescript
// src/modules/analytics/services/period-comparison-service.ts
private async getMetricValue(metric: string, period: Period, filters: any): Promise<number> {
 switch (metric) {
 // ...

 case 'your_custom_metric':
 return await this.getYourCustomMetric(period, filters);

 default:
 throw new Error(`Unknown metric: ${metric}`);
 }
}

private async getYourCustomMetric(period: Period, filters: any): Promise<number> {
 //
 const result = await this.db
 .select({ count: sql`COUNT(*)` })
 .from(yourTable)
 .where(this.buildWhereConditions(period, filters));

 return Number(result[0]?.count || 0);
}
```

### Q2:

**A**: `PeriodComparisonService` `determineTrend`

```typescript
private determineTrend(changePercentage: number): 'up' | 'down' | 'stable' {
 const threshold = 5; // ( 10)
 if (changePercentage > threshold) return 'up';
 if (changePercentage < -threshold) return 'down';
 return 'stable';
}
```

### Q3:

**A**: `#history`

```vue
<script setup lang="ts">
import { Line } from 'vue-chartjs';
import { ref, onMounted } from 'vue';

const chartData = ref({
 labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
 datasets: [{
 label: 'Total Conversations',
 data: [1000, 1050, 1100, 1234]
 }]
});
</script>

<template>
 <MetricComparison
 label=""
 :data="comparisonData"
 >
 <template #history>
 <Line :data="chartData" :options="{ responsive: true }" />
 </template>
 </MetricComparison>
</template>
```

### Q4:

**A**: API `teamId` `userId`

```typescript
const response = await fetch(
 '/api/analytics/comparison/preset/conversation?' + new URLSearchParams({
 currentStart: '2025-09-23T00:00:00Z',
 currentEnd: '2025-09-30T23:59:59Z',
 teamId: '5', //
 userId: '123' //
 }),
 {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 }
);
```

### Q5:

**A**:

```typescript
// CSV
function exportComparisonToCSV(data: MultiMetricComparison) {
 const rows = [
 ['', '', '', '', '', '']
 ];

 Object.entries(data.metrics).forEach(([metric, comparison]) => {
 rows.push([
 metric,
 String(comparison.current),
 String(comparison.previous),
 String(comparison.change),
 `${comparison.changePercentage.toFixed(2)}%`,
 comparison.trend
 ]);
 });

 const csv = rows.map(row => row.join(',')).join('\n');
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `comparison-${Date.now()}.csv`;
 a.click();
}
```

---


- [ ] [](../PERIOD_COMPARISON_IMPLEMENTATION_REPORT.md)
- [ ] [Analytics ](../../src/modules/analytics/README.md)
- [ ] [API ](../../docs/api/ANALYTICS_API_REFERENCE.md)


- [ ] Reports -
- [ ] Dashboard -
- [ ] Real-time - SSE

---


****: Issue GitHub
****: PR Feature Request
**Bug **:

---

****: v1.0
****: 2025-09-30
****: Analytics Team