# Analytics Module (數據分析模組)

> **Version:** 2.0.0
> **Status:** ✅ Production Ready
> **TypeScript Path:** `@analytics/*`

## 📋 模組簡介

企業級數據分析與洞察平台，整合統計分析、互動式儀表板、實時監控和報表功能。提供全方位的數據可視化、多維度分析和自動化報表生成能力，支援 SSE 實時數據推送。

## 🚀 核心功能

- ✅ **實時數據收集** - 自動收集系統運行指標
- ✅ **互動式儀表板** - 可自定義的數據可視化面板
- ✅ **多格式報表** - 支援 JSON、CSV、PDF 導出
- ✅ **響應式佈局** - 適配桌面、平板、手機
- ✅ **SSE 實時推送** - Server-Sent Events 即時數據更新
- ✅ **多維度聚合** - 按小時、日、週、月聚合數據
- ✅ **權限控制** - 基於角色的數據訪問控制
- ✅ **KPI 監控** - 關鍵指標追蹤與告警
- ✅ **自定義指標** - 靈活的指標計算引擎
- ✅ **數據緩存** - 智能緩存提升查詢性能

## 📡 API 端點 (49個)

### 分析服務 (9個端點)

```
GET    /api/analytics/conversations    # 對話分析數據
GET    /api/analytics/messages         # 消息分析數據
GET    /api/analytics/users            # 用戶分析數據
GET    /api/analytics/performance      # 性能分析數據
POST   /api/analytics/custom           # 自定義分析查詢
POST   /api/analytics/export           # 導出分析數據
GET    /api/analytics/health           # 服務健康檢查
GET    /api/analytics/stats            # 統計概覽
GET    /api/analytics/insights         # 數據洞察
```

### 儀表板服務 (15個端點)

```
GET    /api/analytics/dashboard/config/:id     # 獲取儀表板配置
POST   /api/analytics/dashboard/config/:id     # 保存儀表板配置
DELETE /api/analytics/dashboard/config/:id     # 刪除儀表板
GET    /api/analytics/dashboard/widgets/:id    # 獲取 Widget 數據
POST   /api/analytics/dashboard/widgets        # 創建 Widget
PUT    /api/analytics/dashboard/widgets/:id    # 更新 Widget
DELETE /api/analytics/dashboard/widgets/:id    # 刪除 Widget
POST   /api/analytics/dashboard/layout         # 保存佈局
GET    /api/analytics/dashboard/list           # 列出所有儀表板
POST   /api/analytics/dashboard/clone/:id      # 複製儀表板
POST   /api/analytics/dashboard/share/:id      # 分享儀表板
GET    /api/analytics/dashboard/templates      # 獲取模板
POST   /api/analytics/dashboard/export/:id     # 導出儀表板
GET    /api/analytics/dashboard/metrics        # 可用指標列表
GET    /api/analytics/dashboard/health         # 健康檢查
```

### 實時儀表板 (10個端點)

```
GET    /api/analytics/realtime/sse/:id         # SSE 連接
POST   /api/analytics/realtime/subscription    # 訂閱更新
DELETE /api/analytics/realtime/subscription/:id # 取消訂閱
GET    /api/analytics/realtime/connections     # 活躍連接
POST   /api/analytics/realtime/broadcast       # 廣播更新
GET    /api/analytics/realtime/metrics         # 實時指標
GET    /api/analytics/realtime/status          # 連接狀態
POST   /api/analytics/realtime/ping            # 心跳檢測
GET    /api/analytics/realtime/config          # 配置信息
PUT    /api/analytics/realtime/config          # 更新配置
```

### 報表服務 (15個端點)

```
POST   /api/analytics/reports/generate         # 生成報表
GET    /api/analytics/reports/:id              # 獲取報表
DELETE /api/analytics/reports/:id              # 刪除報表
GET    /api/analytics/reports/list             # 列出所有報表
GET    /api/analytics/reports/download/:id     # 下載報表
POST   /api/analytics/reports/:id/export       # 導出報表
POST   /api/analytics/reports/schedule         # 創建排程
GET    /api/analytics/reports/schedule/list    # 列出排程
PUT    /api/analytics/reports/schedule/:id     # 更新排程
DELETE /api/analytics/reports/schedule/:id     # 刪除排程
GET    /api/analytics/reports/templates        # 報表模板
POST   /api/analytics/reports/preview          # 預覽報表
GET    /api/analytics/reports/history          # 報表歷史
GET    /api/analytics/reports/stats            # 報表統計
GET    /api/analytics/reports/health           # 健康檢查
```

## 💻 使用範例

### 獲取對話分析數據

```typescript
import { AnalyticsService } from '@analytics/services';

const analyticsService = new AnalyticsService({
  database: db,
  kv: kvNamespace,
  env: env
});

// 查詢最近7天的對話分析
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

### 創建自定義儀表板

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

### SSE 實時數據推送

```typescript
// 前端代碼
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

### 生成並下載報表

```typescript
import { ReportsService } from '@analytics/services';

const reportsService = new ReportsService(db);

// 生成報表
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

// 下載 URL
console.log(`Download at: ${report.downloadUrl}`);
```

## 🗂️ 模組結構

```
src/modules/analytics/
├── handlers/
│   ├── analytics-main.ts              # 分析 API 處理器 (9端點)
│   ├── dashboard-main.ts              # 儀表板 API (15端點)
│   ├── realtime-dashboard-main.ts     # 實時儀表板 (10端點)
│   ├── reports-main.ts                # 報表 API (15端點)
│   ├── comparison-api.ts              # 期間比較 API
│   └── index.ts
├── services/
│   ├── analytics-core.ts              # 核心分析引擎
│   ├── analytics-cache-service.ts     # 緩存管理
│   ├── period-comparison-service.ts   # 期間比較
│   ├── metrics-collector.ts           # 指標收集器
│   ├── dashboard-service.ts           # 儀表板服務
│   ├── widget-manager.ts              # Widget 管理
│   ├── realtime-dashboard-service.ts  # 實時服務
│   ├── report-scheduler-service.ts    # 報表排程
│   ├── reports-service.ts             # 報表服務
│   ├── layout-service.ts              # 佈局服務
│   └── index.ts
├── middleware/
│   ├── analytics-auth.ts              # 權限控制
│   ├── metrics-middleware.ts          # 指標收集中間件
│   └── index.ts
├── types/
│   ├── analytics-types.ts             # 分析類型
│   ├── metrics-types.ts               # 指標類型
│   ├── dashboard-types.ts             # 儀表板類型
│   ├── reports-types.ts               # 報表類型
│   └── index.ts
├── utils/
│   ├── calculation-helpers.ts         # 計算工具
│   └── index.ts
├── constants/
│   ├── metrics-definitions.ts         # 指標定義
│   └── index.ts
└── index.ts
```

## 📦 依賴關係

### 內部依賴
- `@shared/database` - 數據庫 Schema
- `@shared/utils` - 共享工具
- `@auth/*` - 認證系統
- `@session/*` - 會話管理

### 外部依賴
- `hono` - Web 框架
- `drizzle-orm` - 數據庫 ORM
- `zod` - 數據驗證
- `@hono/zod-validator` - Zod 集成

## 🔧 配置選項

```typescript
interface AnalyticsModuleConfig {
  enableRealTimeMetrics: boolean;       // 啟用實時指標
  metricsRetentionDays: number;         // 指標保留天數
  dashboardRefreshInterval: number;     // 儀表板刷新間隔 (ms)
  exportFormats: ('json' | 'csv' | 'pdf')[];
  aggregationLevels: ('hourly' | 'daily' | 'weekly' | 'monthly')[];
  dashboard: {
    maxWidgetsPerDashboard: number;     // 最大 Widget 數
    enableRealTimeDashboard: boolean;
    maxSSEConnections: number;          // 最大 SSE 連接數
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

## 🎨 支援的圖表類型

- **Metric Card** - 單一指標卡片
- **Line Chart** - 線圖（趨勢分析）
- **Bar Chart** - 柱狀圖（對比分析）
- **Pie Chart** - 圓餅圖（占比分析）
- **Area Chart** - 面積圖（累積趨勢）
- **Gauge** - 儀表盤（進度顯示）
- **Table** - 數據表格
- **Heatmap** - 熱力圖
- **Progress Bar** - 進度條
- **Status Indicator** - 狀態指示器

## 📊 預定義指標

### 對話指標
- `total_conversations` - 總對話數
- `active_conversations` - 活躍對話數
- `completed_conversations` - 已完成對話數
- `average_response_time` - 平均響應時間
- `conversation_duration` - 對話時長

### 消息指標
- `total_messages` - 總消息數
- `messages_per_conversation` - 平均每對話消息數
- `messages_per_hour` - 每小時消息數
- `message_delivery_rate` - 消息送達率

### 用戶指標
- `active_users` - 活躍用戶數
- `new_users` - 新用戶數
- `user_engagement` - 用戶參與度
- `user_retention` - 用戶留存率

### 性能指標
- `api_response_time` - API 響應時間
- `error_rate` - 錯誤率
- `throughput` - 吞吐量
- `uptime` - 系統正常運行時間

## 🧪 測試

```bash
# 運行分析模組測試
npm run test -- src/modules/analytics

# 運行端對端測試
npm run test:e2e -- analytics

# 運行性能測試
npm run test:performance -- analytics
```

## 📈 性能優化

1. **緩存策略**
   - KV 緩存熱點數據（TTL: 5-15分鐘）
   - 預聚合常用指標
   - 增量更新而非全量查詢

2. **查詢優化**
   - 數據庫索引優化
   - 分頁查詢大數據集
   - 並行查詢多個指標

3. **SSE 連接管理**
   - 連接池限制（最大 1000 個）
   - 自動清理閒置連接
   - 心跳機制保持活躍

## 📊 性能指標

- **查詢響應時間**: < 500ms (P95)
- **儀表板加載**: < 2s (包含所有 Widget)
- **SSE 推送延遲**: < 100ms
- **報表生成**: < 5s (標準報表)
- **併發連接**: 1000+ SSE connections
- **緩存命中率**: > 80%

## 🐛 常見問題

### Q: 如何創建自定義指標？

A: 使用 `MetricsCollector` 註冊新指標，並定義計算邏輯。

```typescript
metricsCollector.register({
  name: 'custom_metric',
  calculate: async (params) => {
    // 計算邏輯
    return value;
  }
});
```

### Q: SSE 連接斷開如何處理？

A: 前端應實現自動重連機制，後端自動清理過期連接。

### Q: 大數據量報表生成緩慢？

A: 使用異步生成 + 郵件通知，或限制數據範圍和導出行數。

## 📝 更新日誌

### v2.0.0 (2025-09-30)
- ✨ 新增 TypeScript 路徑別名 `@analytics/*`
- 🎉 49個 API 端點全部實現
- 📊 新增期間比較功能
- 🚀 SSE 實時推送優化
- 📝 完整模組文檔

### v1.0.0
- 🎉 初始版本發布

---

**維護團隊**: Multi-Channel Integration System Team
**最後更新**: 2025-09-30