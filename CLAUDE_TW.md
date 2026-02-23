# CLAUDE.md

本文件旨在為 Claude Code (claude.ai/code) 處理此儲存庫中的程式碼時提供指導。

> 📚 **延伸文檔**：詳細指南位於 `docs/claude/` 目錄中。請參閱 [文檔索引](docs/claude/INDEX.md) 進行導航。

## 專案概覽

這是一個使用 Cloudflare Workers 和 Vue 3 構建的 **多渠道客戶支援系統 (Multi-Channel Customer Support System)**。這是一個整合 LINE OA 並支援 Facebook Messenger 的全方位平台，用於統一的客戶服務管理，具有 **企業級架構**，並採用由 Durable Objects 驅動的 **100% WebSocket 即時通訊**。

### 關鍵特性
- **現代化 Vue 3 + TypeScript** 前端，包含全面測試 (132+ 個測試)
- **Cloudflare Worker 後端**，使用 Hono 框架和 Drizzle ORM
- **雙重角色架構**：系統角色 (管理員/專員) + 團隊角色 (成員/領導/主管)
- **多團隊支援**，具有 JWT 緩存權限和團隊範圍的數據訪問
- **LINE OA 整合**，具有完整的 Webhook 處理和自動分配廣播
- **延遲訊息系統**，與 Cloudflare Queues 整合
- **文件上傳支援**，使用 Cloudflare R2 存儲
- **生產環境部署** 在 Cloudflare Pages 和 Workers 上
- **WebSocket 即時通訊**，採用 Durable Objects 架構 (100% 部署)
- **團隊範圍廣播**，具有安全隔離 (專員只能看到自己團隊的數據)
- **動態排序系統**，支援拖放和 localStorage 持久化
- **🚀 Web 安裝程式** - 為客戶提供的一鍵式自託管部署系統 (生產就緒)

## 架構

### 後端 (Cloudflare Worker)
- **執行環境**：Cloudflare Workers (邊緣計算)
- **框架**：Hono (輕量級 Web 框架)
- **資料庫**：Cloudflare D1 (SQLite) 搭配 Drizzle ORM 進行類型安全的操作
- **緩存**：Cloudflare KV 用於會話管理和性能優化
- **存儲**：Cloudflare R2 用於文件附件和媒體
- **隊列**：Cloudflare Queues 用於延遲訊息和異步處理
- **即時通訊**：**100% WebSocket** 搭配 Durable Objects 架構以實現有狀態連接
- **Durable Objects**：五個生產就緒的類別 (ConversationRoom, UserConnection, MessageBroadcaster, DelayedMessageProcessor, DelayedMessageBuffer)
- **入口點**：`src/index.ts` - 基於處理器的模組化架構

### 前端 (Vue 3 應用程式)
- **框架**：Vue 3 搭配 Composition API 和 TypeScript
- **狀態管理**：Pinia stores 用於響應式狀態管理
- **路由**：Vue Router 4 搭配認證守衛 (authentication guards)
- **構建工具**：Vite 搭配生產優化
- **測試**：Vitest 搭配 132+ 個全面測試
- **UI 特性**：
  - 響應式設計搭配現代 CSS
  - 針對大數據集的虛擬滾動 (@tanstack/vue-virtual)
  - 國際化 (i18n) 支援
  - 帶有進度指示器的文件上傳
  - 透過 WebSocket 的即時訊息更新
- **入口點**：`frontend/src/main.ts`

### 核心處理器架構
後端採用基於處理器的模組化方法：
- `handlers/auth-main.ts` - 認證與 JWT 管理
- `handlers/conversation-main.ts` - 對話 CRUD 操作
- `handlers/messaging-main.ts` - **完整訊息系統**，包含 17 個端點 (批量操作、附件、轉發、標籤、匯出)
- `handlers/delayed-message-main.ts` - 使用 Cloudflare Queues 的延遲訊息
- `handlers/team-main.ts` - 團隊與成員管理
- `handlers/system-main.ts` - 系統設置與健康監控
- `handlers/customer-main.ts` - 客戶數據管理
- `handlers/tag-main.ts` - **標籤管理系統**，包含 CRUD 操作、批量操作和使用統計
- `handlers/websocket-main.ts` - WebSocket 連接管理與路由
- `handlers/websocket-health.ts` - WebSocket 健康檢查與監控
- `handlers/websocket-integration-test.ts` - WebSocket 測試端點

### 服務與基礎設施
- `services/websocket-broadcast-service.ts` - **生產級 WebSocket 廣播**，具有團隊範圍的安全性
- `services/websocket-auth-service.ts` - WebSocket 認證與授權
- `modules/teams/services/member-service.ts` - **團隊成員服務**，在刪除時進行全面的外鍵清理
- `durable-objects/` - **五個生產就緒的 Durable Objects** 用於 WebSocket 狀態管理
- `middleware/auth.ts` - 具有 **團隊角色強制執行** (requireTeamRole, requireTeamPermission) 的 JWT 認證中間件
- `types/` - 全面的 TypeScript 定義，包括 WebSocket 類型

## 開發指令

> ⚠️ **重要**：此專案僅使用 **遠程資源 (REMOTE RESOURCES)**。所有開發都直接連接到生產環境的 D1, KV, R2 和 Durable Objects。沒有本地開發環境。

### 後端 (根目錄)
```bash
# 開發 (連接至遠程資源)
bun run dev              # 啟動 Wrangler 開發伺服器 (使用 REMOTE 綁定)
bun run build            # TypeScript 編譯檢查
bun run lint:check       # TypeScript + Vue 類型檢查與 linting

# 資料庫操作 (全部在遠程 D1 上操作)
bun run db:migrate       # 應用遷移至遠程 D1
bun run db:generate      # 生成 Drizzle 遷移
bun run db:push          # 推送架構變更至遠程
bun run db:studio        # 開啟遠程 DB 的 Drizzle Studio
bun run db:query         # 在遠程 D1 上執行查詢

# 部署與生產
bun run deploy           # 部署至生產環境

# 健康檢查與監控
bun run health:check     # 檢查系統健康 (格式化 JSON)
bun run health:check:ws  # 檢查 WebSocket 健康 (格式化 JSON)
bun run health:check:all # 檢查系統與 WebSocket 健康
bun run health:check:detail # 詳細 WebSocket 健康資訊
bun run monitor:deployment # 持續健康監控 (每 30 秒)
bun run perf:baseline    # 查看 WebSocket 性能指標

# 測試與驗證
bun run test:handlers    # 測試所有處理器
bun run test:api         # API 整合測試
bun run test:upload      # 文件上傳端到端測試

# 性能與監控
bun run benchmark        # 運行性能基準測試套件
bun run profile:memory   # 記憶體使用分析
```

### 前端 (frontend/ 目錄)
```bash
# 開發
bun run dev              # 啟動 Vite 開發伺服器 (端口 3000)
bun run build            # 為生產環境構建
bun run type-check       # Vue TypeScript 檢查

# 測試 (132+ 個測試)
bun run test             # 使用 Vitest 運行所有測試
bun run test:run         # 單次測試運行
bun run test:coverage    # 生成覆蓋率報告
bun run test:ui          # 互動式測試 UI

# Linting 與代碼品質
bun run lint             # ESLint 自動修復
bun run lint:check       # 僅 ESLint 檢查

# 部署
bun run build:pages      # 構建並複製 Cloudflare Pages 配置
bun run deploy:pages     # 部署至 Cloudflare Pages
bun run verify:deployment # 驗證生產部署
```

## 套件管理器

本專案使用 **Bun** 作為所有環境（本地開發、CI/CD 和生產）的唯一套件管理器。

- **安裝依賴**: `bun install`
- **執行腳本**: `bun run <script>`
- **執行套件**: `bunx <package>`
- **鎖定文件**: `bun.lock`（請勿使用 `package-lock.json`）

## 關鍵技術與整合

### 資料庫與 ORM
- **Drizzle ORM** 用於類型安全的資料庫操作
- **Cloudflare D1** 作為主要資料庫
- **Cloudflare KV** 用於緩存和會話管理
- 架構位於 `src/db/schema.ts`
- **近期架構優化** (遷移 0024-0027)：
  - **第 1 階段**：為 `agents` 表添加索引 (team_id, role)
  - **第 2 階段**：標準化 `file_attachments` 欄位命名為 snake_case
  - **第 3 階段**：重構 `channel_integrations` 為基於 JSON 的配置以增強擴展性
  - **軟刪除**：為核心表 (teams, agents, customers, conversations, messages, tags) 添加 `deletedAt` 欄位
  - **14+ 性能索引**：優化常見查詢模式

### 外部 API
- **LINE Messaging API** - 完整的 LINE OA Webhook 整合
- **Facebook Messenger API** - 準備整合 (處理器已就緒)
- **JWT 認證** - 安全的基於令牌的認證系統

### 現代前端特性
- **Vue 3 Composition API** 搭配 TypeScript 進行類型安全開發
- **Pinia stores** 用於響應式狀態管理 (`frontend/src/stores/`)
- **即時通訊** 搭配 **100% WebSocket** 用於即時訊息更新和狀態
- **前端服務**：
  - `frontend/src/services/websocketClient.ts` - **生產級 WebSocket 客戶端**，具有自動重連功能
  - `frontend/src/services/websocketManager.ts` - WebSocket 連接生命週期管理
  - `frontend/src/services/conversationSync.ts` - **基於 WebSocket 的對話同步服務**，具有自動重連功能
  - `frontend/src/api/` - HTTP API 客戶端模組
- **UI 組件**：
  - 使用 @tanstack/vue-virtual 進行虛擬滾動以提升性能
  - 文件上傳，具有進度指示器和 R2 整合
  - 響應式設計，搭配現代 CSS 和組件庫
  - 加載狀態和錯誤處理組件
  - **確認對話框**，具有基於 Promise 的 API 和多種類型 (警告、危險、資訊)
  - **動態排序**，使用 `SortDropdown.vue` 進行欄位選擇和順序切換
  - **拖放排序**，使用 `vue-draggable-plus` 進行自定義順序持久化
- **開發者體驗**：
  - **國際化 (i18n)** 搭配 Vue I18n
  - **開發工具** 搭配 Vite 和 TypeScript
  - **測試基礎設施** 搭配 Vitest 和 Vue Test Utils
  - **代碼品質** 搭配 ESLint 和 TypeScript 嚴格模式

## 重要文件位置

### 配置
- `wrangler.toml` - Cloudflare Worker 配置與 Durable Objects 綁定
- `wrangler-websocket.toml` - WebSocket + Durable Objects 生產配置
- `drizzle.config.ts` - 資料庫配置
- `frontend/vite.config.ts` - 前端構建配置
- `frontend/vitest.config.ts` - 測試配置與 WebSocket 測試環境
- `src/config/cors.ts` - **統一 CORS 配置** (所有允許來源的單一真理來源)
- `src/config/runtime.ts` - **運行時配置層** (後端 URL、環境檢測)
- `src/config/external-apis.ts` - **外部 API URL** (LINE, Facebook, Cloudflare 等)
- `src/constants/` - **統一常數管理**
  - `src/constants/durable-objects.ts` - Durable Objects 路由常數
  - `src/constants/limits.ts` - 時間、大小和數量限制
- `src/monitoring/cors-monitor.ts` - CORS 錯誤監控與分析

### 核心後端文件
- `src/index.ts` - 主 Worker 入口點與 WebSocket 路由
- `src/db/schema.ts` - 資料庫架構定義 (包含團隊表和角色層級)
- `src/services/permission-service.ts` - 企業角色權限系統
- `src/types/` - TypeScript 類型定義 (針對 3 角色系統 + WebSocket 類型進行了更新)
  - `src/types/websocket-types.ts` - WebSocket 和 Durable Objects 類型定義
  - `src/types/rollback-types.ts` - 緊急回滾系統類型
  - `src/types/deployment-types.ts` - 功能標誌和部署類型
- `src/handlers/` - 按功能分類的請求處理器，具有 WebSocket 廣播整合
- `src/durable-objects/` - 用於有狀態 WebSocket 管理的 Durable Objects
- `src/services/websocket-broadcast-service.ts` - 統一 WebSocket 廣播
- `src/services/emergency-rollback-service.ts` - 緊急回滾和遷移控制
- `src/monitoring/` - 性能監控和部署追蹤
- `src/middleware/auth.ts` - 具有角色層級的認證中間件
- `src/utils/` - 工具函數

### 核心前端文件
- `frontend/src/main.ts` - 應用程式入口點與 WebSocket 初始化
- `frontend/src/App.vue` - 根組件
- `frontend/src/stores/` - Pinia 狀態管理與即時事件處理
- `frontend/src/api/` - API 客戶端模組
- `frontend/src/services/` - WebSocket 客戶端服務與連接管理
- `frontend/src/composables/` - 用於 WebSocket 功能和 UI 互動的 Vue composables
  - `frontend/src/composables/useConfirmDialog.ts` - **全局確認對話框系統**，採用單例模式和基於 Promise 的 API
  - `frontend/src/composables/useListSorting.ts` - **動態排序系統**，具有欄位選擇、順序切換、拖放和 localStorage 持久化
  - `frontend/src/composables/team-management/useTeamManagementController.ts` - **團隊管理控制器**，具有排序模式輔助
- `frontend/src/components/ui/` - 即時 UI 組件 (狀態指示器、輸入指示器)
- `frontend/src/views/ConversationDetail.vue` - 具有 WebSocket 整合的主對話介面
- `frontend/src/types/` - 前端類型定義，包括 WebSocket 類型

## 環境配置系統

**模式：** 3 層架構 (環境變數 → 運行時配置 → 業務邏輯)

**關鍵函數：** `getBackendUrl()`, `getWebSocketUrl()`, `getFrontendUrl()`, `getStoragePublicUrl()`

**配置文件：**
- `frontend/.env.development` / `.env.production` - 前端環境變數
- `.dev.vars` - 後端開發環境變數
- `frontend/src/config/runtime.ts` (428 行) - 前端運行時配置層
- `src/config/runtime.ts` (300+ 行) - 後端運行時配置層
- `frontend/src/vite-env.d.ts` (150+ 行) - TypeScript 環境變數定義

**快速範例：**
```typescript
import { getBackendUrl, getWebSocketUrl } from '@/config/runtime';
const apiUrl = getBackendUrl(); // ✅ 絕不硬編碼 URL
const wsUrl = getWebSocketUrl(); // 自動協議轉換
```

**效益：** 環境切換時間減少 96% (4-6 小時 → 5-10 分鐘)

📖 **詳細指南：** 請參閱 [`docs/claude/ENVIRONMENT_CONFIG.md`](docs/claude/ENVIRONMENT_CONFIG.md) 獲取完整的 3 層架構、所有環境變數、切換指南、最佳實踐和故障排除。

## 測試策略

**前端：** 132+ 個測試，100% 通過率 (組件、stores、WebSocket、即時特性)

**後端：** 處理器測試、API 整合測試、WebSocket 基礎設施測試、負載測試 (1000+ 連接)

**WebSocket 測試：**
- 單元測試 (`tests/unit/durable-objects/`)
- 整合測試 (`tests/integration/websocket/`)
- 性能測試 (`tests/performance/websocket/`)
- E2E 測試 (`tests/e2e/websocket/`)

**關鍵測試助手：**
- `tests/helpers/websocket/WebSocketTestClient.ts` - 模擬真實 WebSocket 連接
- `frontend/tests/helpers/directStoreCreation.ts` - 可靠的 store 測試

📖 **詳細指南：** 請參閱 [`docs/claude/TESTING.md`](docs/claude/TESTING.md) 獲取完整的測試基礎設施、運行測試和最佳實踐。

## 開發最佳實踐

### 路由註冊順序 (⚠️ 關鍵)

**為何重要**：在 Hono 框架中，路由註冊順序決定了路由優先級。較晚註冊的路由 **無法覆蓋** 較早的 catch-all 路由。

**`src/index.ts` 中的優先級層級：**
1. **優先級 1 (最高)**：公共端點 (在統一路由系統之前註冊) - WebSocket 健康檢查、CORS 監控
2. **優先級 2**：顯式認證端點 (使用 jwtAuth 中間件)
3. **優先級 3**：統一路由系統 (RouteRegistry 批量註冊)
4. **優先級 4**：細粒度個別路由 (系統設置、憑證)

**常見陷阱：**
```typescript
// ❌ 壞：在統一路由系統之後註冊
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
app.route('/api/myendpoint', myHandler); // 太晚了 - 將會被攔截！

// ✅ 好：在統一路由系統之前預先註冊
app.route('/api/myendpoint', myHandler); // 優先
const routeRegistry = new RouteRegistry(app);
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

📖 **詳細指南：** 請參閱 [`docs/claude/ROUTE_REGISTRATION.md`](docs/claude/ROUTE_REGISTRATION.md) 獲取完整的優先級層級、檢查清單、範例和調試技巧。

---

### 代碼風格
- **TypeScript 嚴格模式** - 所有代碼必須是類型安全的
- **無 any 類型** 除非在測試文件中 (需謹慎管理)
- **Vue 3 Composition API** 優先於 Options API
- **ESLint + Prettier** 以保持格式一致

### 資料庫操作
- 使用 **Drizzle ORM** 進行所有資料庫操作
- 利用 **Cloudflare KV** 緩存頻繁訪問的數據
- 使用 **分佈式鎖** 透過 Durable Objects 協調來防止競態條件
- 始終優雅地處理資料庫錯誤
- **WebSocket 狀態管理**：使用 Durable Objects 進行有狀態的即時連接
- **事件廣播**：將資料庫操作與 WebSocket 事件分發整合
- **軟刪除模式**：對核心實體 (teams, agents, customers, conversations, messages, tags) 使用 `deletedAt` 欄位代替硬刪除
- **渠道整合**：使用 JSON 欄位 (`config`, `credentials`, `webhookConfig`, `stats`) 存儲平台特定數據 - 新增平台無需變更架構
- **敏感數據**：存儲在 `credentials` JSON 欄位中的憑證使用 `encryption-service.ts` 透過 AES-256-GCM 加密

### 認證流程
- JWT 令牌在 `src/utils/auth.ts` 中管理
- 透過 Cloudflare KV 進行會話持久化
- 路由保護位於 `frontend/src/middleware/authGuard.ts`
- 自動令牌刷新機制

### 狀態管理
- **Pinia stores** 用於所有共享狀態
- Store 組合模式用於複雜狀態
- 用於衍生狀態的響應式計算屬性
- store 內部的錯誤處理

## 關鍵功能

### **企業客戶支援系統**
- **多渠道整合**：完整的 LINE OA Webhook 整合，並計劃支援 Facebook Messenger
- **即時通訊**：**100% WebSocket** 用於即時訊息更新，搭配 Durable Objects 架構
- **簡化角色架構**：2 層角色系統 (Admin/Agent) 以簡化權限管理
- **類型安全開發**：完整的 TypeScript 實現，具有嚴格模式和全面測試
- **可擴展基礎設施**：擁有五個 Durable Objects 類別的生產級 WebSocket 基礎設施

### **進階訊息功能**
- **完整訊息系統**：17 個生產就緒的端點，具有 100% 功能覆蓋率
- **批量操作**：支援每次請求批量創建/刪除多達 100 條訊息，具有交易支援
- **附件管理**：完整的 R2 整合，具有上傳進度、多文件支援和 10MB 限制
- **訊息轉發**：將訊息轉發至多達 20 個對話，並可自定義備註
- **標籤系統**：靈活的標籤，具有統計追蹤，每條訊息最多 10 個標籤
- **數據匯出**：匯出為 JSON/CSV 格式，具有進階過濾 (1-1000 條記錄)
- **延遲訊息**：具有 1-120 秒延遲功能，使用 Cloudflare Queues
- **訊息回收**：完整的回收功能，具有全面測試 (43+ 個測試場景)
- **即時更新**：**基於 WebSocket** 的即時訊息投遞、狀態更新和線上狀態

### **企業團隊管理**
- **雙重角色架構**：
  - **系統角色**：Admin 和 Agent (全局權限)
  - **團隊角色**：成員 → 領導 → 主管 (團隊範圍權限)
- **團隊角色層級** (RBAC 第 2 階段)：
  - `member` - 查看團隊、成員和統計數據
  - `lead` - 添加/更新/移除成員
  - `supervisor` - 更新團隊設置、管理 QR 碼
- **多團隊支援** (JWT 優化)：
  - 專員可以屬於具有不同角色的多個團隊
  - JWT 緩存 `allowedTeamIds[]` 和 `teamRoles{}` 以減少 50% 的 DB 查詢
  - 團隊範圍的 WebSocket 廣播防止跨團隊數據洩漏
- **動態排序**：
  - 基於欄位的排序 (姓名、電子郵件、角色、加入時間)
  - 帶有 localStorage 持久化的拖放自定義排序
  - 系統管理員始終固定在頂部
- **成員刪除**：全面的外鍵清理 (通知、標籤、轉移、活動)
- **活動追蹤**：全面記錄和監控團隊活動

### **客戶管理**
- **多平台客戶數據**：跨 LINE OA 和計劃渠道的統一客戶檔案
- **對話歷史**：完整的對話追蹤和可搜索歷史
- **客戶洞察**：具有隱私意識設計的數據收集與管理
- **標籤管理系統**：
  - 用於客戶和對話標籤的完整 CRUD 操作
  - 支援批量操作以進行高效的標籤管理
  - 使用統計與分析追蹤
  - 具有確認對話框和 Toast 通知的專業 UI
- **整合就緒**：為多個通訊平台準備的 Webhook 處理器

### **卓越技術**
- **現代 Vue 3 前端**：Composition API、Pinia stores 和全面測試 (132+ 個測試)
- **Cloudflare Workers 後端**：具有 Hono 框架和 Drizzle ORM 的邊緣計算
- **生產就緒**：具有健康監控和部署驗證的完整 CI/CD 流水線
- **性能優化**：虛擬滾動、延遲加載和高效的數據管理
- **開發者體驗**：熱重載、TypeScript 支援和全面文檔

## 開發快速開始

> ⚠️ **重要**：此專案連接至 **遠程生產資源 (REMOTE PRODUCTION RESOURCES)**。所有資料庫和存儲操作都會影響生產數據。

1. **先決條件**：Node.js 18+、Bun 1.2+ 和具有 Wrangler CLI 的 Cloudflare 帳戶
2. **安裝依賴**：
   ```bash
   bun install
   cd frontend && bun install
   ```
3. **環境設置**：從 `.env.example` 模板配置 `.env`，填入 Cloudflare 憑證
4. **驗證遠程連接**：
   ```bash
   bun run health:check:all  # 驗證連接至生產環境
   bun run db:studio         # 開啟遠程 DB 的 Drizzle Studio
   ```
5. **開始開發**：
   ```bash
   # 終端 1 - 後端 (連接至遠程資源)
   bun run dev               # 使用遠程 D1, KV, R2 的 Wrangler 開發

   # 終端 2 - 前端
   cd frontend && bun run dev # localhost:3000 上的 Vite 開發伺服器
   ```
6. **驗證設置**：`bun run test:api` 和 `cd frontend && bun run test`

## 生產部署

### ⚠️ 部署環境政策

**此專案僅使用遠程生產資源**

- **無本地資源**：此專案不使用本地 D1, KV, 或 R2 資源
- **開發**：使用 `bun run dev`，它連接到遠程生產資源
- **生產部署**：使用 `wrangler deploy` 或 `bun run deploy` 部署到生產環境
- **無預演環境**：所有測試使用生產資源，直接部署到生產環境
- **環境配置**：參見 `wrangler.toml` - 所有配置僅用於生產環境

**重要**：請勿在 `wrangler.toml` 中添加 `[env.development]` 或 `[env.staging]` 部分。預設配置 **即是** 生產配置。所有開發操作都會影響生產數據。

### 生產基礎設施

系統已準備好生產並部署在 Cloudflare 基礎設施上：
- **自動部署**：使用 Wrangler 部署 Workers 和 Pages
- **零停機部署**：利用 Cloudflare 的邊緣網絡
- **全球分佈**：根據流量自動擴展
- **健康監控**：透過 `/api/system/health` 和 `/api/websocket/health` 端點
- **資料庫遷移**：透過 Drizzle 自動化，具有回滾功能
- **文件存儲**：透過 Cloudflare R2 進行 CDN 整合
- **域名管理**：支援自定義域名和 SSL 證書

## 故障排除

### 常見問題
- **TypeScript 錯誤**：在根目錄和前端目錄中運行 `bun run type-check`
- **測試失敗**：檢查 `frontend/vitest.setup.ts` 中的測試環境設置
- **資料庫問題**：使用 `bun run db:studio` 檢查遠程數據
- **API 連接性**：驗證 Cloudflare 憑證並運行 `bun run health:check:all`
- **連接錯誤**：確保 `wrangler` 已透過 `wrangler login` 認證

### 性能優化
- **虛擬滾動**：使用 @tanstack/vue-virtual 處理大型對話列表
- **延遲加載**：用於路由組件和繁重導入
- **代碼分割**：使用 Vite 優化 bundle 大小
- **Cloudflare KV 緩存**：用於會話數據和頻繁訪問的內容
- **資料庫優化**：使用 Drizzle ORM 和高效查詢模式
- **即時監控**：透過 WebSocket 性能指標和健康檢查
- **記憶體管理**：適當的清理和垃圾回收
- **邊緣計算**：利用 Cloudflare Workers 全球分佈
- **Durable Objects**：用於具有自動故障轉移的有狀態 WebSocket 連接

## 企業文檔

### 角色系統文檔
- **雙重角色架構**：
  - **系統角色** (2 層)：Admin 和 Agent 用於全局訪問控制
  - **團隊角色** (3 層)：成員 → 領導 → 主管用於團隊級權限
- **團隊角色強制執行** (RBAC 第 2 階段)：
  - `src/middleware/auth.ts` - `requireTeamRole()` 和 `requireTeamPermission()` 中間件
  - `src/utils/auth.ts` - `TEAM_ROLE_HIERARCHY`, `TEAM_PERMISSIONS`, `hasTeamRole()`, `canPerformTeamOperation()`
- **多團隊 JWT 緩存**：JWT payload 中的 `allowedTeamIds[]` 和 `teamRoles{}`
- 團隊功能保留 - 專員可以屬於具有不同角色的多個團隊

### 關鍵文檔文件
- 角色層級和權限系統
- 團隊管理和分配工作流程
- 現有安裝的遷移指南
- API 訪問控制和安全考量
- 前端基於角色的 UI 實現

### 訊息模組文檔
- `docs/api/MESSAGING_API_REFERENCE.md` - 所有 17 個訊息端點的完整 API 文檔
- `docs/reports/modules/MESSAGING_MODULE_ENHANCEMENT_REPORT.md` - 包含指標和測試狀態的實施報告
- 完整端點覆蓋：健康檢查、CRUD、批量操作、附件、轉發、標籤、匯出

### CORS 配置文檔
- `docs/CORS_CONFIGURATION_GUIDE.md` - **完整 CORS 配置指南**
  - 統一 CORS 架構說明
  - 如何添加新的允許域名
  - WebSocket 特定的 CORS 處理
  - CORS 監控與分析
  - 故障排除指南
  - 跨域請求的最佳實踐
- `src/config/cors.ts` - 所有 CORS 配置的單一真理來源
- `src/handlers/cors-monitoring.ts` - CORS 監控 API 端點 (僅限管理員)

**關鍵特性：**
- **統一配置**：所有 CORS 設置在一個文件中 (`src/config/cors.ts`)
- **減少 85% 代碼**：消除了 8 個文件中 121 行重複的 CORS 代碼
- **全面監控**：透過 `/api/monitoring/cors/*` 內建錯誤追蹤和分析
- **憑證支援**：完整支援經過認證的跨域請求
- **WebSocket 優化**：針對 WebSocket 升級請求和認證的特殊處理

## 系統成熟度

這是一個全面的、生產就緒的系統，具有 **企業級架構**，特點如下：

### **生產就緒實施**
- **全 TypeScript** 實施，具有嚴格模式和全面的類型覆蓋
- **132+ 個全面測試** 搭配 Vitest 確保代碼品質和可靠性
- **100% WebSocket 即時通訊** 搭配 Durable Objects 架構，用於生產級有狀態連接
- **企業部署** 在 Cloudflare Workers 和 Pages 上，具有全球分佈
- **資料庫優化** 搭配 Drizzle ORM 和 D1 進行可擴展數據管理

### **企業級特性**
- **雙重角色架構**：系統角色 (Admin/Agent) + 團隊角色 (Member/Lead/Supervisor)
- **多團隊支援** 搭配 JWT 緩存權限和團隊範圍安全性
- **基於團隊的組織** 具有完整的生命週期管理和角色委派
- **多渠道支援** 搭配 LINE OA 整合和計劃中的平台擴展
- **全面安全性** 搭配 JWT 認證、KV 會話管理和基於角色的訪問控制
- **文件管理系統** 搭配 R2 整合和上傳進度追蹤
- **動態排序系統** 搭配欄位選擇、拖放和 localStorage 持久化

### **開發者卓越性**
- **現代開發堆疊** 搭配 Vue 3、Composition API 和 Pinia 狀態管理
- **熱重載開發** 搭配 Vite 和高效構建流程
- **代碼品質強制執行** 搭配 ESLint、TypeScript 和自動化測試
- **全面文檔** 搭配清晰的設置指南和 API 參考
- **CI/CD 流水線** 搭配自動化部署和健康監控

### **可擴展架構**
- **邊緣計算** 搭配 Cloudflare Workers 以實現全球性能
- **生產級 WebSocket 基礎設施** 搭配五個 Durable Objects 類別處理有狀態連接
- **性能優化** 搭配虛擬滾動、延遲加載和高效數據模式
- **監控就緒** 搭配健康檢查、WebSocket 性能指標和部署驗證

**生產狀態**：**企業就緒，功能齊全，準備好進行擴展**

---

## 🚀 Web 安裝程式 (自託管部署系統)

**位置：** `web-installer/`
**狀態：** ✅ 生產就緒 (完成於 2025-01-28)
**目的：** 使客戶能夠零技術知識將 CRM 系統部署到自己的 Cloudflare 帳戶

### 快速概覽

**一鍵部署系統** 將複雜的手動部署轉變為 3 分鐘的自動化解決方案：
- **OAuth 認證** 搭配 Cloudflare
- **自動化配置** 所有資源 (D1, KV, R2, Queue, Worker, Pages)
- **15 步流水線** 搭配即時進度更新
- **生產就緒** 搭配 28 個通過測試 (90.6% 覆蓋率)
- **成本透明**：Cloudflare 免費層起價 $0/月

**創建的關鍵資源：**
- D1 資料庫 (5GB 免費)
- KV 命名空間 x2 (10萬次讀取/天免費)
- R2 存儲桶 (10GB 免費)
- Queue (延遲訊息)
- Worker (10萬次請求/天免費)
- Pages (無限免費)
- 26+ 個資料庫表

📖 **詳細指南：** 請參閱 [`docs/claude/WEB_INSTALLER.md`](docs/claude/WEB_INSTALLER.md) 獲取完整的架構、部署流程、文檔、安全特性和成本估算。

---

## 📚 延伸文檔

有關特定主題的詳細資訊，請參閱：

- **[文檔索引](docs/claude/INDEX.md)** - 完整導航指南
- **[環境配置](docs/claude/ENVIRONMENT_CONFIG.md)** - 3 層架構、所有環境變數、切換指南
- **[測試策略](docs/claude/TESTING.md)** - 完整測試基礎設施和最佳實踐
- **[路由註冊](docs/claude/ROUTE_REGISTRATION.md)** - 關鍵路由順序規則和調試
- **[Web 安裝程式](docs/claude/WEB_INSTALLER.md)** - 自託管部署系統文檔
- **[團隊管理](docs/claude/TEAM_MANAGEMENT.md)** - 雙重角色架構、多團隊支援、排序系統 (新)
- **[硬編碼最佳實踐](docs/HARDCODING_BEST_PRACTICES.md)** - 常數管理和編碼標準

---
