# 功能需求規範（FRS）

> 多渠道客服整合系統 — 功能需求規範摘要（繁體中文版）  
> **版本**: 2.0（對應 v4.0.0）  
> **最後更新**: 2026-05-04  
> **完整英文版**: [FRS.md](./FRS.md)（含每個 FR-ID 的詳細處理流程、邊界案例、業務規則）

---

## 1. 文件目的

本規範定義系統實作的功能需求（Functional Requirements），按模組編號（如 `FR-AUTH-001`），用於開發、測試、驗收。本繁中版聚焦摘要與重點變更，細節請見英文版。

---

## 2. 系統範圍（24 個後端模組）

| 類別 | 模組 |
|------|------|
| 對話與訊息 | conversations, messaging, delayed-message, customer-conversations, session |
| 客戶與標籤 | customer, tags, auto-reply |
| 認證與團隊 | auth, teams, agents, activities |
| 渠道整合 | integrations, liff |
| 即時通訊 | websocket, realtime, collaboration, notifications |
| 系統與營運 | system, monitoring, analytics, reports, queue, file-management |

詳見 [`docs/modules/INDEX.md`](../../modules/INDEX.md)。

---

## 3. 認證與授權

### 3.1 登入（FR-AUTH-001 ~ 003）
- Email + 密碼登入
- JWT 雙令牌（access 2 小時、refresh 7 天）
- Refresh 端點重查 DB（可感應團隊異動）
- 5 次失敗鎖 15 分鐘
- 多種雜湊相容（bcrypt / PBKDF2 / SHA256）

### 3.2 角色與權限（FR-AUTH-004，v4 重大變更）

採用「**雙層角色**」取代 v3 的 3 層階層：

**系統角色（2 層）**：
- **Admin** — 全系統存取
- **Agent** — 須透過團隊角色取得對話存取

**團隊角色（3 層，每團隊獨立）**：
- **Supervisor** — 跨團隊監看與覆蓋
- **Lead** — 團隊主管，組內派遣
- **Member** — 一般客服

**JWT Payload 內含**：`role` / `primaryTeamId` / `allowedTeamIds[]` / `teamRoles{teamId: roleInTeam}`

**重要**：
- 同一 Agent 可在不同團隊扮演不同角色
- 對話**僅指派給團隊**（v4 移除個人指派）
- 詳見 [`RBAC_DESIGN.md`](../specifications/RBAC_DESIGN.md)

### 3.3 工作階段管理（FR-AUTH-005）
- KV 儲存，24 小時 TTL
- 透過 `Session-ID` header 追蹤
- 自動重新整理機制

---

## 4. 對話管理

- **狀態**：`pending` / `in-progress` / `waiting` / `resolved`
- **指派**：僅指派給「團隊」（`assignedTeamId`）
- **轉移**：跨團隊轉移寫入 `conversationTransfers` 表
- **批次操作**：≤ 100 筆 / 次
- **轉發**：單則訊息可轉到 ≤ 20 個對話

---

## 5. 訊息核心

- **撤回**：軟刪除 + deadline（預設 5 分鐘）
- **全文搜尋**：可篩類型 / 寄件人 / 日期 / 撤回狀態
- **匯出**：JSON / CSV
- **附件**：R2 儲存、自動縮圖、EXIF 清理
- **回覆鏈**：`replyToMessageId` + `threadId`
- **@mention**：自動觸發提及通知

---

## 6. 延遲訊息

- 1-120 秒可調延遲
- DO Alarm 精準排程（取代 v3 的 KV 輪詢）
- 即時撤回（< 100ms）
- 重新排程（deadline 前）

---

## 7. 多渠道整合

- LINE OA（含 LIFF）、Facebook Messenger
- AES-256-GCM 憑證加密
- HMAC-SHA256 Webhook 簽章驗證（timing-safe）
- JSON 設定欄位（加新平台不需 schema 變動）

---

## 8. 即時通訊

- WebSocket + Durable Objects（v4 取代 v3 SSE）
- 1000+ 併發連線
- 多分頁同步、自動重連、心跳偵測

---

## 9. 自動回覆

- 規則引擎（keyword / regex / 訊息類型 / 非營業時間 / welcome）
- AND / OR 條件邏輯
- 動作鏈（文字 + 圖 + Flex Message）
- 營業時間排程（每週各日 + 時區）

---

## 10. 通知系統

- 多通道：WebSocket / Email / Push
- 11 種通知類型
- 三級優先級
- 系統公告廣播（admin）

---

## 11. 報表與分析

- Analytics 即時指標
- Reports 20+ 報表類型
- 排程 Email 寄送

---

## 12. 稽核日誌

- 所有動作自動寫入
- 角色可見性（admin 看全部、agent 看自己）

---

## 13. 與 v3 重大差異

| 面向 | v3 | v4 |
|------|----|----|
| 即時通訊 | SSE + KV 輪詢 | WebSocket + DO |
| 系統角色 | 3 層 | 2 層 |
| 對話指派 | 個人 + 團隊 | 僅團隊 |
| 多團隊 | 受限 | 完整支援 |

---

## 14. 相關文件

- [`FRS.md`](./FRS.md) — 完整英文版
- [`SRS.md`](./SRS.md) / [`SRS_TW.md`](./SRS_TW.md) — 系統需求規範
- [`BRD.md`](./BRD.md) / [`BRD_TW.md`](./BRD_TW.md) — 業務需求文件
- [`NFR.md`](./NFR.md) / [`NFR_TW.md`](./NFR_TW.md) — 非功能需求
- [`RBAC_DESIGN.md`](../specifications/RBAC_DESIGN.md) — 權限矩陣
- [`docs/modules/INDEX.md`](../../modules/INDEX.md) — 24 模組使用者手冊
