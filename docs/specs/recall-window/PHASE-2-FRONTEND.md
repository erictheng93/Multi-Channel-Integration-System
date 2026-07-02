# Phase 2 — 前端（設定 UI + 倒數體驗）

> 依據：[SPEC.md](./SPEC.md)。前置：Phase 1 全部完成（API 與 WS 事件已可用）。
> T2.1 與 T2.2/T2.3 可並行；T2.4 依賴 T2.2+T2.3。
> 所有 UI 遵循 `docs/UIUX-Design-System.md`（Apple-Native Soft Minimalism），輸出前過 Section 15 檢查清單。工具鏈：`bunx vue-tsc --noEmit`（絕不用裸 `tsc`）。

---

## T2.1 管理員設定 UI

**改動檔案**
- 系統設定頁（先以 `search_graph` / grep 定位呼叫 `GET /api/system/settings` 的 view/元件，預期在 `frontend/src/views/` 系統設定相關頁）
- `frontend/src/api/`（settings API client 增欄位型別）

**步驟**
1. 設定頁新增「訊息可撤回時間」區塊：下拉選單，選項 `關閉 / 30 秒 / 1 分鐘 / 2 分鐘 / 5 分鐘`（值 0/30/60/120/300）。
2. 附說明文字：「開啟後，訊息將延遲對應時間才實際發送給客戶；期間客服可撤回。」
3. 僅 admin 可見/可改（沿用該頁既有角色控制模式）。
4. 儲存 → `PUT /api/system/settings`，成功 toast、失敗顯示後端錯誤。

**驗收**
- [ ] admin 可改並持久化（重整後保留）；agent 看不到或唯讀。
- [ ] UI 符合設計系統（膠囊按鈕、無 1px 硬邊框、卡片陰影規格）。
- [ ] `bun run type-check`、`bun run lint` 通過。

---

## T2.2 訊息氣泡：緩衝狀態 + 倒數

**改動檔案**
- `frontend/src/components/conversation/MessageBubble.vue`（撤回選項 :441 一帶）
- `frontend/src/composables/message/useMessageActions.ts`（`recallMessage` :161）
- 可複用：`frontend/src/composables/useDelayedMessages.ts` 的 `getCountdown`（:152）邏輯（抽出共用或參考實作）

**步驟**
1. 氣泡狀態顯示規則：
   ```
   deliveryStatus='buffered' 且 now < recallDeadline
        → 顯示「⏱ 可撤回 m:ss」倒數（每秒更新；集中一個 interval，勿每氣泡各開 timer）
   deliveryStatus='sent'/'partial' → 現行已送達樣式
   deliveryStatus='failed'         → 現行失敗樣式
   ```
2. 倒數歸零而 WS 事件未達時：樂觀轉為「發送中…」，待 `message_delivery_update` 校正（不可假顯示「已送達」）。
3. 撤回選項顯示條件：`buffered 且窗口內`，或 `FB 且已送達`；LINE 已送達 → 隱藏撤回選項。
4. 倒數標記樣式走設計系統 pastel 低飽和色 + `rounded-full`。

**驗收**
- [ ] 送出訊息立即出現氣泡與倒數；倒數歸零後自動轉「已送達」。
- [ ] LINE 已送達訊息長按/右鍵選單中無「撤回」。
- [ ] 多客服同時開同對話：非發送者也看到倒數與狀態流轉（WS 廣播驅動）。
- [ ] `bun run type-check`、`bun run test` 通過。

---

## T2.3 Store / WS 事件對接

**改動檔案**
- `frontend/src/stores/messages.ts`（`deleteMessage` :300-320）
- `frontend/src/services/`（WebSocket client 事件 handler）
- `frontend/src/composables/conversation/useConversationActions.ts`（`recallMessage` :43-56）

**步驟**
1. 訊息模型增加 `recallDeadline`、`deliveryStatus='buffered'` 的處理；新訊息事件/`message_buffered` 帶入 deadline。
2. 處理 `message_delivery_update`：就地更新對應訊息的 `deliveryStatus/isSent/sentAt`。
3. `deleteMessage`/撤回成功：不再從陣列 splice 移除（:305-311 現況），改為標記 `isRecalled` 並顯示「已撤回」佔位樣式 —— 與後端 content 改寫一致。
4. 撤回失敗（400）：toast 顯示後端錯誤訊息（「已超過可撤回時間」/「LINE 已送達的訊息無法撤回」），不得靜默。

**驗收**
- [ ] 兩個瀏覽器分頁（不同客服）狀態即時同步。
- [ ] 撤回失敗有明確 toast；撤回成功氣泡轉「已撤回」佔位。
- [ ] 重新整理頁面後，緩衝中訊息的倒數依 `recallDeadline` 正確恢復。

---

## T2.4 端到端驗證（chrome-devtools / playwright MCP）

**步驟**
1. 設定窗口 60s → 送出 → 驗證倒數 UI → 20s 時撤回 → 確認 LINE 測試帳號無任何訊息。
2. 設定窗口 60s → 送出 → 等到期 → 確認客戶收到、UI 轉已送達、撤回選項消失。
3. 設定關閉（0）→ 送出 → 即時送達、無倒數標記（回歸現況）。
4. 每步截圖存檔於 PR 描述。

**驗收**
- [ ] 上述三情境全數通過並附截圖。
- [ ] `bash scripts/check.sh frontend` 通過。

---

## Phase 2 完成定義（DoD）

- T2.1–T2.4 全數通過。
- SPEC §2 F4 驗收全綠。
- 設計系統檢查清單（`docs/UIUX-Design-System.md` §15）逐項確認。
