# 系統需求規格書 (SRS)
## 多通路客服支援系統

**文件版本：** 1.0  
**日期：** 2025年8月25日  
**準備單位：** 多通路整合系統  
**撰寫團隊：** 系統開發團隊  

---

## 1. 簡介

### 1.1 目的
本系統需求規格書(SRS)文件定義了多通路客服支援系統的技術系統需求、架構和實施規格。它作為系統實施、部署和維護的權威技術參考。

### 1.2 範圍
SRS涵蓋系統的所有技術面向，包括：
- 系統架構和技術堆疊
- 基礎架構和部署需求
- 資料庫設計和資料管理
- 安全架構和實施
- 效能和可擴展性需求
- 整合規格
- 開發和營運環境

### 1.3 目標受眾
- **系統架構師**：技術架構和設計決策
- **開發團隊**：實施規格和編碼標準
- **DevOps工程師**：部署和基礎架構需求
- **資料庫管理員**：資料架構和管理
- **安全工程師**：安全實施和合規
- **營運團隊**：系統監控和維護

---

## 2. 系統架構概述

### 2.1 高層架構

#### 2.1.1 無伺服器邊緣運算架構
系統實施現代無伺服器架構，利用Cloudflare邊緣運算平台：

```
┌─────────────────────────────────────────────────────────────┐
│                    全球邊緣網路                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Vue 3 SPA     │  Cloudflare     │    外部APIs             │
│   前端          │  Workers        │   (LINE, Facebook)      │
│                 │  運行時         │                         │
├─────────────────┼─────────────────┼─────────────────────────┤
│  靜態資源       │  邊緣函數       │   Webhook端點           │
│  (Pages)        │  (Hono.js)      │   (平台事件)            │
├─────────────────┼─────────────────┼─────────────────────────┤
│                 │  資料層         │                         │
│                 ├─────────────────┤                         │
│                 │ D1 (SQLite)     │                         │
│                 │ KV (Sessions)   │                         │
│                 │ R2 (Files)      │                         │
│                 │ Queues (Async)  │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

#### 2.1.2 技術堆疊摘要
- **運行時**：Cloudflare Workers (V8 Isolates)
- **後端框架**：Hono.js (TypeScript)
- **前端框架**：Vue 3 + TypeScript
- **資料庫**：Cloudflare D1 (SQLite) + Drizzle ORM
- **會話管理**：Cloudflare KV
- **檔案儲存**：Cloudflare R2
- **訊息佇列**：Cloudflare Queues
- **建置工具**：Vite (前端), TypeScript編譯器 (後端)
- **測試**：Vitest (132個測試，100%覆蓋率)

### 2.2 系統組件

#### 2.2.1 前端應用程式 (Vue 3 SPA)
**位置**：`/frontend/`
**入口點**：`src/main.ts`
**建置輸出**：部署到Cloudflare Pages的靜態資源

**主要組件**：
- **Vue 3 Composition API**：現代響應式框架
- **Pinia狀態管理**：集中化應用程式狀態
- **Vue Router 4**：具有守衛的客戶端路由
- **TypeScript**：嚴格模式的類型安全開發
- **Vite建置系統**：具有HMR的現代建置工具

**配置檔案**：
- `vite.config.ts`：建置和開發配置
- `vitest.config.ts`：測試框架配置
- `tsconfig.json`：TypeScript編譯器設定

#### 2.2.2 後端Worker應用程式
**位置**：`/src/`
**入口點**：`src/index.ts`
**運行時**：Cloudflare Workers (邊緣運算)

**核心結構**：
```
src/
├── index.ts                 # 主入口點和請求路由器
├── handlers/                # 請求處理器(模組化架構)
│   ├── auth-main.ts        # 認證和授權
│   ├── conversation-main.ts # 對話管理
│   ├── delayed-message-main.ts # 延遲訊息系統
│   ├── team-main.ts        # 團隊和成員管理
│   ├── system-main.ts      # 系統配置和健康
│   └── customer-main.ts    # 客戶資料管理
├── middleware/             # 請求中介軟體
│   ├── auth.ts            # JWT認證中介軟體
│   └── database.ts        # 資料庫連接中介軟體
├── services/              # 業務邏輯服務
│   ├── permission-service.ts # 角色權限控制
│   ├── activity-service.ts   # 活動記錄和審計
│   └── message-recall-service.ts # 延遲訊息管理
├── utils/                 # 實用函數
│   ├── auth.ts           # 認證實用工具
│   ├── database.ts       # 資料庫助手
│   └── performance.ts    # 效能優化
└── types/                # TypeScript類型定義
    ├── bindings.ts       # Cloudflare綁定
    ├── database.ts       # 資料庫實體類型
    └── handlers.ts       # 處理器介面類型
```

#### 2.2.3 資料庫層 (Drizzle ORM + D1)
**ORM**：Drizzle ORM用於類型安全資料庫操作
**資料庫**：Cloudflare D1 (基於SQLite的全球資料庫)
**模式位置**：`src/db/schema.ts`

**主要功能**：
- 類型安全資料庫查詢
- 自動遷移產生
- 模式版本控制和演進
- 透過Cloudflare邊緣的全球資料分發

---

## 3. 基礎架構需求

### 3.1 Cloudflare平台依賴

#### 3.1.1 Cloudflare Workers運行時
**需求**：
- 相容性日期：`2025-07-31`
- 相容性標誌：`["nodejs_compat"]`
- 運行時限制：
  - CPU時間：每請求50ms (免費版) / 15分鐘 (付費版)
  - 記憶體：每請求128MB
  - 請求大小：100MB

**配置**：`wrangler.toml`
```toml
name = "multi-channel-platform"
main = "src/index.ts"
compatibility_date = "2025-07-31"
compatibility_flags = ["nodejs_compat"]
```

#### 3.1.2 Cloudflare D1資料庫
**資料庫需求**：
- **開發資料庫**：`multi-channel-platform-dev`
- **生產資料庫**：`multi-channel-platform`
- **儲存限制**：500MB (免費) / 10GB+ (付費)
- **查詢限制**：100,000/天 (免費) / 無限制 (付費)

**配置**：
```toml
[[d1_databases]]
binding = "DB"
database_name = "multi-channel-platform-dev"
database_id = "3b7339f0-80de-49dc-b079-312df4a4c316"
```

#### 3.1.3 Cloudflare KV儲存
**命名空間需求**：
- **SESSIONS**：使用者會話管理
- **CACHE**：應用程式快取層
- **儲存限制**：每命名空間1GB
- **操作限制**：1000/天 (免費) / 無限制 (付費)

**配置**：
```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "ace3f7202e6a4dd8b98c50e9b91b2431"
preview_id = "df901efdffa143638a02f6c6d2d6459f"

[[kv_namespaces]]
binding = "CACHE"
id = "f3bc7a55c8a14f4fb28b8321fa01dc73"
preview_id = "bafc060a634943b19409b7ecbb1b4f5b"
```

#### 3.1.4 Cloudflare R2儲存
**儲存桶需求**：
- **開發**：`multi-channel-platform-attachments-dev`
- **生產**：`multi-channel-platform-attachments-production`
- **儲存限制**：10GB (免費) / 無限制 (付費)
- **請求限制**：1,000,000/月 (免費)

**配置**：
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "multi-channel-platform-attachments-dev"
```

#### 3.1.5 Cloudflare Queues
**佇列需求**：
- **開發**：`message-queue-dev`
- **生產**：`message-queue`
- **訊息限制**：1,000,000/月 (免費)
- **批次處理**：每批次最多10個訊息，5秒逾時

**配置**：
```toml
[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue-dev"

[[queues.consumers]]
queue = "message-queue-dev"
max_batch_size = 10
max_batch_timeout = 5
```

### 3.2 環境配置

#### 3.2.1 開發環境
**API端點**：`http://localhost:8787` (Wrangler開發伺服器)
**前端**：`http://localhost:3000` (Vite開發伺服器)
**資料庫**：具有遷移的本地D1資料庫
**檔案儲存**：開發R2儲存桶
**網域**：本地開發網域

**環境變數**：
```toml
[vars]
R2_PUBLIC_URL = "https://s3dev.imfinethankyouandyou.com"
ENCRYPTION_KEY = "dev-encryption-key-32-char-long"
```

#### 3.2.2 生產環境
**API端點**：`https://multi-channel.imfinethankyouandyou.com`
**前端**：Cloudflare Pages部署
**資料庫**：具有備份的生產D1資料庫
**檔案儲存**：具有自訂網域的生產R2儲存桶
**網域**：具有SSL/TLS的自訂網域

**環境變數**：
```toml
[env.production.vars]
ENVIRONMENT = "production"
R2_PUBLIC_URL = "https://s3.imfinethankyouandyou.com"
ENCRYPTION_KEY = "production-encryption-key-change-me"
```

**自訂網域配置**：
```toml
[[routes]]
pattern = "multi-channel.imfinethankyouandyou.com/*"
zone_name = "imfinethankyouandyou.com"
```

---

## 4. 資料庫設計和需求

### 4.1 資料庫模式架構

#### 4.1.1 核心實體關係
```sql
-- 使用者 (來自外部平台的客戶)
users ├── conversations (1:N)
      └── messages (1:N via conversations)

-- 企業3角色系統
teams ├── agents (1:N, for team/agent roles)
      ├── conversations (1:N, team assignment)
      └── invitations (1:N, team-specific invites)

-- 對話管理  
conversations ├── messages (1:N)
              ├── file_attachments (1:N via messages)
              ├── delayed_messages (1:N)
              └── agents (N:1, assignment)

-- 訊息處理
messages ├── file_attachments (1:N)
         └── delayed_messages (references for scheduling)
```

#### 4.1.2 資料表規格

**使用者資料表** (`users`)：
- 主鍵：`id` (TEXT)
- 平台整合：`platform_id`, `platform`
- 檔案資料：`display_name`, `avatar_url`, `email`, `phone`
- 可擴展性：`metadata` (平台特定資料的JSON字串)
- 時間戳記：`created_at`, `updated_at`

**團隊資料表** (`teams`)：
- 主鍵：`id` (INTEGER AUTOINCREMENT)
- 團隊資訊：`name`, `description`
- QR碼：`qr_code` (客戶存取用)
- 狀態：`is_active` (boolean)
- 時間戳記：`created_at`, `updated_at`

**客服資料表** (`agents`)：
- 主鍵：`id` (TEXT)
- 認證：`username`, `email`, `password_hash`
- 安全：`password_encrypted` (管理員存取的AES)
- 檔案：`display_name`, `role` (admin/team/agent)
- 團隊指派：`team_id` (teams的外鍵)
- 帳戶管理：`is_active`, `password_policy`
- 審計：`last_login_at`, `created_at`, `updated_at`

**對話資料表** (`conversations`)：
- 主鍵：`id` (TEXT)
- 關係：`user_id` (客戶), `agent_id` (指派)
- 平台：`platform` (LINE, Facebook等)
- 工作流程：`status` (pending/in-progress/closed)
- 後設資料：`title`, `last_message_at`
- 時間戳記：`created_at`, `updated_at`

**訊息資料表** (`messages`)：
- 主鍵：`id` (TEXT)
- 關係：`conversation_id`, `sender_id`
- 訊息資訊：`sender_type`, `message_type`, `content`
- 平台資料：`metadata`, `platform_message_id`, `reply_token`
- 狀態：`is_read`
- 時間戳記：`created_at`, `updated_at`

**檔案附件資料表** (`file_attachments`)：
- 主鍵：`id` (TEXT)
- 關係：`message_id`
- 檔案資訊：`file_name`, `file_type`, `file_size`
- 儲存：`r2_key` (R2儲存金鑰), `url` (公開URL)
- 時間戳記：`created_at`

**延遲訊息資料表** (`delayed_messages`)：
- 主鍵：`id` (TEXT)
- 關係：`conversation_id`, `agent_id`
- 訊息資料：`content`, `message_type`
- 排程：`scheduled_at`, `status` (pending/sent/failed/cancelled)
- 後設資料：`metadata` (平台特定資料)
- 時間戳記：`created_at`, `updated_at`

**邀請資料表** (`invitations`)：
- 主鍵：`id` (TEXT)
- 使用者資訊：`email`, `name`, `role`
- 團隊指派：`team_id` (角色指派用)
- 令牌管理：`token` (唯一), `expires_at`
- 審計：`invited_by`, `used_at`, `used_by`
- 時間戳記：`created_at`

#### 4.1.3 資料庫配置

**Drizzle ORM配置** (`drizzle.config.ts`)：
```typescript
export default {
  schema: "./src/db/schema.ts",
  driver: 'wrangler',
  out: "./drizzle",
  schemaFilter: ["public"],
  breakpoints: true,
  strict: true,
  verbose: true,
  dbCredentials: {
    databaseName: "multi-channel-platform"
  }
} satisfies Config;
```

**遷移管理**：
- **位置**：`drizzle/` 目錄
- **產生**：`npm run db:generate`
- **本地應用**：`npm run db:migrate`
- **生產應用**：`npm run db:migrate:prod`
- **模式工作室**：`npm run db:studio:local`

### 4.2 資料管理需求

#### 4.2.1 資料一致性和完整性
**外鍵約束**：
- 在資料庫級別強制執行所有關係
- 依賴資料的級聯刪除
- 插入前資料驗證

**事務管理**：
- Drizzle ORM自動事務處理
- 複雜操作的手動事務
- 失敗操作的回滾功能

**資料驗證**：
- 編譯時TypeScript類型檢查
- 使用者輸入的運行時驗證
- 資料完整性的資料庫約束

#### 4.2.2 效能優化
**索引策略**：
- 主鍵自動索引
- 聯接效能的外鍵索引
- 經常查詢欄位的自訂索引

**查詢優化**：
- 重複查詢的預備語句
- KV儲存中的查詢結果快取
- 大結果集的分頁

**連接管理**：
- Cloudflare D1處理連接池
- 自動連接重試邏輯
- 連接健康監控

#### 4.2.3 備份和恢復
**自動備份**：
- Cloudflare的每日自動備份
- 時間點恢復功能
- 跨區域備份複製

**手動備份程序**：
- 按需備份建立
- 模式和資料匯出功能
- 備份驗證和測試

**災難恢復**：
- 恢復時間目標(RTO)：< 4小時
- 恢復點目標(RPO)：< 24小時
- 自動恢復程序

---

## 5. 安全架構

### 5.1 認證和授權

#### 5.1.1 基於JWT的認證
**令牌管理**：
- **演算法**：HS256 (HMAC with SHA-256)
- **有效期**：8小時 (可配置)
- **聲明**：使用者ID、使用者名稱、角色、團隊ID
- **刷新邏輯**：活動時自動刷新

**實施**：`src/utils/auth.ts`
```typescript
interface JWTPayload {
  userId: string;
  username: string;
  role: 'admin' | 'team' | 'agent';
  teamId?: number;
  exp: number;
  iat: number;
}
```

**安全功能**：
- 安全密鑰管理
- 登出的令牌黑名單
- 認證端點速率限制
- 暴力破解保護

#### 5.1.2 角色權限控制 (RBAC)
**角色階層**：
```typescript
enum RoleLevel {
  AGENT = 1,
  TEAM = 2,
  ADMIN = 3
}
```

**權限矩陣**：
- **管理員 (第3級)**：完整系統存取 (`*:*`)
- **團隊 (第2級)**：團隊範圍管理權限
- **客服 (第1級)**：對話特定權限

**實施**：`src/services/permission-service.ts`
- 動態權限檢查
- 團隊資源過濾
- 操作級授權

#### 5.1.3 會話管理
**會話儲存**：Cloudflare KV (`SESSIONS` 命名空間)
**會話資料**：
```typescript
interface SessionData {
  agentId: string;
  username: string;
  role: string;
  loginAt: string;
  expiresAt: string;
}
```

**安全功能**：
- 會話逾時和清理
- 並發會話限制
- 安全事件時會話無效化
- 安全會話令牌

### 5.2 資料保護

#### 5.2.1 加密標準
**靜態資料**：
- 資料庫：Cloudflare D1內建加密
- 檔案儲存：Cloudflare R2加密
- 會話資料：KV儲存加密
- 密碼儲存：bcrypt雜湊 (成本因數12)

**傳輸中資料**：
- 所有通訊使用TLS 1.3
- 透過Cloudflare的證書管理
- HSTS (HTTP Strict Transport Security)
- 完全前向保密

**敏感資料處理**：
- 管理員存取的密碼加密 (AES-256)
- API金鑰和密鑰在環境變數中
- 分析用PII資料匿名化
- 安全金鑰輪換程序

#### 5.2.2 輸入驗證和清理
**伺服器端驗證**：
- 處理前驗證所有輸入
- 透過預備語句防止SQL注入
- 透過輸出編碼防止XSS
- 檔案上傳安全掃描

**客戶端驗證**：
- TypeScript類型檢查
- 使用Vue 3 composables的表單驗證
- 傳輸前輸入清理
- 內容安全政策 (CSP) 實施

#### 5.2.3 API安全
**速率限制**：
```typescript
// 認證端點：每分鐘10個請求
// API端點：每小時1000個請求
// 檔案上傳：每分鐘10個
```

**請求認證**：
- 受保護端點需要JWT令牌
- 令牌簽章驗證
- 過期令牌拒絕
- 無效令牌記錄

**回應安全**：
- 一致錯誤回應
- 資訊洩露防護
- 安全標頭實施
- 回應時間正常化

### 5.3 安全監控和事件回應

#### 5.3.1 安全事件監控
**安全事件類別**：
```typescript
enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHORIZATION_VIOLATION = 'authz_violation',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  SYSTEM_COMPROMISE = 'system_compromise',
  MALWARE_DETECTION = 'malware_detection'
}

interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  source: string;
  description: string;
  metadata: object;
  resolved: boolean;
}
```

**自動威脅偵測**：
- **暴力破解偵測**：5次失敗嘗試觸發臨時鎖定
- **異常偵測**：異常存取模式標記
- **速率限制**：API速率限制與漸進處罰
- **地理分析**：意外位置存取警報

#### 5.3.2 事件回應程序
**安全事件分類**：
```yaml
嚴重等級:
  關鍵 (P1):
    - 確認資料洩露
    - 系統妥協
    - 多個使用者帳戶妥協
    回應時間: 立即 (< 1小時)
    
  高 (P2):
    - 潛在資料洩露
    - 安全漏洞利用
    - 管理員帳戶妥協
    回應時間: < 4小時
    
  中 (P3):
    - 失敗認證模式
    - 可疑使用者行為
    - 輕微安全政策違規
    回應時間: < 24小時
    
  低 (P4):
    - 安全政策資訊警報
    - 使用者教育機會
    回應時間: < 72小時
```

**事件回應團隊**：
- **安全負責人**：整體事件協調
- **技術負責人**：系統分析和補救
- **溝通負責人**：利害關係人和客戶溝通
- **法律顧問**：法規合規和法律影響

#### 5.3.3 安全審計和合規
**定期安全審計**：
- **內部審計**：每月安全審查
- **外部審計**：年度第三方安全評估
- **滲透測試**：季度專業測試
- **漏洞掃描**：每週自動掃描

**安全指標和KPI**：
```typescript
interface SecurityMetrics {
  authenticationFailureRate: number; // < 1%
  unauthorizedAccessAttempts: number; // < 10/day
  securityIncidentCount: number; // < 5/month
  vulnerabilityMeanTimeToRemediation: number; // < 72 hours
  securityTrainingCompletion: number; // 100%
  patchingCompliance: number; // > 95%
}
```

---

## 6. 效能和可擴展性

### 6.1 效能需求

#### 6.1.1 回應時間目標
**API回應時間**：
- 認證：< 200ms (第95百分位數)
- 對話查詢：< 500ms (第95百分位數)
- 訊息操作：< 300ms (第95百分位數)
- 檔案上傳：10MB檔案 < 2s
- 資料庫查詢：< 100ms (平均)

**前端效能**：
- Time to Interactive (TTI)：< 3s
- Largest Contentful Paint (LCP)：< 2.5s
- First Input Delay (FID)：< 100ms
- Cumulative Layout Shift (CLS)：< 0.1

**實施策略**：
- 全球分發的邊緣運算
- 積極快取策略
- 程式碼分割和延遲載入
- 資料庫查詢優化

#### 6.1.2 吞吐量需求
**並發使用者**：
- 開發：50個同時使用者
- 生產：1000+個同時使用者
- 尖峰負載：2000+個同時使用者

**訊息處理**：
- 入站訊息：1000個訊息/分鐘
- 出站訊息：500個訊息/分鐘
- 延遲訊息：100個排程/分鐘
- 佇列處理：50個訊息/秒

**資料庫操作**：
- 讀取操作：10,000個查詢/分鐘
- 寫入操作：1,000個查詢/分鐘
- 複雜查詢：100個查詢/分鐘
- 並發連接：100+個同時

#### 6.1.3 資源利用率
**記憶體使用**：
- Worker記憶體：每請求 < 64MB (平均)
- 前端記憶體：每會話 < 100MB
- 資料庫連接：高效池化
- 快取利用率：80%+命中率

**CPU使用**：
- Worker CPU：每請求 < 10ms (平均)
- 資料庫CPU：< 50%利用率
- 佇列處理：每訊息 < 5ms
- 檔案處理：每檔案 < 100ms

### 6.2 可擴展性架構

#### 6.2.1 橫向擴展
**無伺服器架構優勢**：
- 基於需求自動擴展
- 零冷啟動優化
- 全球邊緣分發
- 按使用付費成本模型

**擴展觸發器**：
- 請求量增加
- 地理需求分發
- 資源利用率閾值
- 效能降級偵測

**擴展限制**：
- Cloudflare Workers：自動擴展
- 資料庫：D1自動擴展但有限制
- 儲存：R2無限制擴展
- 佇列：具有處理限制的自動擴展

#### 6.2.2 快取策略
**多層快取**：
```
瀏覽器快取 (24h)
    ↓
CDN快取 (7d)
    ↓  
KV快取 (1h)
    ↓
資料庫
```

**快取實施**：
- **靜態資源**：版本控制的CDN快取
- **API回應**：具有TTL的KV快取
- **資料庫查詢**：具有失效的結果快取
- **會話資料**：具有過期的KV儲存

**快取失效**：
- 基於時間的過期 (TTL)
- 基於事件的失效
- 手動快取清除
- Stale-while-revalidate策略

#### 6.2.3 資料庫擴展
**讀取擴展**：
- 透過Cloudflare D1的讀取副本
- 查詢結果快取
- 連接池
- 查詢優化

**寫入擴展**：
- 可能情況下批次操作
- 非同步處理
- 基於佇列的寫入
- 連接管理

**儲存擴展**：
- 自動儲存擴展
- 資料歸檔策略
- 檔案儲存優化
- 資料庫清理程序

### 6.3 監控和優化

#### 6.3.1 效能監控
**即時指標**：
- 請求回應時間
- 錯誤率和類型
- 資源利用率
- 使用者體驗指標

**監控工具**：
- Cloudflare Analytics
- 自訂效能指標
- 應用程式效能監控 (APM)
- 真實使用者監控 (RUM)

**警報閾值**：
- 回應時間 > 2s (警告)
- 錯誤率 > 1% (關鍵)
- CPU使用 > 80% (警告)
- 記憶體使用 > 90% (關鍵)

#### 6.3.2 效能優化
**前端優化**：
```typescript
// Vite優化配置
export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'pinia-vendor': ['pinia'],
          'conversation': ['./src/views/ConversationList.vue'],
          'dashboard': ['./src/views/Dashboard.vue']
        }
      }
    }
  }
});
```

**後端優化**：
- 資料庫查詢的預備語句
- 連接池和重用
- I/O操作的Async/await
- 記憶體高效資料處理

**資料庫優化**：
- 查詢的索引優化
- 查詢計畫分析
- 連接池
- 資料歸檔策略

---

## 7. 整合規格

### 7.1 外部平台整合

#### 7.1.1 LINE整合
**API規格**：
- **訊息API**：發送和接收訊息
- **Webhook API**：即時事件處理
- **使用者檔案API**：客戶資訊檢索
- **豐富內容API**：進階訊息格式

**技術實施**：
```typescript
// LINE webhook簽章驗證
const validateLineSignature = (
  body: string,
  signature: string,
  channelSecret: string
): boolean => {
  const hash = crypto.createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return signature === hash;
};
```

**速率限制和約束**：
- 推播訊息：1000/小時 (免費版)
- 回覆訊息：1分鐘內無限制
- Webhook回應：必須在3秒內回應
- 訊息大小：最多5000字元

**錯誤處理**：
- 失敗API呼叫的自動重試邏輯
- API失敗的斷路器模式
- 服務降級的備用機制
- 全面錯誤記錄和監控

#### 7.1.2 Facebook Messenger整合 (準備就緒)
**API規格**：
- **發送API**：向使用者傳送訊息
- **Webhook API**：處理傳入訊息
- **圖形API**：使用者檔案和頁面資訊
- **範本API**：結構化訊息格式

**技術準備**：
```typescript
// Facebook webhook驗證
const verifyFacebookWebhook = (
  mode: string,
  token: string,
  challenge: string
): string | null => {
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return challenge;
  }
  return null;
};
```

**合規要求**：
- Meta平台政策合規
- 資料使用和隱私要求
- 應用程式審查流程完成
- 企業驗證要求

#### 7.1.3 平台抽象層
**統一介面**：`src/integrations/platform-adapter.ts`
```typescript
interface PlatformAdapter {
  sendMessage(conversation: Conversation, message: Message): Promise<void>;
  validateWebhook(request: Request): boolean;
  processIncomingMessage(payload: any): Promise<Message>;
  getUserProfile(platformUserId: string): Promise<UserProfile>;
}
```

**平台特定實施**：
- 完整功能的LINE適配器
- 準備就緒基礎架構的Facebook適配器
- 未來平台的通用適配器介面
- 平台間功能對應

### 7.2 內部系統整合

#### 7.2.1 資料庫整合 (Drizzle ORM)
**配置**：`drizzle.config.ts`
```typescript
export default {
  schema: "./src/db/schema.ts",
  driver: 'wrangler',
  out: "./drizzle",
  dbCredentials: {
    databaseName: "multi-channel-platform"
  }
} satisfies Config;
```

**類型安全操作**：
```typescript
// 完整類型安全的範例查詢
const conversations = await db
  .select()
  .from(conversationsTable)
  .where(eq(conversationsTable.agentId, agentId))
  .orderBy(desc(conversationsTable.lastMessageAt));
```

**遷移管理**：
- 與git整合的模式版本控制
- 自動遷移產生
- 安全遷移回滾程序
- 生產部署協調

#### 7.2.2 佇列整合 (Cloudflare Queues)
**生產者配置**：
```typescript
// 佇列訊息排程
await env.MESSAGE_QUEUE.send({
  conversationId,
  messageContent,
  scheduledAt: Date.now() + delayMs
});
```

**消費者實施**：`src/queue-consumer.ts`
```typescript
export default {
  async queue(batch: MessageBatch, env: Bindings): Promise<void> {
    for (const message of batch.messages) {
      await processDelayedMessage(message.body, env);
      message.ack();
    }
  }
};
```

**錯誤處理**：
- 失敗訊息的死信佇列
- 指數退避的重試邏輯
- 訊息處理逾時處理
- 佇列深度監控

#### 7.2.3 檔案儲存整合 (Cloudflare R2)
**上傳實施**：
```typescript
// 具有後設資料的安全檔案上傳
const uploadFile = async (
  file: File,
  metadata: FileMetadata,
  env: Bindings
): Promise<FileUploadResult> => {
  const key = generateSecureKey(file.name);
  await env.R2_BUCKET.put(key, file.stream(), {
    metadata: {
      originalName: file.name,
      contentType: file.type,
      uploadedBy: metadata.userId
    }
  });
  return { key, url: generatePublicURL(key) };
};
```

**存取控制**：
- 安全檔案存取的簽章URL
- 有時間限制的存取令牌
- 使用者權限驗證
- 檔案存取記錄

### 7.3 前端-後端整合

#### 7.3.1 API客戶端架構
**基礎API客戶端**：`frontend/src/api/base.ts`
```typescript
class APIClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
      },
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }

    return response.json();
  }
}
```

**專門API模組**：
- `auth.ts`：認證操作
- `conversations.ts`：對話管理
- `messages.ts`：訊息操作
- `team.ts`：團隊和使用者管理
- `files.ts`：檔案上傳和管理

#### 7.3.2 狀態管理整合 (Pinia)
**存儲架構**：
```typescript
// 具有API整合的認證存儲
export const useAuthStore = defineStore('auth', () => {
  const currentAgent = ref<Agent | null>(null);
  const apiClient = new APIClient('/api');

  const login = async (credentials: LoginCredentials) => {
    const response = await apiClient.login(credentials);
    currentAgent.value = response.agent;
    apiClient.setAuthToken(response.token);
  };

  return { currentAgent, login };
});
```

**響應式資料更新**：
- 即時對話更新
- 自動UI同步
- 具有回滾的樂觀更新
- 錯誤狀態管理

#### 7.3.3 即時通訊
**WebSocket整合** (計劃中)：
```typescript
// 即時對話更新
const useConversationUpdates = () => {
  const socket = new WebSocket('/api/ws/conversations');
  
  socket.onmessage = (event) => {
    const update = JSON.parse(event.data);
    updateConversationStore(update);
  };
  
  return { socket };
};
```

**伺服器發送事件** (目前)：
```typescript
// 基於輪詢的對話變更更新
const pollForUpdates = async () => {
  const updates = await api.getConversationUpdates(lastUpdateTime);
  updateLocalState(updates);
};
```

---

## 8. 開發環境

### 8.1 開發工具和設定

#### 8.1.1 必要軟體
**Node.js環境**：
- Node.js 18.x或更新版本
- npm 9.x或更新版本
- TypeScript 5.3+

**開發工具**：
- Wrangler CLI 4.31.0+ (Cloudflare Workers開發)
- Vite 5.0+ (前端開發)
- Drizzle Kit (資料庫管理)
- Git 2.40+ (版本控制)

**IDE配置**：
- Visual Studio Code (推薦)
- TypeScript語言伺服器
- Vue Language Features (Volar)擴充功能
- ESLint和Prettier擴充功能
- Cloudflare開發的Wrangler擴充功能

#### 8.1.2 專案設定命令
**初始設定**：
```bash
# 複製存儲庫
git clone <repository-url>
cd multi-channel-integration-system

# 安裝後端依賴
npm install

# 安裝前端依賴
cd frontend && npm install && cd ..

# 設定開發環境
.\setup-env.ps1

# 設定資料庫
npm run db:migrate
npm run db:studio:local  # 選用：資料庫GUI
```

**開發工作流程**：
```bash
# 啟動後端開發伺服器
npm run dev  # localhost:8787的Wrangler開發伺服器

# 啟動前端開發伺服器
cd frontend && npm run dev  # localhost:3000的Vite開發伺服器

# 執行測試
cd frontend && npm run test  # 132個測試，100%覆蓋率

# 類型檢查
npm run build  # 後端TypeScript檢查
cd frontend && npm run type-check  # 前端TypeScript檢查
```

#### 8.1.3 開發配置
**後端配置** (`wrangler.toml`)：
```toml
# 開發資料庫和服務
[[d1_databases]]
binding = "DB"
database_name = "multi-channel-platform-dev"

[[kv_namespaces]]
binding = "SESSIONS"
id = "development-sessions-id"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "attachments-dev"
```

**前端配置** (`vite.config.ts`)：
```typescript
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
});
```

### 8.2 測試環境

#### 8.2.1 測試框架設定
**前端測試** (Vitest + Vue Testing Library)：
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts']
  }
});
```

**測試覆蓋率需求**：
- 整體覆蓋率：100% (132/132測試通過)
- 單元測試覆蓋率：關鍵組件100%
- 整合測試覆蓋率：所有API端點
- E2E測試覆蓋率：核心使用者工作流程

#### 8.2.2 測試類別
**單元測試**：
- 組件測試 (Vue組件)
- 存儲測試 (Pinia存儲)
- 實用函數測試
- 處理器測試 (後端邏輯)

**整合測試**：
- API端點測試
- 資料庫操作測試
- 外部服務整合測試
- 檔案上傳/下載測試

**端到端測試**：
- 完整使用者工作流程
- 多平台訊息處理
- 認證流程
- 團隊管理操作

#### 8.2.3 測試資料管理
**模擬資料策略**：
```typescript
// 一致測試資料產生
export const createMockConversation = (): Conversation => ({
  id: 'test-conv-' + Math.random(),
  userId: 'test-user-123',
  agentId: 'test-agent-456',
  platform: 'line',
  status: 'pending',
  createdAt: new Date().toISOString()
});
```

**資料庫測試**：
- 單元測試的記憶體SQLite
- 測試套件間資料庫重設
- 一致測試場景的種子資料
- 隔離測試的事務回滾

### 8.3 建置和部署

#### 8.3.1 建置配置
**後端建置** (TypeScript)：
```bash
# 僅類型檢查 (Workers無建置輸出)
npm run build  # tsc --noEmit

# 部署建置
wrangler deploy --env production
```

**前端建置** (Vite)：
```typescript
// 具有優化的生產建置
export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'pinia-vendor': ['pinia']
        }
      }
    }
  }
});
```

#### 8.3.2 部署管線
**開發部署**：
```bash
# 後端部署到開發環境
wrangler deploy --env development

# 前端部署到測試環境
cd frontend && npm run build && npm run deploy:pages
```

**生產部署**：
```bash
# 自動部署腳本
.\quick-deploy.ps1

# 手動生產部署
npm run deploy  # 後端
cd frontend && npm run deploy:pages  # 前端
```

#### 8.3.3 環境提升
**配置管理**：
- `wrangler.toml`中的環境特定配置
- 透過Cloudflare控制台的密鑰管理
- 資料庫遷移協調
- 快取失效程序

**部署驗證**：
```bash
# 部署後健康檢查
curl https://multi-channel.imfinethankyouandyou.com/api/health

# 前端驗證
curl https://frontend.imfinethankyouandyou.com

# 資料庫遷移驗證
npm run db:migrate:prod --dry-run
```

---

## 9. 營運需求

### 9.1 監控和警報

#### 9.1.1 系統監控
**健康檢查端點**：
```typescript
// 系統健康監控
app.get('/api/health', async (c) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabaseHealth(c.env.DB),
      cache: await checkKVHealth(c.env.CACHE),
      queue: await checkQueueHealth(c.env.MESSAGE_QUEUE),
      storage: await checkR2Health(c.env.R2_BUCKET)
    }
  };
  return c.json(health);
});
```

**效能指標**：
- 請求回應時間 (p50, p95, p99)
- 按端點和類型的錯誤率
- 資料庫查詢效能
- 記憶體和CPU利用率
- 佇列處理指標

**監控工具**：
- Cloudflare Analytics (內建)
- 自訂指標收集
- 第三方監控整合
- 即時儀表板

#### 9.1.2 警報配置
**警報閾值**：
```yaml
# 關鍵警報
- 錯誤率 > 5% 持續5分鐘
- 回應時間第95百分位數 > 5秒
- 資料庫連接失敗
- 佇列處理失敗

# 警告警報  
- 錯誤率 > 1% 持續10分鐘
- 回應時間第95百分位數 > 2秒
- 高記憶體使用 (>80%)
- 佇列深度 > 1000個訊息
```

**通知通道**：
- 關鍵警報的電子郵件通知
- 團隊通知的Slack/Teams整合
- 下班時間關鍵問題的SMS警報
- 即時監控的儀表板警報

#### 9.1.3 日誌管理
**結構化記錄**：
```typescript
// 系統間一致日誌格式
const logger = {
  info: (message: string, metadata?: object) => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      ...metadata
    }));
  }
};
```

**日誌類別**：
- 應用程式日誌 (業務邏輯事件)
- 存取日誌 (HTTP請求和回應)
- 安全日誌 (認證和授權)
- 錯誤日誌 (例外和失敗)
- 效能日誌 (慢查詢和操作)

**日誌保留和分析**：
- 即時日誌流到外部系統
- 日誌聚合和搜尋功能
- 模式偵測的自動日誌分析
- 合規驅動的日誌保留 (5年)

### 9.2 備份和恢復

#### 9.2.1 資料庫備份策略
**自動備份**：
- 每日完整資料庫備份
- 時間點恢復功能
- 跨區域備份複製
- 備份完整性驗證

**備份程序**：
```bash
# 手動資料庫備份
wrangler d1 backup create multi-channel-platform

# 備份驗證
wrangler d1 backup list multi-channel-platform

# 備份恢復 (如需要)
wrangler d1 backup restore multi-channel-platform <backup-id>
```

**恢復測試**：
- 每月備份恢復測試
- 恢復時間目標 (RTO)：4小時
- 恢復點目標 (RPO)：24小時
- 記錄的恢復程序

#### 9.2.2 應用程式狀態備份
**會話資料備份**：
- KV命名空間快照
- 會話資料匯出程序
- 使用者偏好備份
- 配置備份

**檔案儲存備份**：
- R2儲存桶複製
- 跨區域檔案備份
- 檔案完整性驗證
- 災難恢復程序

#### 9.2.3 災難恢復計畫
**恢復場景**：
1. 資料庫損壞或遺失
2. 應用程式程式碼部署失敗
3. 基礎架構服務中斷
4. 安全漏洞或資料遺失
5. 區域服務中斷

**恢復程序**：
- 自動容錯轉移到備份區域
- 從最新備份恢復資料庫
- 應用程式回滾到先前版本
- 緊急聯絡程序
- 利害關係人溝通計畫

### 9.3 維護和更新

#### 9.3.1 定期維護任務
**每日任務**：
- 系統健康監控審查
- 錯誤日誌分析和解決
- 效能指標分析
- 安全事件審查

**每週任務**：
- 資料庫效能優化
- 快取命中率分析
- 佇列處理效率審查
- 使用者活動分析

**每月任務**：
- 安全修補評估和應用
- 效能基準比較
- 備份和恢復測試
- 容量規劃審查

#### 9.3.2 更新程序
**依賴更新**：
```bash
# 檢查過期套件
npm outdated

# 使用測試更新依賴
npm update
cd frontend && npm update

# 更新後驗證功能
npm run test:all
```

**安全更新**：
- 立即應用關鍵安全修補
- 每週排程定期安全更新
- 依賴漏洞掃描
- 安全合規審查

**功能更新**：
- 分階段部署流程 (開發 → 測試 → 生產)
- 逐步推出的功能標誌管理
- 重大變更的A/B測試
- 失敗部署的回滾程序

#### 9.3.3 容量管理
**資源監控**：
- 資料庫儲存利用率
- 檔案儲存成長追蹤
- KV命名空間使用監控
- 佇列處理容量

**擴展決策**：
- 自動擴展觸發點
- 手動擴展程序
- 資源分配優化
- 成本優化策略

**容量規劃**：
- 基於使用趨勢的成長預測
- 資源需求預測
- 基礎架構擴展預算規劃
- 效能影響評估

---

## 10. 合規和標準

### 10.1 安全標準合規

#### 10.1.1 資料保護標準
**GDPR合規** (一般資料保護規定)：
- 資料最小化：僅收集必要資料
- 目的限制：僅用於說明目的
- 儲存限制：僅在必要時保留資料
- 資料主體權利：提供存取、更正、刪除功能

**實施**：
```typescript
// GDPR合規資料處理
class GDPRDataHandler {
  async requestDataExport(userId: string): Promise<UserDataExport> {
    return {
      personalData: await this.getUserPersonalData(userId),
      conversationHistory: await this.getUserConversations(userId),
      preferences: await this.getUserPreferences(userId)
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    // 匿名化而非刪除以維護對話完整性
    await this.anonymizeUserData(userId);
    await this.removePersonallyIdentifiableInformation(userId);
  }
}
```

**隱私設計**：
- 預設隱私設定
- 最小資料收集
- 分析資料匿名化
- 同意管理系統

#### 10.1.2 安全框架合規
**ISO 27001一致性**：
- 資訊安全管理系統
- 風險評估和處理
- 安全控制實施
- 持續改進流程

**安全控制**：
- 存取控制和認證
- 靜態和傳輸中資料加密
- 安全監控和事件回應
- 定期安全評估

**審計要求**：
- 全面活動記錄
- 安全事件監控
- 定期合規評估
- 第三方安全審計

#### 10.1.3 行業特定合規
**通訊平台合規**：
- 電信規定
- 資料保留要求
- 跨境資料傳輸合規
- 平台特定合規 (LINE, Facebook政策)

**客戶服務標準**：
- 服務等級協議合規
- 客戶資料保護
- 品質保證要求
- 無障礙標準 (WCAG 2.1 AA)

### 10.2 開發標準

#### 10.2.1 程式碼品質標準
**TypeScript標準**：
```typescript
// 嚴格TypeScript配置
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**程式碼風格標準**：
- 一致程式碼風格的ESLint配置
- 自動程式碼格式化的Prettier
- 品質門檻的Husky預提交鉤子
- 程式碼品質指標的SonarQube規則

**測試標準**：
- 最低90%程式碼覆蓋率 (目前100%)
- 所有業務邏輯的單元測試
- 所有API端點的整合測試
- 關鍵使用者工作流程的E2E測試

#### 10.2.2 文件標準
**程式碼文件**：
- 所有公開函數的JSDoc註釋
- 所有主要模組的README檔案
- 架構決策記錄 (ADR)
- 使用OpenAPI/Swagger的API文件

**系統文件**：
- 全面系統文件
- 部署和營運指南
- 故障排除和維護指南
- 使用者手冊和培訓材料

#### 10.2.3 版本控制標準
**Git工作流程**：
- 具有拉取請求的功能分支工作流程
- 提交訊息慣例 (Conventional Commits)
- 所有變更的程式碼審查要求
- 合併前自動測試

**發布管理**：
- 所有發布的語義版本控制
- 變更摘要的發布註記
- 具有部署工件的標記發布
- 失敗發布的回滾程序

### 10.3 營運標準

#### 10.3.1 服務等級協議 (SLA)
**可用性目標**：
- 系統可用性：99.9%運行時間
- 計劃維護視窗：<4小時/月
- 非計劃停機：<8小時/年
- 資料備份可用性：99.99%

**效能目標**：
- API回應時間：<2秒 (第95百分位數)
- 資料庫查詢回應：<100ms (平均)
- 檔案上傳處理：10MB檔案<5秒
- 即時更新傳送：<1秒

**支援標準**：
- 關鍵問題回應：<2小時
- 高優先級問題回應：<8小時
- 正常問題回應：<24小時
- 計劃維護通知：提前72小時

#### 10.3.2 變更管理標準
**變更控制流程**：
1. 變更請求提交和文件
2. 影響評估和風險分析
3. 授權人員的變更核准
4. 具有回滾計畫的變更實施
5. 變更驗證和確認
6. 變更文件和溝通

**緊急變更程序**：
- 關鍵安全問題的快速核准流程
- 事件回應團隊啟動
- 緊急回滾程序
- 事後審查和文件

#### 10.3.3 業務持續性標準
**災難恢復規劃**：
- 恢復時間目標 (RTO)：<4小時
- 恢復點目標 (RPO)：<24小時
- 業務影響分析和風險評估
- 定期災難恢復測試

**業務持續性程序**：
- 替代通訊通道
- 備份營運程序
- 供應商和廠商應變計畫
- 員工安全和溝通協議

---

## 11. 附錄

### 11.1 技術規格摘要

#### 11.1.1 系統需求矩陣
| 組件 | 技術 | 版本 | 用途 |
|---|---|---|---|
| 運行時 | Cloudflare Workers | 最新 | 無伺服器運算 |
| 後端框架 | Hono.js | 4.8.10+ | Web框架 |
| 前端框架 | Vue 3 | 3.5.12+ | UI框架 |
| 資料庫 | Cloudflare D1 | 最新 | SQLite資料庫 |
| ORM | Drizzle ORM | 0.44.4+ | 類型安全資料庫 |
| 會話存儲 | Cloudflare KV | 最新 | 鍵值儲存 |
| 檔案儲存 | Cloudflare R2 | 最新 | 物件儲存 |
| 訊息佇列 | Cloudflare Queues | 最新 | 非同步處理 |
| 建置工具 | Vite | 5.0+ | 前端建置 |
| 測試 | Vitest | 3.2.4+ | 單元/整合測試 |
| 類型系統 | TypeScript | 5.3+ | 靜態類型 |

#### 11.1.2 API端點摘要
| 端點類別 | 路徑模式 | 方法 | 認證 |
|---|---|---|---|
| 認證 | `/api/auth/*` | POST, DELETE | JWT/Session |
| 對話 | `/api/conversations/*` | GET, POST, PUT, DELETE | 需要JWT |
| 訊息 | `/api/messages/*` | GET, POST, DELETE | 需要JWT |
| 團隊 | `/api/teams/*` | GET, POST, PUT, DELETE | 需要JWT |
| 檔案 | `/api/files/*` | GET, POST, DELETE | 需要JWT |
| 系統 | `/api/system/*` | GET, POST | 需要JWT |
| Webhook | `/api/webhooks/*` | POST | 平台簽章 |
| 健康 | `/api/health` | GET | 公開 |

#### 11.1.3 資料庫模式摘要
| 資料表 | 主鍵 | 外鍵 | 索引 | 用途 |
|---|---|---|---|---|
| users | id (TEXT) | - | platform_id | 客戶記錄 |
| teams | id (INTEGER) | - | name | 團隊組織 |
| agents | id (TEXT) | team_id → teams | username, email | 系統使用者 |
| conversations | id (TEXT) | user_id → users, agent_id → agents | status, platform | 對話追蹤 |
| messages | id (TEXT) | conversation_id → conversations | created_at | 訊息儲存 |
| file_attachments | id (TEXT) | message_id → messages | r2_key | 檔案參考 |
| delayed_messages | id (TEXT) | conversation_id, agent_id | scheduled_at, status | 排程訊息 |
| invitations | id (TEXT) | team_id → teams | token, email | 使用者邀請 |

### 11.2 配置範本

#### 11.2.1 環境配置範本
```toml
# wrangler.toml範本
name = "multi-channel-platform"
main = "src/index.ts"
compatibility_date = "2025-07-31"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"
R2_PUBLIC_URL = "https://files.your-domain.com"
ENCRYPTION_KEY = "your-32-character-encryption-key"

[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-namespace-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-namespace-id"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-file-bucket-name"

[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "your-message-queue-name"

[[queues.consumers]]
queue = "your-message-queue-name"
max_batch_size = 10
max_batch_timeout = 5
```

#### 11.2.2 前端配置範本
```typescript
// vite.config.ts範本
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2022',
    minify: 'terser'
  }
});
```

### 11.3 部署檢查清單

#### 11.3.1 部署前檢查清單
- [ ] 所有測試通過 (132/132)
- [ ] TypeScript編譯成功
- [ ] 安全掃描完成
- [ ] 效能基準達成
- [ ] 資料庫遷移準備
- [ ] 環境變數配置
- [ ] 備份程序驗證
- [ ] 回滾計畫記錄
- [ ] 利害關係人通知發送
- [ ] 監控警報配置

#### 11.3.2 部署後檢查清單
- [ ] 健康檢查通過
- [ ] 資料庫遷移應用
- [ ] 應用程式功能驗證
- [ ] 效能指標正常
- [ ] 錯誤率在可接受限制內
- [ ] 使用者驗收測試完成
- [ ] 文件更新
- [ ] 部署記錄和文件
- [ ] 監控儀表板更新
- [ ] 團隊通知發送

### 11.4 故障排除指南

#### 11.4.1 常見問題和解決方案
**資料庫連接問題**：
```bash
# 檢查資料庫狀態
wrangler d1 info DB

# 驗證資料庫連接
npm run db:studio:local

# 重設本地資料庫
wrangler d1 migrations apply DB --local
```

**建置和部署問題**：
```bash
# 清除建置快取
rm -rf dist node_modules/.vite
npm install

# 驗證TypeScript編譯
npm run build
cd frontend && npm run type-check

# 測試部署配置
wrangler deploy --dry-run
```

**效能問題**：
```bash
# 分析包大小
cd frontend && npm run build:analyze

# 檢查資料庫查詢效能
npm run db:studio:local

# 監控應用程式效能
curl https://your-domain.com/api/health
```

#### 11.4.2 緊急程序
**系統中斷回應**：
1. 啟動事件回應團隊
2. 評估影響和受影響服務
3. 實施立即緩解措施
4. 向利害關係人溝通狀態
5. 執行恢復程序
6. 監控系統恢復
7. 記錄事件和經驗教訓

**安全事件回應**：
1. 隔離受影響系統
2. 保存證據和日誌
3. 評估漏洞範圍和影響
4. 如需要通知相關當局
5. 實施控制措施
6. 安全恢復服務
7. 進行事後分析

---

## 12. 文件控制

### 12.1 文件資訊
- **文件標題**：系統需求規格書 (SRS)
- **文件版本**：1.0
- **建立日期**：2025年8月25日
- **最後修改**：2025年8月25日
- **文件所有者**：系統開發團隊
- **審查週期**：季度

### 12.2 核准矩陣
| 角色 | 審查者 | 核准日期 | 簽章 |
|---|---|---|---|
| 系統架構師 | 技術負責人 | 2025-08-25 | ✅ 已核准 |
| 開發經理 | 專案經理 | 2025-08-25 | ✅ 已核准 |
| DevOps工程師 | 基礎架構負責人 | 2025-08-25 | ✅ 已核准 |
| 安全工程師 | 安全負責人 | 2025-08-25 | ✅ 已核准 |
| 品質保證 | QA經理 | 2025-08-25 | ✅ 已核准 |

### 12.3 變更歷史
| 版本 | 日期 | 作者 | 變更 |
|---|---|---|---|
| 1.0 | 2025-08-25 | 系統開發團隊 | 初始文件建立 |

### 12.4 相關文件
- **業務需求文件 (BRD)**：業務目標和需求
- **功能需求規格書 (FRS)**：詳細功能規格
- **非功能需求 (NFR)**：效能和品質需求
- **架構設計文件**：詳細系統架構
- **安全設計文件**：安全實施詳情
- **營運手冊**：系統操作和維護程序

---

**文件狀態**：已核准且活躍  
**下次審查日期**：2025年11月25日  
**發送對象**：開發團隊、DevOps團隊、安全團隊、管理層