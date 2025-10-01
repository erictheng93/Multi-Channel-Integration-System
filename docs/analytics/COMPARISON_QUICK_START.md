# 🚀 期間比較功能 - 快速開始指南
## Period Comparison Quick Start Guide

**目標受眾**: 前端開發者、API 使用者
**預估時間**: 15 分鐘
**前置條件**: 已部署後端 API、前端開發環境就緒

---

## 一、快速整合 (3 步驟)

### Step 1: 匯入組件

```vue
<!-- 在您的 Dashboard 頁面中 -->
<script setup lang="ts">
import MetricsComparisonDashboard from '@/components/analytics/MetricsComparisonDashboard.vue';
</script>

<template>
  <div class="dashboard">
    <!-- 您的現有內容 -->

    <!-- 新增: 期間比較儀表板 -->
    <MetricsComparisonDashboard
      title="對話指標分析"
      preset="conversation"
      :auto-refresh="true"
      :refresh-interval="30000"
    />
  </div>
</template>
```

### Step 2: 註冊 API 路由 (如尚未註冊)

```typescript
// src/index.ts
import { comparisonAPI } from './modules/analytics';

// 註冊路由
app.route('/api/analytics/comparison', comparisonAPI);
```

### Step 3: 測試驗證

```bash
# 啟動後端
npm run dev

# 啟動前端 (新終端)
cd frontend && npm run dev

# 訪問頁面
# http://localhost:3000/dashboard
```

---

## 二、組件使用範例

### 範例 1: 對話指標儀表板

```vue
<MetricsComparisonDashboard
  title="對話指標趨勢"
  preset="conversation"
  :auto-refresh="true"
  :refresh-interval="30000"
/>
```

**效果**:
- 顯示 3 個指標: 總對話、活躍對話、已關閉對話
- 每 30 秒自動刷新
- 趨勢箭頭與顏色編碼

### 範例 2: 消息指標儀表板

```vue
<MetricsComparisonDashboard
  title="消息數據分析"
  preset="message"
  :auto-refresh="false"
/>
```

**效果**:
- 顯示 3 個指標: 總消息、客戶消息、客服消息
- 手動刷新

### 範例 3: 用戶活動儀表板

```vue
<MetricsComparisonDashboard
  title="用戶活動監控"
  preset="user-activity"
  :auto-refresh="true"
  :refresh-interval="60000"
/>
```

**效果**:
- 顯示 2 個指標: 活躍用戶、總活動數
- 每 60 秒刷新

### 範例 4: 自訂指標組合

```vue
<MetricsComparisonDashboard
  title="自訂指標分析"
  :preset="null"
  :auto-refresh="false"
/>
```

**效果**:
- 不使用預設集，手動選擇指標
- 手動刷新

---

## 三、API 直接調用

### API 1: 單一指標比較

```typescript
// 查詢總對話數 (最近 7 天 vs 前 7 天)
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

### API 2: 多指標批量比較

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

### API 3: 預設指標集

```typescript
// 對話指標預設集
const response = await fetch(
  '/api/analytics/comparison/preset/conversation?' + new URLSearchParams({
    currentStart: '2025-09-23T00:00:00Z',
    currentEnd: '2025-09-30T23:59:59Z',
    teamId: '5' // 可選
  }),
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

**可用預設集**:
- `conversation`: 總對話、活躍對話、已關閉對話
- `message`: 總消息、客戶消息、客服消息
- `user-activity`: 活躍用戶、總活動數

### API 4: 快取統計

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

## 四、自訂單一指標卡片

### 基礎用法

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
    label="總對話數"
    :data="comparisonData"
    :expandable="true"
    :show-tooltip="true"
  />
</template>
```

### 自訂值格式化

```vue
<script setup lang="ts">
// 時間格式化
const timeFormatter = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(0)}秒`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}分鐘`;
  return `${(seconds / 3600).toFixed(1)}小時`;
};

// 百分比格式化
const percentFormatter = (value: number) => {
  return `${value.toFixed(2)}%`;
};
</script>

<template>
  <MetricComparison
    label="平均回應時間"
    :data="responseTimeData"
    :value-formatter="timeFormatter"
  />

  <MetricComparison
    label="轉換率"
    :data="conversionData"
    :value-formatter="percentFormatter"
  />
</template>
```

### 添加歷史趨勢內容

```vue
<template>
  <MetricComparison
    label="總對話數"
    :data="comparisonData"
    :expandable="true"
  >
    <template #history>
      <div class="custom-history">
        <!-- 您可以在這裡添加圖表或其他內容 -->
        <LineChart :data="historicalData" />
      </div>
    </template>
  </MetricComparison>
</template>
```

---

## 五、組件屬性參考

### MetricsComparisonDashboard Props

| 屬性 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `title` | `string` | `'指標比較儀表板'` | 儀表板標題 |
| `preset` | `'conversation' \| 'message' \| 'user-activity' \| null` | `null` | 預設指標集 |
| `autoRefresh` | `boolean` | `false` | 是否自動刷新 |
| `refreshInterval` | `number` | `30000` | 刷新間隔 (毫秒) |

### MetricComparison Props

| 屬性 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `label` | `string` | **必填** | 指標標籤 |
| `data` | `ComparisonData` | **必填** | 比較數據 |
| `expandable` | `boolean` | `true` | 是否可展開 |
| `showTooltip` | `boolean` | `true` | 是否顯示 Tooltip |
| `valueFormatter` | `(value: number) => string` | `toLocaleString` | 值格式化函數 |

---

## 六、期間選擇器

儀表板內建期間選擇器，支援：

| 選項 | 時間範圍 | 說明 |
|------|----------|------|
| **過去 1 小時** | 最近 1 小時 | 實時監控 |
| **今天** | 00:00 至今 | 當日數據 |
| **過去 7 天** | 最近 7 天 | 週報數據 |
| **過去 30 天** | 最近 30 天 | 月報數據 |
| **過去 90 天** | 最近 90 天 | 季報數據 |
| **自訂期間** | 自選時間 | 彈性分析 |

---

## 七、趨勢指標說明

### 趨勢類型

| 趨勢 | 圖示 | 顏色 | 判定標準 |
|------|------|------|----------|
| **上升** | ↗ | 綠色 | 變化 > +5% |
| **下降** | ↘ | 紅色 | 變化 < -5% |
| **穩定** | → | 灰色 | -5% ≤ 變化 ≤ +5% |

### 總體趨勢

| 趨勢 | 說明 | 計算邏輯 |
|------|------|----------|
| **positive** | 正向 | 改善指標 > 下降指標 |
| **negative** | 負向 | 下降指標 > 改善指標 |
| **neutral** | 中性 | 全部穩定 |
| **mixed** | 混合 | 改善 = 下降 |

---

## 八、效能優化建議

### 快取策略

系統已內建智能快取，根據查詢範圍自動調整 TTL：

| 查詢範圍 | TTL | 說明 |
|----------|-----|------|
| ≤ 1 小時 | 2 分鐘 | 實時數據 |
| ≤ 1 天 | 5 分鐘 | 日內數據 |
| ≤ 1 週 | 10 分鐘 | 週數據 |
| > 1 週 | 30 分鐘 | 長期數據 |

**最佳實踐**:
- 相同查詢在 TTL 內重複請求，命中率可達 85%+
- 避免使用過短的自訂期間 (< 1 小時)
- 預設集比自訂指標更高效

### 自動刷新設定

```vue
<!-- ✅ 推薦: 實時監控使用短間隔 -->
<MetricsComparisonDashboard
  preset="conversation"
  :auto-refresh="true"
  :refresh-interval="30000"
/>

<!-- ❌ 不推薦: 歷史數據使用自動刷新 -->
<MetricsComparisonDashboard
  preset="conversation"
  :auto-refresh="true"
  :refresh-interval="5000"
/>
<!-- 建議使用手動刷新 -->
```

---

## 九、常見問題 (FAQ)

### Q1: 如何添加自訂指標？

**A**: 在後端 `PeriodComparisonService` 的 `getMetricValue` 方法中添加新 case：

```typescript
// src/modules/analytics/services/period-comparison-service.ts
private async getMetricValue(metric: string, period: Period, filters: any): Promise<number> {
  switch (metric) {
    // 現有指標...

    case 'your_custom_metric':
      return await this.getYourCustomMetric(period, filters);

    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
}

private async getYourCustomMetric(period: Period, filters: any): Promise<number> {
  // 實作您的指標計算邏輯
  const result = await this.db
    .select({ count: sql`COUNT(*)` })
    .from(yourTable)
    .where(this.buildWhereConditions(period, filters));

  return Number(result[0]?.count || 0);
}
```

### Q2: 如何調整趨勢判定閾值？

**A**: 修改 `PeriodComparisonService` 的 `determineTrend` 方法：

```typescript
private determineTrend(changePercentage: number): 'up' | 'down' | 'stable' {
  const threshold = 5; // 改為您想要的閾值 (如 10)
  if (changePercentage > threshold) return 'up';
  if (changePercentage < -threshold) return 'down';
  return 'stable';
}
```

### Q3: 如何整合圖表庫？

**A**: 使用 `#history` 插槽：

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
    label="總對話數"
    :data="comparisonData"
  >
    <template #history>
      <Line :data="chartData" :options="{ responsive: true }" />
    </template>
  </MetricComparison>
</template>
```

### Q4: 如何過濾特定團隊或用戶？

**A**: 在 API 請求中添加 `teamId` 或 `userId` 參數：

```typescript
const response = await fetch(
  '/api/analytics/comparison/preset/conversation?' + new URLSearchParams({
    currentStart: '2025-09-23T00:00:00Z',
    currentEnd: '2025-09-30T23:59:59Z',
    teamId: '5',      // 過濾特定團隊
    userId: '123'     // 過濾特定用戶
  }),
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Q5: 如何導出比較數據？

**A**: 目前版本暫未實作導出功能，可透過以下方式：

```typescript
// 手動導出為 CSV
function exportComparisonToCSV(data: MultiMetricComparison) {
  const rows = [
    ['指標', '當前值', '前期值', '變化', '變化率', '趨勢']
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

## 十、下一步學習

### 進階主題

- [ ] [完整實施報告](../PERIOD_COMPARISON_IMPLEMENTATION_REPORT.md)
- [ ] [Analytics 模組文檔](../../src/modules/analytics/README.md)
- [ ] [API 參考文檔](../../docs/api/ANALYTICS_API_REFERENCE.md)

### 相關功能

- [ ] Reports 模組 - 報表生成與排程
- [ ] Dashboard 模組 - 自訂儀表板與小工具
- [ ] Real-time 模組 - SSE 實時數據推送

---

## 技術支援

**文檔問題**: 請提交 Issue 至專案 GitHub
**功能建議**: 歡迎提交 PR 或 Feature Request
**Bug 回報**: 請附上詳細錯誤日誌與重現步驟

---

**版本**: v1.0
**最後更新**: 2025-09-30
**維護者**: Analytics Team