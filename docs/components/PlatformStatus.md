# PlatformStatus 平台狀態組件

一個功能完整的 Vue 3 組件，用於顯示和管理平台整合狀態（LINE、Facebook Messenger 等），具備即時監控功能。

## 概述

PlatformStatus 組件提供統一的介面來監控平台連線、顯示指標、管理 webhook 狀態，以及執行平台特定操作。

## 最新變更 (v2.1.0)

### 介面更新
組件的屬性介面已更新，提供更清晰、更具描述性的資料結構：

#### 指標介面變更
**之前:**
```typescript
interface PlatformMetrics {
  messagesReceived: number;
  messagesSent: number;
  activeUsers: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
}
```

**之後:**
```typescript
interface PlatformMetrics {
  messagesCount?: number;        // 今日總訊息數
  activeConversations?: number;  // 目前活躍對話數
  averageResponseTime?: number;  // 平均回應時間（毫秒）
  successRate?: number;          // 成功率 (0-1)
}
```

#### Webhook 狀態介面變更
**之前:**
```typescript
interface WebhookStatus {
  isHealthy: boolean;
  lastPing: Date | null;
  responseTime: number;
  errorCount: number;
}
```

**之後:**
```typescript
interface WebhookStatus {
  endpoint: string;              // Webhook 端點 URL
  isActive: boolean;             // Webhook 是否啟用
  lastVerified?: Date;           // 最後驗證時間戳
  lastError?: string;            // 最後錯誤訊息（如有）
}
```

### 變更的好處
1. **更清晰的命名**: 更具描述性的屬性名稱，更好地反映其用途
2. **可選屬性**: 所有指標屬性現在都是可選的，提供更好的靈活性
3. **更好的錯誤處理**: Webhook 狀態現在包含特定的錯誤訊息
4. **簡化結構**: 在保持功能的同時降低複雜性

## 屬性 (Props)

| 屬性 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `platform` | `'line' \| 'facebook'` | 必需 | 平台類型 |
| `status` | `'connected' \| 'disconnected' \| 'error' \| 'connecting'` | 必需 | 連線狀態 |
| `showMetrics` | `boolean` | `true` | 是否顯示指標區段 |
| `showHistory` | `boolean` | `false` | 是否顯示連線歷史 |
| `showSettings` | `boolean` | `true` | 是否顯示設定按鈕 |
| `metrics` | `PlatformMetrics` | 預設空指標 | 平台指標資料 |
| `webhookStatus` | `WebhookStatus` | 預設空狀態 | Webhook 狀態資訊 |

## 事件 (Events)

| 事件 | 載荷 | 說明 |
|------|------|------|
| `connect` | `void` | 點擊連線按鈕時觸發 |
| `disconnect` | `void` | 觸發斷線操作時觸發 |
| `test` | `void` | 點擊測試連線按鈕時觸發 |
| `refresh` | `void` | 點擊重新整理狀態按鈕時觸發 |
| `settings` | `void` | 點擊設定按鈕時觸發 |
| `status-change` | `string` | 程式化變更狀態時觸發 |

## 使用範例

### 基本用法
```vue
<template>
  <PlatformStatus
    platform="line"
    status="connected"
    @connect="handleConnect"
    @test="handleTest"
    @settings="openSettings"
  />
</template>
```

### 帶指標
```vue
<template>
  <PlatformStatus
    platform="line"
    status="connected"
    :show-metrics="true"
    :metrics="{
      messagesCount: 150,
      activeConversations: 12,
      averageResponseTime: 2500,
      successRate: 0.95
    }"
  />
</template>
```

### 帶 Webhook 狀態
```vue
<template>
  <PlatformStatus
    platform="line"
    status="connected"
    :webhook-status="{
      endpoint: 'https://api.example.com/webhook',
      isActive: true,
      lastVerified: new Date(),
      lastError: undefined
    }"
  />
</template>
```

### 帶連線歷史
```vue
<template>
  <PlatformStatus
    platform="line"
    status="connected"
    :show-history="true"
    @refresh="handleRefresh"
  />
</template>
```

## 功能特色

### 狀態指示器
- **已連線**: 綠色指示器，顯示「已連接」文字
- **未連線**: 灰色指示器，顯示「未連接」文字
- **連線中**: 藍色指示器，顯示「連接中...」文字
- **錯誤**: 紅色指示器，顯示「連接錯誤」文字

### 平台支援
- **LINE**: 綠色主題，LINE 品牌色彩
- **Facebook**: 藍色主題，Facebook 品牌色彩

### 指標顯示
- **訊息數量**: 今日處理的總訊息數
- **活躍對話**: 目前活躍的對話數
- **回應時間**: 平均回應時間，智慧格式化（ms/s）
- **成功率**: 成功率百分比

### 操作按鈕
- **連線**: 狀態為未連線或錯誤時可用
- **測試連線**: 已連線時可用
- **重新整理狀態**: 已連線時可用
- **設定**: 可設定可見性

### Webhook 管理
- **狀態顯示**: 顯示 webhook 端點和狀態
- **驗證**: 手動 webhook 驗證
- **錯誤顯示**: 顯示最後錯誤（如有）
- **時間戳**: 最後驗證時間

### 連線歷史
- **活動記錄**: 顯示最近的連線活動
- **狀態圖示**: 成功/失敗的視覺指示器
- **時間戳**: 活動發生時間
- **錯誤詳情**: 特定錯誤訊息

## 樣式設定

組件使用 CSS 自訂屬性進行主題設定：

```css
.platform-status {
  --primary-color: #3b82f6;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  --gray-color: #6b7280;
}
```

### 平台特定顏色
- **LINE**: `#00C300` (LINE 綠)
- **Facebook**: `#1877F2` (Facebook 藍)

## 無障礙設計

- **ARIA 標籤**: 螢幕閱讀器的適當標籤
- **鍵盤導航**: 完整的鍵盤支援
- **色彩對比**: 符合 WCAG 的色彩組合
- **焦點管理**: 清晰的焦點指示器

## 測試

組件包含完整的測試覆蓋：

- **40 個測試案例**涵蓋所有功能
- **100% 分支覆蓋**關鍵路徑
- **整合測試**事件觸發
- **無障礙測試**ARIA 合規性

### 執行測試
```bash
npm run test:run -- src/components/platform/PlatformStatus.test.ts
```

## 遷移指南

如果您正在從舊版本升級，請更新您的指標和 webhook 狀態物件：

### 指標遷移
```typescript
// 舊格式
const oldMetrics = {
  messagesReceived: 100,
  messagesSent: 50,
  activeUsers: 25,
  responseTime: 1500,
  errorRate: 0.05,
  uptime: 0.99
}

// 新格式
const newMetrics = {
  messagesCount: oldMetrics.messagesReceived + oldMetrics.messagesSent,
  activeConversations: oldMetrics.activeUsers,
  averageResponseTime: oldMetrics.responseTime,
  successRate: 1 - oldMetrics.errorRate
}
```

### Webhook 狀態遷移
```typescript
// 舊格式
const oldWebhookStatus = {
  isHealthy: true,
  lastPing: new Date(),
  responseTime: 200,
  errorCount: 0
}

// 新格式
const newWebhookStatus = {
  endpoint: 'https://api.example.com/webhook',
  isActive: oldWebhookStatus.isHealthy,
  lastVerified: oldWebhookStatus.lastPing,
  lastError: oldWebhookStatus.errorCount > 0 ? '某些錯誤' : undefined
}
```

## 效能考量

- **自動重新整理**: 已連線平台的 30 秒間隔
- **延遲載入**: 只有在 `showHistory` 為 true 時才載入歷史
- **防抖操作**: 按鈕操作採用防抖處理以防止濫用
- **記憶體管理**: 卸載時自動清理間隔

## 瀏覽器支援

- **現代瀏覽器**: Chrome 90+、Firefox 88+、Safari 14+
- **行動裝置**: iOS Safari 14+、Chrome Mobile 90+
- **無障礙**: 螢幕閱讀器和鍵盤導航

---

*最後更新：2025年1月8日*  
*組件版本：2.1.0*  
*測試覆蓋：40/40 測試通過*