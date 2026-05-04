# 系統需求規範（SRS）

> 多渠道客服整合系統 — 系統需求規範摘要（繁體中文版）  
> **版本**: 2.0（對應 v4.0.0）  
> **最後更新**: 2026-05-04  
> **完整英文版**: [SRS.md](./SRS.md)（含完整規格、UML、ERD、部署架構圖）

---

## 1. 文件目的

本規範定義系統的技術實作需求（System Requirements），對象為架構師、後端 / 前端工程師、DevOps、QA。本繁中版聚焦摘要，細節請見英文版。

---

## 2. 主要利害關係人

| 角色 | 關注重點 |
|------|---------|
| 架構師 | 整體系統設計、模組分界、可擴展性 |
| 後端工程師 | API 規格、DB schema、Durable Objects |
| DevOps | 部署流程、CI/CD、監控告警 |
| 前端工程師 | UI 介面、Pinia store、WebSocket client |
| QA | 測試策略、覆蓋率、E2E 場景 |

---

## 3. 技術架構

### 3.1 後端（Cloudflare Workers）

| 層次 | 技術 |
|------|------|
| 路由框架 | Hono.js |
| 資料庫 | Cloudflare D1 + Drizzle ORM |
| 快取 | Cloudflare KV |
| 物件儲存 | Cloudflare R2 |
| 佇列 | Cloudflare Queues |
| 即時通訊 | WebSocket + Durable Objects（10 個 DO） |
| 認證 | JWT 雙令牌 |
| 加密 | AES-256-GCM |
| 語言 | TypeScript 5.9 strict |

### 3.2 前端（Vue 3 SPA）

| 層次 | 技術 |
|------|------|
| 框架 | Vue 3 + Composition API + `<script setup lang="ts">` |
| 狀態管理 | Pinia |
| 路由 | Vue Router |
| 建置 | Vite |
| 設計系統 | Apple-Native Soft Minimalism |
| 測試 | Vitest + Vue Test Utils |

---

## 4. 模組架構

24 個後端模組（`src/modules/`）+ 10 個 Durable Objects + 25 個前端 Views。

詳見 [`docs/CURRENT_STATUS.md`](../../CURRENT_STATUS.md) 與 [`docs/modules/INDEX.md`](../../modules/INDEX.md)。

---

## 5. 資料庫設計

- 30+ tables，採 Drizzle ORM
- 軟刪除使用 `deletedAt` 欄位
- 渠道整合 4 個 JSON 欄位（`config` / `credentials` / `webhookConfig` / `stats`）
- 角色：`agents.role` (system) + `agent_teams.role_in_team` (team)

詳見 [`docs/architecture/SCHEMA.md`](../../architecture/SCHEMA.md)。

---

## 6. 部署需求

- **REMOTE PRODUCTION ONLY**：所有資源（D1、KV、R2、DO、Queues）皆遠端，無本地模擬
- **Bun only**：禁用 npm / yarn / pnpm
- **後端部署**：`bun run deploy`
- **前端部署**：`bun run deploy:pages`
- **健康檢查**：`bun run health:check:all`
- **自助部署工具**：`web-installer/`

---

## 7. 效能需求（基準）

| 項目 | 目標 |
|------|------|
| WebSocket 建立 | < 100ms |
| 訊息延遲 P50 / P95 | < 200ms / < 500ms |
| 併發 WebSocket | 1000+ |
| Worker 冷啟動 | < 15ms |
| API 回應 P95 | < 200ms |
| 自動重連 | < 3s |

---

## 8. 安全需求

- JWT 雙令牌、自動刷新
- AES-256-GCM 渠道憑證加密
- HMAC-SHA256 Webhook 驗證（timing-safe）
- 5 次登入失敗鎖 15 分鐘
- CORS 統一管理（`src/config/cors.ts`）
- Rate Limiting（`RateLimiterDO`）
- 完整稽核日誌

詳見 [`docs/architecture/security/`](../../architecture/security/)。

---

## 9. 監控與可觀測性

- API 健康檢查（`/api/system/health`）
- `MetricsCollectorDO`：請求級指標累加（60s flush 到 KV）
- 斷路器（緊急斷流）
- 警報歷史
- 完整活動日誌

詳見 [`docs/modules/monitoring.md`](../../modules/monitoring.md)。

---

## 10. 測試策略

| 層次 | 工具 | 規模 |
|------|------|------|
| 後端單元 | Vitest | 98 檔、2,466 通過 |
| 前端單元 | Vitest + Vue Test Utils | 154 檔、3,624 通過 |
| E2E | Playwright | 規劃中擴充 |

---

## 11. 與 v3 重大差異

| 面向 | v3 | v4 |
|------|----|----|
| 即時通訊 | SSE + KV 輪詢 | WebSocket + DO |
| Durable Objects 數量 | 7 | 10（新增 RateLimiterDO + MetricsCollectorDO） |
| 系統角色 | 3 層 | 2 層 |
| 對話指派 | 個人 + 團隊 | 僅團隊 |
| 多團隊歸屬 | 受限 | 完整支援 |
| 套件管理器 | npm | Bun |

---

## 12. 相關文件

- [`SRS.md`](./SRS.md) — 完整英文版（含 UML / ERD / 部署圖）
- [`FRS.md`](./FRS.md) / [`FRS_TW.md`](./FRS_TW.md) — 功能需求規範
- [`BRD.md`](./BRD.md) / [`BRD_TW.md`](./BRD_TW.md) — 業務需求文件
- [`NFR.md`](./NFR.md) / [`NFR_TW.md`](./NFR_TW.md) — 非功能需求
- [`docs/CURRENT_STATUS.md`](../../CURRENT_STATUS.md) — 系統現況
- [`docs/architecture/`](../../architecture/) — 架構設計
