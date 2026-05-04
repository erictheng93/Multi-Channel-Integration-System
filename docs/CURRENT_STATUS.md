# 系統當前狀態 (Current Status)

> Multi-Channel Customer Support System — 即時架構快照
> **最後更新**: 2026-05-04
> **當前版本**: v4.0.0 (Enterprise-Ready WebSocket System)
> **架構**: WebSocket + Cloudflare Durable Objects（已取代 v3 的 SSE+KV）

---

## 1. 技術棧概覽

### 後端 (Cloudflare Workers)
| 層次 | 技術 | 用途 |
|------|------|------|
| 路由框架 | Hono.js | 輕量級 HTTP / WebSocket 路由 |
| 資料庫 | Cloudflare D1 (SQLite) + Drizzle ORM | 主要持久化 |
| 快取 | Cloudflare KV | 工作階段、設定、短期狀態 |
| 物件儲存 | Cloudflare R2 | 客戶上傳檔案、附件 |
| 佇列 | Cloudflare Queues | 延遲訊息、重試任務 |
| 即時通訊 | WebSocket + Durable Objects | 對話房間、廣播、狀態同步 |
| 加密 | AES-256-GCM | 渠道憑證儲存 |
| 認證 | JWT 雙重令牌 | API 與 WebSocket 共用 |
| 語言 | TypeScript 5.9 strict | 0 `any`、完整型別 |

### 前端 (Vue 3 Application)
| 層次 | 技術 |
|------|------|
| 框架 | Vue 3 + Composition API + `<script setup lang="ts">` |
| 狀態 | Pinia |
| 路由 | Vue Router |
| 建置 | Vite |
| 測試 | Vitest + Vue Test Utils（jsdom） |
| 設計系統 | Apple-Native Soft Minimalism（見 `docs/UIUX-Design-System.md`） |

---

## 2. 模組架構

### 後端模組 (25 個領域模組，位於 `src/modules/`)

| 類別 | 模組 |
|------|------|
| 對話與訊息 | `conversations`, `messaging`, `delayed-message`, `customer-conversations` |
| 客戶與標籤 | `customer`, `tags`, `auto-reply` |
| 認證與團隊 | `auth`, `teams`, `agents`, `session` |
| 渠道整合 | `integrations`, `liff` |
| 即時通訊 | `websocket`, `realtime`, `collaboration`, `notifications` |
| 系統與營運 | `system`, `monitoring`, `analytics`, `reports`, `activities`, `queue`, `file-management` |

### Durable Objects (10 個，位於 `src/durable-objects/` + `src/services/`)

| Class Name (wrangler 綁定) | 實作檔案 | 用途 |
|---|---|---|
| `ConversationRoom` | `durable-objects/ConversationRoom.ts` | 對話房間狀態（成員、打字、線上） |
| `UserConnection` | `durable-objects/UserConnection.ts` | 單一用戶的 WebSocket 連線管理 |
| `MessageBroadcaster` | `durable-objects/MessageBroadcaster.ts` | 跨房間廣播訊息 |
| `DelayedMessageBuffer` *(alias)* | `durable-objects/DelayedMessageScheduler.ts` | 延遲訊息排程器（綁定名與檔名不同） |
| `LockCoordinator` | `services/distributed-lock-service.ts` | 分散式鎖（注意：不在 DO 資料夾） |
| `LatestMessageCacheCoordinator` | `durable-objects/LatestMessageCacheCoordinator.ts` | 最新訊息快取一致性協調 |
| `CustomerConversationDO` | `durable-objects/CustomerConversationDO.ts` | 客戶側對話狀態（Chat Project 啟發） |
| `CustomerMessageDO` | `durable-objects/CustomerMessageDO.ts` | 客戶側訊息流 |
| `RateLimiterDO` | `durable-objects/RateLimiterDO.ts` | 全域 API 速率限制 |
| `MetricsCollectorDO` | `durable-objects/MetricsCollectorDO.ts` | 即時效能指標收集（v4 新增） |

> **DO 命名小注**：`DelayedMessageScheduler` 透過 `src/index.ts:846` 用 alias 對外暴露為 `DelayedMessageBuffer`，以維持 `wrangler.toml` 既有綁定不破壞遷移狀態。

---

## 3. 角色系統

### 系統角色 (System Role) — 已於 2025-10-20 簡化
```
Admin   — 全權管理（系統設定、所有團隊、所有對話）
Agent   — 客服人員（依團隊範圍工作）
```
> 舊版 `team` 系統角色已移除，相關權限轉由「團隊角色」承擔。

### 團隊角色 (Team Role) — 仍保留階層
```
Member       — 一般成員，處理自己被指派的對話
Lead         — 團隊主管，可指派成員、轉移對話
Supervisor   — 督導，跨團隊監看與覆蓋
```
JWT payload 包含 `primaryTeamId`、`allowedTeamIds[]`、`teamRoles{teamId: role}`，支援多團隊歸屬。

---

## 4. 已完成功能（Production Ready）

| 領域 | 能力 |
|------|------|
| 即時通訊 | WebSocket + DO，1000+ 併發，P95 < 500ms |
| 多渠道 | LINE OA 完整整合；Facebook Messenger API 架構就緒 |
| 對話生命週期 | 待處理 / 處理中 / 已結束、指派、轉移、歷史 |
| 延遲訊息 | 1–120 秒精準排程、可撤回、企業級操作日誌 |
| 認證 | JWT + 自動刷新 + 多標籤頁同步 + 跨團隊 RBAC |
| 檔案附件 | R2 儲存、MIME 白名單、JWT 存取控制 |
| 標籤系統 | 客戶與對話標籤、conversationCount 統計 |
| 自動回覆 | 規則型自動回覆、平台分流 |
| 通知 | 桌面 / 瀏覽器 / WebSocket 即時推送 |
| 報表與分析 | 16 種報表類型、樣本資料生成器、團隊 / 渠道維度 |
| 系統設定 | 訊息佇列、快取、會話、平台連線、備份還原 |
| 監控 | API 健康檢查、效能指標、MetricsCollectorDO |
| 活動日誌 | 完整操作追蹤 + WebSocket 即時推送 |
| 自助部署 | `web-installer/` 視覺化部署工具 |

---

## 5. 計畫中（Roadmap）

- AI 客服助手（規劃中）
- 多語言國際化（規劃中）
- Facebook Messenger 最終整合驗收
- Instagram / WhatsApp / Telegram 渠道擴充

---

## 6. 程式碼品質指標（截至 2026-05-04）

| 指標 | 數值 |
|------|------|
| 後端測試 | 98 檔案、2,466 通過（CI 子集 100%） |
| 前端測試 | 154 檔案、3,624 通過（100%） |
| TypeScript 嚴格模式 | 0 錯誤 |
| ESLint | 全通過 |

---

## 7. 效能基準（v4.0.0 WebSocket）

| 項目 | 目標 |
|------|------|
| WebSocket 建立 | < 100ms |
| 訊息延遲 P50 / P95 | < 200ms / < 500ms |
| 併發 WebSocket | 1000+ |
| Worker 冷啟動 | < 15ms |
| API 回應 P95 | < 200ms |
| 前端首次載入 | < 3s |
| 自動重連 | < 3s |
| 故障恢復 | < 60s |

---

## 8. 與舊版（v3.0.x）的關鍵差異

| 面向 | v3.0.1 (2025-08-26) | v4.0.0 (現行) |
|------|---------------------|---------------|
| 即時通訊 | SSE (Server-Sent Events) + KV 輪詢 | WebSocket + Durable Objects |
| 狀態管理 | KV 鍵值快取 | Durable Objects 強一致 |
| 併發上限 | ~200 | 1000+ |
| 延遲訊息 | KV 輪詢觸發 | DO Alarm 精準排程 |
| 訊息延遲 | P95 ~ 2s | P95 < 500ms |
| 系統角色 | 3 層（Admin/Team/Agent） | 2 層（Admin/Agent） |

> 如需查閱 v3 歷史架構，見 `docs/history/`。
