# SPEC — 延遲發送 + 真實撤回窗口（Recall Window）

> 狀態：待審核 | 版本：v1.0 (2026-07-02)
> 任務拆解：[PHASE-1-BACKEND.md](./PHASE-1-BACKEND.md) / [PHASE-2-FRONTEND.md](./PHASE-2-FRONTEND.md) / [PHASE-3-CLEANUP.md](./PHASE-3-CLEANUP.md)

---

## 1. 目標（Objective）

讓客服訊息在真正推送到 LINE / Facebook 之前，先進入一段**管理員可設定的可撤回窗口**（關閉 / 30 秒 / 1 分鐘 / 2 分鐘 / 5 分鐘）。窗口內撤回的訊息**永遠不會**送達客戶；窗口結束後才實際呼叫平台 API 發送。

### 1.1 要解決的問題（已驗證的現況缺陷）

| # | 缺陷 | 證據 |
|---|------|------|
| P1 | 客服送出訊息後毫秒級直推 LINE（`waitUntil` 背景發送，無任何緩衝） | `src/modules/conversations/handlers/conversation-messages.ts:420-422` → `src/modules/conversations/services/message-service.ts:339` |
| P2 | 「撤回」只改 DB + WebSocket 廣播，對已送達的 LINE 訊息無效（LINE 無 unsend API） | `src/modules/messaging/services/message-recall-service.ts:215-230` |
| P3 | 撤回時反而**多推一則**「This message has been recalled」給客戶 | `message-recall-service.ts:219-223` |
| P4 | 一般訊息 `recallDeadline` 恆為 `null`，任何時候都能按撤回，造成「撤回有效」的假象 | `message-service.ts:35`、`conversation-messages.ts:874` |
| P5 | 現成的 `DelayedMessageScheduler` DO（Alarm 排程 + 即時取消）從未接上主發送路徑 | `message-service.ts` 全檔無任何 scheduler 引用 |

### 1.2 使用者

- **管理員**：設定全系統可撤回窗口時長。
- **客服人員**：送出訊息後在窗口內可撤回；看得到倒數與訊息狀態。
- **終端客戶（LINE/FB）**：窗口內被撤回的訊息完全無感；不再收到「已撤回」通知訊息。

---

## 2. 核心功能與驗收標準（Acceptance Criteria）

### F1 管理員可設定撤回窗口
- [ ] 系統設定新增 `recall_window_seconds`，合法值 `0 | 30 | 60 | 120 | 300`，預設 `0`（關閉，行為與現況完全相同）。
- [ ] 持久化於既有 `system_settings` key-value 表（`src/db/schema.ts:281-286`）。**注意：現有 `updateSettings` 是不落庫的 stub（`system-service.ts:335-354`），必須補真實持久化。**
- [ ] 僅 `admin` 角色可修改；非法值回 400。
- [ ] 設定變更即時生效於**之後送出**的訊息；已在緩衝中的訊息維持送出當下快照的 deadline。

### F2 緩衝發送（窗口 > 0 時）
- [ ] 客服送出 → 訊息立即入庫（`deliveryStatus='buffered'`、`isSent=false`、`recallDeadline=now+窗口`），並即時 WebSocket 廣播給所有客服（含緩衝截止時間）。
- [ ] 同時向 `DelayedMessageScheduler` DO（`idFromName(conversationId)`）排程，delay = 窗口秒數。
- [ ] Alarm 到期 → 執行與現行 `processBackgroundSending` **等價**的完整發送（含文字、圖片、附件 Flex、5 則分批），更新 `deliveryStatus='sent'/'failed'/'partial'`、`isSent`、`sentAt`，並廣播狀態更新事件。
- [ ] DO 排程呼叫失敗 → **降級為立即發送**（走現行路徑）並記 error log；不得讓訊息卡死不發。
- [ ] 窗口 = 0 → 完全走現行立即發送路徑，行為零變化。

### F3 真實撤回（窗口內）
- [ ] 窗口內撤回：先呼叫 DO `/cancel`，成功後才標記 `isRecalled=true` 並廣播 —— 客戶端**零訊息**送達。
- [ ] 撤回競態：撤回與 Alarm 派送同時發生時，以 DO 為唯一裁決者（同一 DO 實例單執行緒序列化；`cancel` 在 `now >= scheduledAt` 時已拒絕，見 `src/durable-objects/delayed-message/schedule-manager.ts:166-168`）。cancel 失敗 → 撤回請求回 400「已超過可撤回時間」。
- [ ] 已送達（`isSent=true`）的 LINE 訊息：撤回一律拒絕，錯誤訊息明確告知「LINE 已送達的訊息無法撤回」。**不得再假裝成功。**
- [ ] 移除 P3 行為：撤回時不再推送「This message has been recalled」給 LINE 客戶（FB 已送達訊息仍可走 Graph API 真刪除，該分支保留）。

### F4 前端體驗
- [ ] 緩衝中的訊息氣泡顯示倒數標記（如「可撤回 0:28」）與「發送中」狀態；到期收到 WS 事件後轉為「已送達」。
- [ ] 撤回選項只在可撤回時顯示（緩衝中 或 FB 已送達）；LINE 已送達訊息隱藏/停用撤回。
- [ ] 管理員設定頁提供下拉選單：關閉 / 30 秒 / 1 分鐘 / 2 分鐘 / 5 分鐘。

---

## 3. 架構決策（Decisions）

### D1 — 統一投遞服務（最關鍵）
DO 現有的 `sendLineMessage`（`src/durable-objects/delayed-message/retry-handler.ts:80-115`）**只支援純文字**，而主路徑支援附件/圖片/Flex/分批。**禁止**在 DO 內複製一份發送邏輯。

作法：從 `processBackgroundSending`（`message-service.ts:172-`）抽出共用的 **`MessageDeliveryService.deliver(messageId)`**：從 D1 讀訊息 + 附件 → 組平台訊息 → 推送 → 更新狀態 → 廣播。之後：

```
窗口=0：handler → waitUntil(deliver(messageId))          ← 行為同現況
窗口>0：handler → DO.schedule({messageId, delay})
        DO.alarm() → deliver(messageId)                  ← DO 只當「可取消的計時器」
```

DO 排程 payload 精簡為 `{messageId, conversationId, delaySeconds}` —— 內容與附件留在 D1，單一事實來源。

### D2 — 冪等性改為「狀態判斷」
DO 現有冪等檢查是「messages 表存在該列＝已發送」（`retry-handler.ts:49-71`），與「先入庫再緩衝」直接衝突（會永遠跳過發送）。新流程的冪等：`deliver()` 開頭讀取該列，`isRecalled=true` 或 `isSent=true` → 跳過。

### D3 — DO 延遲上限 120s → 300s
上限硬編碼散落 5 處，需同步修改：`DelayedMessageScheduler.ts:267-270`、`infrastructure/ValidationService.ts:99-116`、`handlers/delayed-message-buffer.ts:48,58-60`、`controllers/DelayedMessageController.ts:184,342-346`、`messaging/services/delayed-message-service.ts:52`。統一改為引用 `src/constants/limits.ts` 新常數 `MAX_RECALL_WINDOW_SECONDS = 300`。

### D4 — 訊息狀態機
`delivery_status` 為純 text 欄位、無 CHECK 約束（`schema.ts:131`），新增 `'buffered'` 值**不需 DB migration**，僅需更新 TS 型別聯集。

```
                    ┌──────────┐
   送出(窗口>0) ───→ │ buffered │──窗口內撤回──→ recalled（isRecalled=true，未送出）
                    └────┬─────┘
                         │ Alarm 到期
                         ▼
   送出(窗口=0) ───→ pending ──→ sent / partial / failed
                                  │
                                  └─ LINE：不可撤回（拒絕）
                                     FB：Graph API 刪除（現行保留）
```

### D5 — 設定讀取路徑
每次送訊息都要讀窗口值 → D1 讀取加 KV 快取（TTL 60s，沿用 `src/config/kv-config.ts` 模式）。設定更新時主動清除 KV 快取。

### D6 — 三套延遲實作收斂
只保留 **DO 路徑（實作 A）**。實作 B（`delayed-message` 模組 D1+KV，無派送觸發器）與實作 C（`messaging/services/delayed-message-service.ts`，`processDelayedSend` 無呼叫者）為死路徑，Phase 3 淘汰。

---

## 4. 邊界（Boundaries）

**Always（一律遵守）**
- 編輯任何 symbol 前先跑 codebase-memory-mcp 影響分析（`trace_path(function_name)` / `search_graph`），HIGH 影響先回報。
- TypeScript strict、禁 `any`；後端 `tsc --noEmit`、前端 `bunx vue-tsc --noEmit`（絕不對 frontend 跑裸 `tsc`）。
- Bun only；DB 一律 Drizzle ORM；DB 寫入需搭配 WebSocket 事件廣播。
- 前端 UI 遵循 `docs/UIUX-Design-System.md`（Apple-Native Soft Minimalism）；不得在元件內重定義 `.btn*`。

**Ask First（先問再做）**
- 刪除任何路由或公開 API（Phase 3 淘汰死路徑前，需先確認前端 `useDelayedMessages.ts` / `PendingMessagesList.vue` 的實際依賴並回報）。
- 任何 DB migration。
- 部署到 production（`bun run deploy` 僅手動）。

**Never（絕不）**
- 不在 DO 內複製第二份平台發送邏輯（見 D1）。
- 不新增 `[env.staging]` / `[env.development]` 到 wrangler.toml。
- 撤回失敗時不得回報成功（誠實錯誤優先於體驗）。
- 不動與本功能無關的程式碼。

---

## 5. 風險與緩解

| 風險 | 等級 | 緩解 |
|------|------|------|
| 改動主發送路徑影響所有出站訊息 | 高 | 預設窗口=0（行為零變化）；抽取 `MessageDeliveryService` 為純重構、獨立驗證後才接 DO |
| DO 排程失敗導致訊息不發 | 高 | F2 降級策略：schedule 失敗 → 立即發送 + error log |
| 撤回/派送競態 | 中 | 同一 conversation 共用一個 DO 實例（單執行緒序列化）；cancel 為唯一裁決 |
| Worker 重啟/DO 休眠遺失排程 | 中 | DO Storage 持久化 + Alarm 為 Cloudflare 原生保證；`deliver()` 冪等（D2） |
| 5 處硬編碼上限漏改 | 低 | D3 統一收斂到 `limits.ts` 常數，grep 驗證無殘留 `> 120` |

## 6. 明確不做（Out of Scope）

- 每團隊獨立窗口設定（本期為全系統單一設定；schema 預留 key 命名空間即可）。
- 「立即發送」跳過窗口按鈕（後續迭代）。
- 客戶端（LINE 使用者側）任何變更。
- 排程未來時間發送（scheduled send）產品化 —— 與本功能不同，不在此期。
