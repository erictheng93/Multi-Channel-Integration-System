# 硬編碼問題分析與優化報告

**生成日期**: 2025-12-31
**專案**: Multi-Channel Customer Support System
**分析範圍**: 完整代碼庫 (Backend + Frontend)

---

## 📋 執行摘要

本報告系統性地檢測了整個專案中的硬編碼問題，發現以下主要問題類別：

| 類別 | 發現數量 | 優先級 | 狀態 |
|------|---------|--------|------|
| 硬編碼 URLs 和 API 端點 | 80+ | 🔴 高 | 需優化 |
| 魔術數字和限制值 | 75+ | 🟡 中 | 部分已優化 |
| 配置值 (角色、狀態等) | 150+ | 🔴 高 | 需優化 |
| 錯誤訊息 | 60+ (後端) + 19+ (前端) | 🟢 低 | 可接受 |
| **總計** | **384+** | - | **60% 需優化** |

---

## 🔴 高優先級問題

### 1. 硬編碼 URLs 和 API 端點

#### 問題嚴重性
- **影響範圍**: 80+ 個硬編碼 URL
- **風險**: 環境切換困難、部署配置錯誤、安全性問題
- **維護成本**: 高 - 每次環境變更需修改多處

#### 詳細分類

##### A. 生產域名 (3個主要域名，24+ 引用位置)

**主要域名**: `https://multi-channel.imfinethankyouandyou.com`
- 出現位置: 24+ 個文件
- 影響模組: CORS、安全配置、API客戶端、WebSocket連接
- 關鍵文件:
  ```
  src/config/cors.ts:12
  src/config/security.ts:45
  frontend/src/api/base.ts:328
  frontend/src/services/websocketClient.ts:347
  ```

**次要域名**:
- `https://multi-channel-platform-frontend.pages.dev` (Cloudflare Pages)
- `https://mcp.imfinethankyouandyou.com` (MCP Frontend)

##### B. 開發環境 Localhost (12+ 配置)

**Frontend Development (Port 3000)**:
```
http://localhost:3000      - 10+ 引用
https://localhost:3000     - 6 引用
http://127.0.0.1:3000      - 4 引用
```

**Backend Development (Port 8787)**:
```
http://localhost:8787      - 15+ 引用
```

出現位置:
```typescript
// ❌ 硬編碼示例
src/config/cors.ts:17-24
frontend/vite.config.ts:16
frontend/vitest.setup.ts:15
```

##### C. 外部 API 端點 (30+ 個)

**LINE Messaging API** (14 個端點):
```
https://api.line.me/v2/bot/message/reply
https://api.line.me/v2/bot/message/push
https://api.line.me/v2/bot/message/multicast
https://api.line.me/v2/bot/profile/{userId}
... 等 10+ 個端點
```
位置: `src/utils/line.ts` (22-1046行)

**Facebook Graph API** (6 個端點):
```
https://graph.facebook.com/v18.0/me/messages
https://graph.facebook.com/v18.0/{pageId}
... 等
```
位置: `src/durable-objects/DelayedMessageScheduler.ts:1217`

**其他外部服務**:
- QR Code 生成: `https://api.qrserver.com/v1/create-qr-code/`
- Unicode Emoji: `https://unicode.org/Public/emoji/15.1/emoji-test.txt`
- Google Fonts: `https://fonts.googleapis.com/css2?family=...`
- LINE LIFF SDK: `https://static.line-scdn.net/liff/edge/2/sdk.js`

##### D. Cloudflare API 端點 (Web Installer)

```
https://dash.cloudflare.com/oauth2/auth
https://dash.cloudflare.com/oauth2/token
https://api.cloudflare.com/client/v4
https://api.resend.com/emails
```
位置: `web-installer/backend/src/routes/oauth.ts`

#### 📊 統計數據

| URL 類型 | 數量 | 影響文件數 |
|---------|------|-----------|
| 生產域名 | 3 | 24+ |
| 開發環境 | 4 | 18+ |
| LINE API | 14 | 8 |
| Facebook API | 6 | 5 |
| 外部服務 | 8+ | 10+ |
| Cloudflare API | 4 | 4 |
| **總計** | **39+** | **69+ 文件** |

---

### 2. 硬編碼配置值 (角色、狀態、類型)

#### A. 角色名稱 (Role Names)

**硬編碼值**: `'admin'`, `'agent'`, `'team'`
**出現次數**: 150+ 次
**影響文件**: 25+ 個

**後端關鍵位置**:
```typescript
// ❌ 硬編碼示例
src/db/schema.ts:23              // 資料庫 schema
src/enterprise/rbac.ts:80-232    // 40+ 次硬編碼
src/middleware/auth.ts           // 認證中間件
src/handlers/message.ts          // 訊息處理
src/utils/auth.ts:368,394,406    // 認證工具
```

**前端關鍵位置**:
```typescript
// ❌ 硬編碼示例
frontend/src/views/TeamManagement.vue:1082-1385  // 10+ 次
frontend/src/views/ActivityLog.vue:345
frontend/src/components/team/TeamMemberCard.vue:154,166
```

#### B. 訊息狀態值 (Message Status)

**硬編碼值**: `'pending'`, `'sent'`, `'delivered'`, `'failed'`
**出現次數**: 50+ 次
**影響文件**: 12+ 個

**關鍵位置**:
```typescript
// ❌ 硬編碼示例
src/utils/drizzle-converters.ts:73,232
src/handlers/attachment.ts:39
src/handlers/delayed-message-drizzle.ts:190,267,309,333,385...
```

#### C. 對話狀態值 (Conversation Status)

**硬編碼值**: `'active'`, `'closed'`, `'pending'`, `'in-progress'`
**出現次數**: 40+ 次
**影響文件**: 10+ 個

**關鍵位置**:
```typescript
// ❌ 硬編碼示例
src/handlers/conversation.ts:255,271,303,1098,1173
src/utils/team.ts:321
src/handlers/customer.ts:29,109,259
```

#### D. 發送者類型 (Sender Types)

**硬編碼值**: `'customer'`, `'agent'`, `'system'`
**出現次數**: 30+ 次
**影響文件**: 8+ 個

**關鍵位置**:
```typescript
// ❌ 硬編碼示例
src/db/schema.ts:132
src/durable-objects/CustomerMessageDO.ts:20
src/utils/drizzle-converters.ts:68
```

#### E. 平台名稱 (Platform Names)

**硬編碼值**: `'LINE'`, `'FACEBOOK'`, `'SYSTEM'`, `'ADMIN'`
**出現次數**: 20+ 次

**關鍵位置**:
```typescript
// ❌ 硬編碼示例
src/modules/file-management/constants/file-config.ts:116-152
```

#### 📊 配置值統計

| 配置類型 | 獨特值數量 | 總出現次數 | 影響文件數 |
|---------|-----------|-----------|-----------|
| 角色名稱 | 3 | 150+ | 25+ |
| 訊息狀態 | 4 | 50+ | 12+ |
| 對話狀態 | 4 | 40+ | 10+ |
| 發送者類型 | 3 | 30+ | 8+ |
| 平台名稱 | 4 | 20+ | 5+ |
| **總計** | **18** | **290+** | **60+ 文件** |

---

## 🟡 中優先級問題

### 3. 魔術數字和硬編碼限制值

#### 已優化的部分 ✅

以下配置已經良好集中化：

**A. KV 配置** - `src/config/kv-config.ts`
```typescript
✅ TTL 值: 24 個已配置 (SESSION, MESSAGE_PENDING, CACHE_*)
✅ 批次操作: 5 個已配置 (MAX_BATCH_SIZE, MAX_PARALLEL_OPS...)
✅ 壓縮設定: 3 個已配置
```

**B. 文件配置** - `src/modules/file-management/constants/file-config.ts`
```typescript
✅ 文件大小限制: 7 個已配置 (10MB, 5MB, 20MB...)
✅ 處理選項: 4 個已配置 (縮圖尺寸, 質量...)
✅ 上傳限制: 5 個已配置 (20/min, 100/hour, 100MB/hour)
```

**C. CORS 配置** - `src/config/cors.ts`
```typescript
✅ ALLOWED_ORIGINS 列表
✅ CORS_HEADERS 配置
✅ 輔助函數
```

**D. 功能開關** - `frontend/src/config/features.ts`
```typescript
✅ QR_BACKGROUND_PRELOAD 與推出百分比
✅ 網路條件控制
✅ 優先級權重配置
```

#### 仍需優化的部分 ⚠️

**A. 超時值分散** (8+ 個位置)
```typescript
// ❌ 分散在多個文件
frontend/src/services/globalWebSocket.ts:17    // retryDelay = 5000
frontend/src/stores/notifications.ts:98        // setTimeout(..., 5000)
frontend/src/composables/usePerformanceMonitor.ts:204  // setInterval(..., 5000)
frontend/src/composables/useMessageDebounce.ts:51      // delay = 500
```

**B. 效能閾值** (5+ 個位置)
```typescript
// ❌ 硬編碼在組件中
frontend/src/composables/usePerformanceMonitor.ts:161  // delta > 33.33
frontend/src/composables/usePerformanceMonitor.ts:314  // metrics.value.lcp > 2500
frontend/src/composables/usePerformanceMonitor.ts:318  // metrics.value.fid > 100
```

**C. 分頁限制** (4+ 個位置)
```typescript
// ❌ 分散在 handlers
src/handlers/message.ts:30                    // pageSize = 50
frontend/src/stores/notifications.ts:35       // pageSize: 20
frontend/src/api/notifications.ts:170         // limit = 10
```

**D. LINE API 限制** (5+ 個位置)
```typescript
// ❌ 硬編碼在 line.ts
src/utils/line.ts:151    // messages.length > 5
src/utils/line.ts:167    // BATCH_SIZE = 500
src/utils/line.ts:735    // maxLength = 30
```

#### 📊 魔術數字統計

| 類別 | 已優化 ✅ | 需優化 ⚠️ | 總計 |
|------|----------|----------|------|
| Timeout/Delay | 0 | 8 | 8 |
| 文件大小限制 | 7 | 0 | 7 |
| 分頁限制 | 0 | 4 | 4 |
| KV TTL | 24 | 0 | 24 |
| 批次操作 | 5 | 0 | 5 |
| 壓縮設定 | 3 | 0 | 3 |
| 上傳限制 | 5 | 0 | 5 |
| 快取配置 | 4 | 0 | 4 |
| 效能閾值 | 0 | 5 | 5 |
| API 限制 | 0 | 5 | 5 |
| **總計** | **48 (64%)** | **22 (36%)** | **70** |

---

## 🟢 低優先級問題

### 4. HTTP 狀態碼

**狀態**: 可接受 - 標準 HTTP 狀態碼通常直接使用

**出現位置**: 30+ 個文件
```typescript
// 當前實踐 (可接受)
return c.json({ error: 'Unauthorized' }, 401)
return c.json({ success: true }, 200)
```

**可選優化**: 如果追求極致一致性，可以創建常量

### 5. 錯誤訊息

**狀態**: 可接受 - 錯誤訊息通常需要具體的上下文

**發現數量**:
- 後端: 60+ 個文件使用 `throw new Error("...")`
- 前端: 19+ 個文件使用 `throw new Error("...")`

**當前實踐**:
```typescript
// 上下文特定的錯誤訊息 (可接受)
throw new Error(`User ${userId} not found`)
throw new Error('Invalid conversation ID')
```

**可選優化**: 對於常見錯誤訊息，可以考慮創建錯誤字典

---

## ✅ 已優化良好的部分

### 1. KV 配置系統
- **文件**: `src/config/kv-config.ts`
- **覆蓋範圍**: 完整的 KV 命名空間、TTL、批次操作配置
- **評分**: ⭐⭐⭐⭐⭐ (5/5)

### 2. 文件管理配置
- **文件**: `src/modules/file-management/constants/file-config.ts`
- **覆蓋範圍**: 文件大小、類型、上傳限制、處理選項
- **評分**: ⭐⭐⭐⭐⭐ (5/5)

### 3. CORS 配置
- **文件**: `src/config/cors.ts`
- **覆蓋範圍**: 允許來源、標頭、輔助函數
- **評分**: ⭐⭐⭐⭐⭐ (5/5)

### 4. 安全配置
- **文件**: `src/config/security.ts`
- **覆蓋範圍**: CSP、安全標頭、信任來源
- **評分**: ⭐⭐⭐⭐☆ (4/5)

### 5. 功能開關
- **文件**: `frontend/src/config/features.ts`
- **覆蓋範圍**: 功能標誌、推出百分比、優先級
- **評分**: ⭐⭐⭐⭐⭐ (5/5)

---

## 🎯 優化建議

### 優先級 1: 立即執行

#### 1.1 建立常量定義文件

**創建以下新文件**:

```typescript
// src/constants/roles.ts
export const ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent',
  TEAM: 'team'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];
```

```typescript
// src/constants/message-status.ts
export const MESSAGE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed'
} as const;

export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];
```

```typescript
// src/constants/conversation-status.ts
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress'
} as const;

export type ConversationStatus = typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS];
```

```typescript
// src/constants/sender-types.ts
export const SENDER_TYPES = {
  CUSTOMER: 'customer',
  AGENT: 'agent',
  SYSTEM: 'system'
} as const;

export type SenderType = typeof SENDER_TYPES[keyof typeof SENDER_TYPES];
```

```typescript
// src/constants/platforms.ts
export const PLATFORMS = {
  LINE: 'LINE',
  FACEBOOK: 'FACEBOOK',
  SYSTEM: 'SYSTEM',
  ADMIN: 'ADMIN'
} as const;

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS];
```

#### 1.2 環境配置整合

**創建統一的環境配置**:

```typescript
// src/config/environment.ts
export const ENV_CONFIG = {
  development: {
    frontend: {
      url: process.env.DEV_FRONTEND_URL || 'http://localhost:3000',
      port: 3000
    },
    backend: {
      url: process.env.DEV_BACKEND_URL || 'http://localhost:8787',
      port: 8787
    }
  },
  production: {
    frontend: {
      url: process.env.PROD_FRONTEND_URL || 'https://multi-channel.imfinethankyouandyou.com'
    },
    backend: {
      url: process.env.PROD_BACKEND_URL || 'https://multi-channel.imfinethankyouandyou.com'
    }
  }
};

export const getCurrentEnv = () => {
  return process.env.NODE_ENV === 'production' ? ENV_CONFIG.production : ENV_CONFIG.development;
};
```

#### 1.3 外部 API 配置集中化

```typescript
// src/config/external-apis.ts
export const EXTERNAL_APIS = {
  LINE: {
    baseUrl: 'https://api.line.me/v2/bot',
    endpoints: {
      reply: '/message/reply',
      push: '/message/push',
      multicast: '/message/multicast',
      broadcast: '/message/broadcast',
      quota: '/message/quota',
      quotaConsumption: '/message/quota/consumption',
      profile: '/profile/{userId}',
      groupMember: '/group/{groupId}/member/{userId}',
      info: '/info',
      webhook: '/channel/webhook/endpoint'
    }
  },
  FACEBOOK: {
    baseUrl: 'https://graph.facebook.com/v18.0',
    endpoints: {
      sendMessage: '/me/messages',
      userInfo: '/{userId}',
      pageInfo: '/{pageId}',
      tokenRefresh: '/oauth/access_token'
    }
  },
  QR_CODE: {
    baseUrl: 'https://api.qrserver.com/v1',
    endpoints: {
      create: '/create-qr-code/'
    }
  },
  CLOUDFLARE: {
    dashboardUrl: 'https://dash.cloudflare.com',
    apiUrl: 'https://api.cloudflare.com/client/v4'
  }
};
```

### 優先級 2: 短期執行 (1-2週)

#### 2.1 集中化超時配置

```typescript
// src/config/timeouts.ts
export const TIMEOUTS = {
  WEBSOCKET: {
    RETRY_DELAY: 5000,
    RECONNECT_DELAY: 1000,
    INIT_DELAY: 500
  },
  NOTIFICATION: {
    ERROR_DISPLAY_DURATION: 5000,
    POLLING_INTERVAL: 30000
  },
  PERFORMANCE: {
    MEMORY_MONITOR_INTERVAL: 5000,
    TTI_MEASUREMENT: 0
  },
  DEBOUNCE: {
    MESSAGE_SEND: 500
  }
} as const;
```

#### 2.2 集中化分頁配置

```typescript
// src/config/pagination.ts
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  NOTIFICATIONS_PAGE_SIZE: 20,
  RECENT_NOTIFICATIONS_LIMIT: 10,
  MAX_PAGE_SIZE: 100
} as const;
```

#### 2.3 集中化效能閾值

```typescript
// src/config/performance-thresholds.ts
export const PERFORMANCE_THRESHOLDS = {
  FPS: {
    FRAME_DROP_MS: 33.33,  // ~30 FPS
    MEASUREMENT_WINDOW_MS: 1000,
    MIN_ACCEPTABLE_FPS: 50
  },
  CORE_WEB_VITALS: {
    LCP_MS: 2500,
    FID_MS: 100,
    CLS: 0.1
  },
  MEMORY: {
    WARNING_PERCENT: 70
  }
} as const;
```

### 優先級 3: 中期執行 (1-2個月)

#### 3.1 大規模重構 - 替換硬編碼

**影響最大的文件需要重構**:

1. **`src/enterprise/rbac.ts`** (40+ 個硬編碼角色引用)
   - 替換為 `ROLES` 常量
   - 預計影響: 40+ 行程式碼

2. **`src/handlers/conversation.ts`** (15+ 個硬編碼狀態值)
   - 替換為 `CONVERSATION_STATUS` 常量
   - 預計影響: 15+ 行程式碼

3. **`frontend/src/views/TeamManagement.vue`** (10+ 個硬編碼角色檢查)
   - 替換為前端角色常量
   - 預計影響: 10+ 行程式碼

4. **`src/handlers/delayed-message-drizzle.ts`** (12+ 個硬編碼狀態值)
   - 替換為 `MESSAGE_STATUS` 常量
   - 預計影響: 12+ 行程式碼

#### 3.2 建立遷移指南

創建 `docs/guides/HARDCODE_MIGRATION_GUIDE.md` 包含:
- 步驟指引
- 範例程式碼
- 測試策略
- 回滾計劃

---

## 📈 優化效益評估

### 量化指標

| 指標 | 優化前 | 優化後 | 改善 |
|------|--------|--------|------|
| 硬編碼配置值 | 290+ | 0 | 100% |
| 需修改文件數 (環境切換) | 69+ | 3 | 95.7% |
| 維護複雜度 | 高 | 低 | - |
| 配置錯誤風險 | 高 | 低 | - |
| 測試覆蓋率 | 部分 | 完整 | - |

### 質化效益

#### 開發效率
- ✅ 新開發者可以快速找到配置位置
- ✅ 減少配置相關的 bug
- ✅ 提高代碼可讀性

#### 維護性
- ✅ 環境切換只需修改 3 個配置文件
- ✅ 統一的配置管理
- ✅ 更容易進行配置驗證

#### 可擴展性
- ✅ 添加新環境更容易
- ✅ 支持更多外部平台
- ✅ 功能開關更靈活

---

## 🛠️ 實施計劃

### 階段 1: 基礎設施 (Week 1-2)

- [ ] 創建所有常量定義文件
- [ ] 創建統一的環境配置
- [ ] 創建外部 API 配置
- [ ] 建立單元測試

**預計工時**: 16 小時
**風險**: 低

### 階段 2: 批量替換 (Week 3-4)

- [ ] 後端角色常量替換 (25+ 文件)
- [ ] 後端狀態常量替換 (20+ 文件)
- [ ] 前端常量替換 (15+ 文件)
- [ ] 更新所有測試

**預計工時**: 32 小時
**風險**: 中

### 階段 3: 驗證與優化 (Week 5-6)

- [ ] 完整回歸測試
- [ ] 效能測試
- [ ] 文檔更新
- [ ] Code Review

**預計工時**: 16 小時
**風險**: 低

### 總計

- **總工時**: 64 小時 (約 8 個工作日)
- **總風險**: 中低
- **預期完成**: 6 週

---

## 📝 檢查清單

### 優先級 1 (必須執行)

- [ ] 創建 `src/constants/roles.ts`
- [ ] 創建 `src/constants/message-status.ts`
- [ ] 創建 `src/constants/conversation-status.ts`
- [ ] 創建 `src/constants/sender-types.ts`
- [ ] 創建 `src/constants/platforms.ts`
- [ ] 創建 `src/config/environment.ts`
- [ ] 創建 `src/config/external-apis.ts`
- [ ] 更新 `src/enterprise/rbac.ts` (40+ 引用)
- [ ] 更新 `frontend/src/views/TeamManagement.vue` (10+ 引用)
- [ ] 創建前端對應常量文件

### 優先級 2 (建議執行)

- [ ] 創建 `src/config/timeouts.ts`
- [ ] 創建 `src/config/pagination.ts`
- [ ] 創建 `src/config/performance-thresholds.ts`
- [ ] 創建 `src/config/line-api-limits.ts`
- [ ] 更新所有使用硬編碼超時的文件 (8+ 個)
- [ ] 更新所有使用硬編碼分頁的文件 (4+ 個)

### 優先級 3 (可選執行)

- [ ] 創建 `src/constants/http-status.ts`
- [ ] 創建錯誤訊息字典 (如需要)
- [ ] 建立配置驗證系統
- [ ] 建立配置文檔生成器

---

## 🎓 最佳實踐建議

### 1. 配置管理原則

```typescript
// ✅ 好的實踐
import { ROLES } from '@/constants/roles';
if (user.role === ROLES.ADMIN) { ... }

// ❌ 避免的實踐
if (user.role === 'admin') { ... }
```

### 2. 環境配置原則

```typescript
// ✅ 好的實踐
import { getCurrentEnv } from '@/config/environment';
const apiUrl = getCurrentEnv().backend.url;

// ❌ 避免的實踐
const apiUrl = 'http://localhost:8787';
```

### 3. 類型安全原則

```typescript
// ✅ 好的實踐 - 使用 const assertion 和類型推導
export const ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ❌ 避免的實踐 - 純字符串
export type Role = 'admin' | 'agent';
```

### 4. 配置文件組織

```
src/
├── constants/          # 業務常量 (角色、狀態等)
│   ├── roles.ts
│   ├── message-status.ts
│   └── ...
├── config/            # 系統配置
│   ├── environment.ts
│   ├── external-apis.ts
│   ├── kv-config.ts
│   └── ...
└── modules/
    └── [module]/
        └── constants/  # 模組特定常量
```

---

## 📚 參考資源

### 相關文檔
- `CLAUDE.md` - 專案總體文檔
- `docs/CORS_CONFIGURATION_GUIDE.md` - CORS 配置範例
- `src/config/kv-config.ts` - KV 配置範例
- `src/modules/file-management/constants/file-config.ts` - 文件配置範例

### 外部參考
- [TypeScript const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)
- [12-Factor App Config](https://12factor.net/config)
- [Environment Variables Best Practices](https://blog.bitsrc.io/a-gentle-introduction-to-environment-variables-9ad4fcca5c)

---

## 📊 附錄: 完整統計表

### A. 硬編碼問題分布

| 問題類型 | 後端 | 前端 | Web Installer | 總計 |
|---------|------|------|---------------|------|
| URLs/Endpoints | 45+ | 20+ | 4 | 69+ |
| 配置值 | 180+ | 110+ | - | 290+ |
| 魔術數字 | 40+ | 30+ | - | 70+ |
| 錯誤訊息 | 60+ | 19+ | - | 79+ |
| **總計** | **325+** | **179+** | **4** | **508+** |

### B. 文件影響範圍

| 模組 | 需修改文件數 | 預計工時 |
|------|-------------|---------|
| 認證與授權 | 15+ | 8h |
| 對話管理 | 12+ | 6h |
| 訊息處理 | 18+ | 10h |
| 團隊管理 | 10+ | 5h |
| 前端視圖 | 15+ | 8h |
| 配置文件 | 8+ | 4h |
| 測試文件 | 20+ | 10h |
| **總計** | **98+ 文件** | **51 小時** |

---

**報告結束**

*如需更詳細的實施指導或特定問題的解決方案，請參考本報告的相關章節或聯繫開發團隊。*
