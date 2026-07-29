# 多渠道客服整合系統 (Multi-Channel Customer Support System)

 Cloudflare Workers  Vue 3 ** Drizzle ORM**** Cloudflare KV** ** API 監控**

![Vue](https://img.shields.io/badge/Vue-3.5-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![Bun](https://img.shields.io/badge/Bun-1.3-blueviolet.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-green.svg)
![Cloudflare KV](https://img.shields.io/badge/Cloudflare-KV-blue.svg)
![Tests](https://img.shields.io/badge/Tests-Updated%20on%20verification-brightgreen.svg)
![Build Status](https://img.shields.io/badge/Build-Verify%20with%20CI-yellow.svg)
![Readiness](https://img.shields.io/badge/Readiness-Code%20reviewed-yellow.svg)

 **開發者入口**
- **快速部署** `bun run deploy`（後端）/ `bun run deploy:pages`（前端）
- **工作區邊界** [Workspace Boundaries](docs/WORKSPACE_BOUNDARIES.md) - Root 與 frontend 的 Bun package 邊界
- **本文件** (README.md) - 完整技術文件與架構說明
- **API 文件** [ API 參考](docs/reference/api/API_REFERENCE.md) - 完整 API 端點文件
- **自動部署** Web Installer 自助部署工具（`web-installer/`）

 **使用者入口**
- **使用指南** [ 使用者指南](docs/guides/USER_GUIDE.md) - 完整使用與操作指南
- **快速開始** [ 快速開始](docs/guides/QUICK_START.md) - 5 分鐘快速上手

##  目錄

- [ 多渠道客服整合系統 - 功能特色](#-功能特色)
- [架構設計](#架構設計)
- [先決條件](#先決條件)
- [環境配置系統](#環境配置系統-environment-configuration)
- [安裝部署](#安裝部署)
- [部署方式](#部署方式)
- [API 監控](#api-監控)
- [系統狀態](#系統狀態)
- [專案結構](#專案結構)
- [API 端點](#api-端點)
- [環境變數](#環境變數)
- [常見問題](#常見問題)

##  功能特色

企業級多渠道客服整合系統，統一管理 LINE OA、Facebook Messenger 等平台的客戶訊息，核心技術為 Cloudflare Workers (Hono) + Vue 3 + Durable Objects 全雲端即時架構。

**功能範圍導覽**（多渠道整合、對話與訊息管理、WebSocket 即時協作、延遲訊息、通知系統、JWT 雙令牌認證與雙層角色權限、檔案附件、團隊與客戶管理、自動回覆、報表分析、系統管理與 Web Installer 自助部署）——**完整清單、每一項的實際完成度（✅/⚠️/❌）與對應程式碼路徑，一律以 [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) 為單一事實來源**，本文件不重複維護一份平行的功能清單或精準對照表，避免兩處說法不一致。

> 本文件曾經內建過一份「功能敘述精準對照」表（2026-05-21 稽核），現已併入並擴充為 `docs/PROJECT_OVERVIEW.md` 的逐項狀態標註（2026-07-29，81 項宣稱逐一對照程式碼核實）。若你手上還留著舊版 README 的複本，其中的完成度資訊已過時，請改看該文件。

## 架構設計

```
┌─────────────────┐ ┌──────────────────────┐ ┌─────────────┐
│ Vue 3 前端 │◄──►│  Cloudflare Workers │◄──►│  外部 API │
│  (TypeScript) │    │  (Hono + 26 模組) │    │  (LINE/FB)  │
└────────┬────────┘ └──────────┬───────────┘ └─────────────┘
         │ │
         │ ┌─────────┴──────────┐
         │ │   Cloudflare 平台 │
         │ ├────────────────────┤
         │ │  D1 KV R2 │
         │ │ (資料庫)(快取)(儲存) │
         │ ├────────────────────┤
         │ │ Durable Objects ×12 │
         │ │ (即時通訊/狀態管理) │
         │ └────────────────────┘
         │
    ┌────┴─────────────┐
    │  Web Installer │
    │  (自助部署工具) │
    └──────────────────┘
```

### 後端技術棧 (Cloudflare Workers)
- **框架**: Hono.js (輕量級路由框架)
- **資料庫**: Cloudflare D1 (SQLite) + Drizzle ORM
- **快取**: Cloudflare KV (分散式快取)
- **儲存**: Cloudflare R2 (S3 相容儲存)
- **即時通訊**: WebSocket + Durable Objects
- **認證**: JWT + 雙重令牌
- **監控**: API 健康檢查系統

### 前端技術棧 (Vue 3 Application)
- **框架**: Vue 3 + Composition API + TypeScript
- **狀態管理**: Pinia + 響應式資料同步
- **優質 UI/UX**: 響應式設計 + 無障礙支援
- **完整測試**: Vitest + 以實際報告為準
- **建置優化**: Vite + 代碼分割
- **即時通訊**: WebSocket 客戶端

## 先決條件

- Bun 1.0+（[https://bun.sh](https://bun.sh)）
- Wrangler CLI (Cloudflare 部署工具)
- Cloudflare API Token
- LINE Developer 帳號（如需 LINE OA 整合）

## 環境配置系統 (Environment Configuration)

本系統採用 **3 層架構模式** 管理環境配置，實現開發到生產無縫切換。

### 配置架構層次
```
第 1 層：環境變數 (.env 檔案)
    ↓
第 2 層：執行時配置層 (runtime.ts)
    ↓
第 3 層：業務邏輯程式碼
```

### 前端環境變數
配置檔案位置：`frontend/`
- `.env.development` - 開發環境配置
- `.env.production.example` - 生產環境變數範本；正式值由 CI / Cloudflare Pages 變數提供
- `.env.example` - 環境變數範本（含完整說明）

**關鍵環境變數：**
```bash
VITE_BACKEND_URL=https://your-api-domain.example.com
VITE_FRONTEND_URL=http://localhost:5173
VITE_WEBSOCKET_URL=wss://your-api-domain.example.com/ws
VITE_STORAGE_PUBLIC_URL=https://your-storage-domain.example.com
VITE_ENV=development
VITE_DEBUG=true
```

### 後端環境變數
配置檔案：`.dev.vars`（本地環境）
```bash
BACKEND_URL=http://localhost:8787
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
ENVIRONMENT=development
```

### 執行時配置函數
系統提供統一配置取得介面：

**前端 (`frontend/src/config/runtime.ts`):**
```typescript
import { getBackendUrl, getWebSocketUrl, getApiEndpoint } from '@/config/runtime';

// 取得後端 API URL
const apiUrl = getBackendUrl();

// 取得 WebSocket URL（自動協議切換）
const wsUrl = getWebSocketUrl();

// 取得完整 API 端點
const endpoint = getApiEndpoint('/api/messages');
```

**後端 (`src/config/runtime.ts`):**
```typescript
import { getBackendUrl, getFrontendUrl } from './config/runtime';

// 在 Handler 中使用
export default {
  async fetch(request: Request, env: WorkerEnv) {
    const backendUrl = getBackendUrl(env);
    const frontendUrl = getFrontendUrl(env);
  }
}
```

### 環境切換步驟
**切換到開發環境：**
1. 複製 `frontend/.env.development` 為 `frontend/.env`
2. 修改 URL 為本地地址
3. 執行 `bun run dev`

**切換到生產環境：**
1. 以 `frontend/.env.production.example` 為參考，在 CI / Cloudflare Pages 設定正式環境變數
2. 執行 `bun run build` 後部署

### 優勢
 **快速切換** - 5-10 秒完成環境切換（相較傳統 4-6 小時）
 **類別安全** - 完整的 TypeScript 類型定義
 **無硬編碼** - 所有 URL 統一管理
 **自動驗證** - 啟動時配置驗證與錯誤提示

---

## 安裝部署

### 1. 快速開始 (5 分鐘)
```bash
# 1. 複製專案
git clone <repository-url>
cd Multi_Channel_Integration_System

# 2. 安裝依賴
bun install

# 3. 登入 Cloudflare
wrangler login
```

### 2. 本地開發

```bash
# 後端開發（連接遠端資源）
bun run dev

# 前端開發（另開終端）
cd frontend
bun run dev
```

>  **注意**：所有開發環境均連接遠端 Cloudflare 資源（D1、KV、R2、Durable Objects），無本地模擬環境。

## 部署方式

### 後端部署 (Cloudflare Workers)
```bash
# 部署後端
bun run deploy

# 執行資料庫遷移
bun run db:migrate
```

### 前端部署 (Cloudflare Pages)
```bash
cd frontend

# 建置並部署
bun run build
bun run deploy:pages
```

### 自助部署工具 (Web Installer)
專案內建 Web Installer（`web-installer/`），提供視覺化的自助部署流程：
- 瀏覽器操作介面，無需命令列
- 引導式配置填寫
- 自動化部署流程

### 驗證部署
- **後端 API**: https://your-api-domain.example.com
- **前端**: https://mcis-ey7.pages.dev
- **API 健康檢查**: `bun run health:check:all`

## API 監控
API 監控系統提供全面的服務監控能力：

**監控功能：**
- **健康檢查** - 主要 API 端點即時監控
- **錯誤追蹤** - 自動記錄與分類錯誤
- **效能指標** - 回應時間與吞吐量監控
- **告警系統** - API 異常自動通知

**狀態判定：**
- **健康** - 回應時間 < 1 秒且狀態碼 200-299
- **警告** - 回應時間 > 1 秒或認證問題 (401)
- **錯誤** - 5xx 伺服器錯誤
- **離線** - 無法連線到 API

**監控流程：**
1. 系統定期發送健康檢查請求
2. 記錄 API 回應時間與狀態
3. 檢測異常模式與趨勢
4. 觸發告警通知
5. 生成 API 狀態報告

**技術細節：**
- **執行環境**: Cloudflare Workers
- **監控範圍**: 所有 Worker 端點
- **資料儲存**: 監控資料快取在 KV
- **健康端點**: `/api/system/health`

## 系統狀態

### 當前版本: v4.0.0 (Enterprise-Ready WebSocket System)

#### 已完成功能（程式碼層級已完成，仍需以 CI / 部署驗證）
> 下方為粗略導覽；每一項的實際完成度、已知落差與程式碼佐證，請見 [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md)。例如：延遲訊息實際是全域 5 檔設定（非逐則 1-120 秒可調）、Facebook 目前只有收訊沒有送訊——都已在該文件標註清楚，這裡不重複列出完成度。
-  **WebSocket + Durable Objects 即時通訊** - 核心能力已上線
-  **分散式鎖定** - Durable Objects 協調
-  **全局狀態管理** - Durable Objects 持久化
-  **自動故障恢復** - 斷線自動重連
-  **延遲訊息排程** - DO Alarm 精準排程（可調範圍見 PROJECT_OVERVIEW.md）
-  **即時狀態廣播** - WebSocket 多用戶同步
-  **完整監控系統** - 健康檢查與效能指標
-  **多渠道整合** - LINE OA 完整雙向；Facebook Messenger 目前僅收訊（送訊路徑未接通，見 PROJECT_OVERVIEW.md §1）
-  **認證系統** - 雙重角色 RBAC + WebSocket 安全認證
-  **標籤系統** - 分類管理與對話統計
-  **前端應用** - Vue 3 + TypeScript + WebSocket
-  **API 標準化** - 統一回應格式
-  **活動紀錄** - 完整操作追蹤 + WebSocket 即時推送

#### 計劃中功能
-  **AI 客服助手** - Chat 智慧輔助（規劃中）
-  **進階分析** - 數據分析儀表板（開發中）
-  **多語言支援** - 國際化（規劃中）

### 程式碼品質
- **測試覆蓋**: 依實際執行環境驗證（建議以 `bun run test:backend:ci` 與 `cd frontend && bun run test:run` 結果為準）
- **TypeScript**: 嚴格模式 0 錯誤
- **ESLint**: 所有規則通過
- **類型安全**: 完整類型定義

### 效能指標 (WebSocket System)
> ⚠️ 以下為設計目標，非已驗證的上線數據。專案內唯一一份壓測報告（`docs/history/reports/websocket/WEBSOCKET_LOAD_TEST_REPORT_2025-10-08.md`）測到 100 併發、P95 1795ms，尚未達到下方目標，也還沒有 1000+ 併發的測試紀錄。引用效能數字前請先看該報告。
- **WebSocket 連線**: 規格目標為低延遲（未綁定固定 SLA）
- **訊息延遲**: 目標 P95 < 500ms（實測未達，見上方壓測報告）
- **併發連線**: 依壓測結果維持
- **訊息吞吐**: 依壓測結果維持
- **Worker 冷啟動**: 需以環境實測為準
- **API 回應**: 以 API 監控結果為主
- **前端載入**: 以正式環境量測為準
- **WebSocket 重連**: 已支援自動重連（量測值待補）
- **故障恢復**: 以監控與演練結果為主

## 專案結構

```
Multi_Channel_Integration_System/
├── src/ # 後端 (Cloudflare Workers)
│ ├── index.ts # Worker 進入點
│ ├── modules/ # 26 個領域模組（含 broadcast/、data/，未列於下方樹狀圖，數字以 docs/PROJECT_OVERVIEW.md 為準）
│ │   ├── auth/handlers/ # 認證系統
│ │   ├── auto-reply/ # 自動回覆
│ │   ├── conversations/handlers/  # 對話管理
│ │   ├── messaging/handlers/ # 訊息處理
│ │   ├── teams/handlers/ # 團隊管理
│ │   ├── customer/handlers/ # 客戶管理
│ │   ├── system/handlers/ # 系統設定
│ │   ├── tags/handlers/ # 標籤系統
│ │   ├── websocket/handlers/ # WebSocket 管理
│ │   ├── delayed-message/ # 延遲訊息
│ │   ├── integrations/ # 渠道整合
│ │   ├── reports/ # 報表系統
│ │   ├── analytics/ # 數據分析
│ │   ├── notifications/ # 通知系統
│ │   ├── session/ # 會話管理
│ │   ├── agents/ # 客服代理
│ │   ├── collaboration/ # 協作功能
│ │   ├── file-management/ # 檔案管理
│ │   ├── monitoring/ # 監控系統
│ │   ├── realtime/ # 即時功能
│ │   ├── queue/ # 佇列處理
│ │   ├── activities/ # 活動紀錄
│ │   ├── customer-conversations/  # 客戶對話
│ │   └── liff/ # LINE LIFF
│ ├── durable-objects/ # 12 個 DO 相關檔案（含 LockCoordinator 在 services/）
│ │   ├── ConversationRoom.ts
│ │   ├── UserConnection.ts
│ │   ├── MessageBroadcaster.ts
│ │   ├── DelayedMessageScheduler.ts (binding: DelayedMessageBuffer)
│ │   ├── LatestMessageCacheCoordinator.ts
│ │   ├── CustomerConversationDO.ts
│ │   ├── CustomerMessageDO.ts
│ │   ├── RateLimiterDO.ts
│ │   ├── user-connection-security.ts
│ │   ├── user-connection-state.ts
│ │   ├── user-subscription-manager.ts
│ │   ├── MetricsCollectorDO.ts                       # 即時指標收集 (v4)
│ │   └── (LockCoordinator → src/services/distributed-lock-service.ts)
│ ├── services/ # 40+ 共用服務
│ ├── middleware/ # Auth, CORS 等中介層
│ ├── db/schema.ts # Drizzle ORM 資料庫綱要
│ ├── config/ # 執行時配置
│ └── constants/ # 常數定義
├── frontend/ # Vue 3 前端應用
│ └── src/
│ ├── views/ # 21 個頁面元件
│ ├── components/ # 可重用 UI 元件
│ ├── stores/ # 11 個 Pinia stores
│ ├── services/ # WebSocket 客戶端、同步
│ ├── api/ # API 客戶端函數
│ └── config/runtime.ts # 前端執行時配置
├── tests/ # 後端測試
├── frontend/tests/ # 前端測試
├── web-installer/ # 自助部署工具
├── scripts/ # 120+ 自動化腳本
├── docs/ # 技術文件
└── wrangler.toml # Cloudflare Workers 配置
```

## API 端點

### 主要 API 端點
- `GET /api/system/health` - 系統健康檢查
- `GET /api/system/api-status` - API 狀態監控（含歷史紀錄）
- `POST /api/auth/login` - 用戶登入
- `GET /api/conversations` - 對話列表
- `GET /api/teams/members` - 團隊成員
- `POST /api/delayed-messages/send` - 延遲訊息
- `POST /api/delayed-messages-v2/send` - Durable Objects 延遲訊息

### API 監控系統
API 監控系統提供完整的服務監控能力：
- **自動監控** - 主要 API 端點即時監控
- **狀態追蹤** - 健康/警告/錯誤三級狀態
- **效能分析** - 回應時間追蹤
- **歷史資料** - 完整監控記錄

## 安全機制

- **JWT Token** - 所有 API 請求需攜帶 JWT 認證令牌
- **雙重角色系統** - 系統角色 (Admin/Agent) + 團隊角色 (Member → Lead → Supervisor)
- **資料加密** - 敏感資料 AES-256-GCM 加密儲存

## 環境變數

**後端 (Cloudflare Workers)**:
```bash
ENVIRONMENT=production
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key
```

**前端 (Cloudflare Pages)**:
```bash
VITE_BACKEND_URL=https://your-api-domain.example.com
VITE_WEBSOCKET_URL=wss://your-api-domain.example.com
VITE_STORAGE_PUBLIC_URL=https://your-storage-domain.example.com
VITE_ENV=production
VITE_DEV_MODE=false
```

### 資源需求
- **D1 資料庫** - 自動建立
- **KV 命名空間** - 自動建立
- **R2 儲存桶** - 自動建立

### LINE OA 設定
1. 在 LINE Developers Console 建立 Messaging API 頻道
2. 設定 Webhook URL: `https://your-domain.com/api/webhook`
3. 取得 Channel Access Token 和 Channel Secret
4. 在環境變數中設定對應值

## 常見問題

**Q: 如何部署系統？**
A:
- 後端部署：`bun run deploy`
- 前端部署：`cd frontend && bun run deploy:pages`
- 自助部署：使用 `web-installer/` 視覺化工具

**Q: 部署失敗怎麼辦？**
A:
1. 檢查 Cloudflare 認證：`wrangler whoami`
2. 確認環境變數已正確設定
3. 檢查網路連線
4. 查看 API 健康狀態

**Q: 如何進行部分部署？**
A:
```bash
# 僅部署後端
bun run deploy

# 僅部署前端
cd frontend && bun run deploy:pages
```

**Q: API 監控顯示異常？**
A:
1. 確認後端服務正常運行
2. 檢查網路連線狀態
3. 查看 API 回應狀態碼
4. 使用健康端點檢查：`/api/system/health`

**Q: 如何管理團隊權限？**
A:
1. 以 Admin 帳號登入系統
2. 進入團隊管理頁面
3. 設定成員角色（Member/Lead/Supervisor）
4. 指派團隊與權限範圍

**Q: 如何執行測試？**
A:
```bash
# 前端測試
cd frontend
bun run test # 互動式測試
bun run test:run # 單次執行
bun run test:coverage # 覆蓋率報告

# 後端型別檢查
bun run build # TypeScript 編譯檢查

# 完整檢查
bash scripts/check.sh # 後端 + 前端
```

**Q: 如何查看系統日誌？**
A:
1. 在 Cloudflare Dashboard 中進入 Workers & Pages 找到對應 Worker
2. 點擊 Logs 查看即時日誌
3. 使用 API 監控面板查看歷史記錄

---

## 文件導航

### 基礎文件
- [**專案總覽（功能單一事實來源）**](docs/PROJECT_OVERVIEW.md) - 14 大功能模組逐項標註 ✅/⚠️/❌ 完成度與程式碼佐證
- [文件總索引](docs/reference/DOCUMENTATION_INDEX.md) - 完整文件檔案架構導覽
- [Claude 開發指南](CLAUDE.md) - Claude Code 專用開發指引
- [使用者指南](docs/guides/USER_GUIDE.md) - 完整使用與操作指南
- [快速開始](docs/guides/QUICK_START.md) - 5 分鐘快速上手

### 系統架構
- [WebSocket 最終架構](docs/architecture/websocket/WEBSOCKET_FINAL_ARCHITECTURE.md) - WebSocket 系統完整設計
- [路由註冊順序](docs/architecture/ROUTE_REGISTRATION_ORDER.md) - 關鍵路由配置指南
- [模組依賴圖表](docs/architecture/MODULE_DEPENDENCY_DIAGRAM.md) - 系統模組依賴圖

### API 文件
- [API 端點總覽](docs/reference/api/API_REFERENCE.md) - 所有 API 端點文件
- [訊息 API](docs/reference/api/MESSAGING_API_REFERENCE.md) - 完整訊息系統 API

### 部署指南
- [部署指南](docs/guides/DEPLOYMENT_GUIDE.md) - 完整部署流程
- [Cloudflare Pages 部署](docs/guides/CLOUDFLARE_PAGES_DEPLOYMENT.md) - 前端部署指南

### 測試與優化
- [測試指南](docs/development/testing/testing-guide.md) - 完整測試策略
- [效能優化指南](docs/guides/PERFORMANCE_OPTIMIZATION_GUIDE.md) - 系統效能優化指南
- [負載測試](docs/architecture/performance/LOAD_TESTING_GUIDE.md) - 負載測試指南

**感謝使用本系統！如果覺得有幫助，請給個  Star**
