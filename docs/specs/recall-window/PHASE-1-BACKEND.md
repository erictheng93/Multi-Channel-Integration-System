# Phase 1 — 後端核心（緩衝發送 + 真實撤回）

> 依據：[SPEC.md](./SPEC.md)。完成 Phase 1 後，即可用 API 直接驗證撤回窗口全流程（前端尚未有 UI）。
> 任務順序即依賴順序：T1.1、T1.2 可並行；T1.3 依賴 T1.2；T1.4 依賴 T1.3；T1.5 依賴 T1.1+T1.4；T1.6 依賴 T1.5。
> 每個任務完成即單獨 commit（atomic commit，pre-commit ~20s）。

---

## T1.1 設定持久化：`recall_window_seconds`

**改動檔案**
- `src/modules/system/services/system-service.ts`（`getSettings` :284 / `updateSettings` :335 — 現為不落庫 stub）
- `src/modules/system/types/system-types.ts`（`SystemSettingsResponse` / `SystemSettingsUpdate` 增欄位）
- `src/config/kv-config.ts`（新增快取 key 與 TTL 60s）
- 新增 `src/services/recall-window-config.ts`：`getRecallWindowSeconds(env): Promise<number>`（KV 快取 → miss 時讀 D1 `system_settings` → 預設 0）

**步驟**
1. `updateSettings` 對 `advanced.recallWindowSeconds` 實作真實 upsert 到 `system_settings`（key = `recall_window_seconds`），並刪除 KV 快取 key。
2. 驗證合法值 `0|30|60|120|300`，非法回 400；PUT 端點確認有 admin 角色檢查（`src/middleware/auth.ts` 既有機制）。
3. `getSettings` 回傳實際落庫值。
4. `getRecallWindowSeconds()` 讀取路徑：KV → D1 → default 0，任何錯誤 fallback 0（安全預設 = 關閉）。

**驗收**
- [ ] `PUT /api/system/settings` 帶 `{advanced:{recallWindowSeconds:60}}` → D1 `system_settings` 出現該列；重啟後 GET 仍為 60。
- [ ] 帶 `45` 回 400；非 admin 回 403。
- [ ] `getRecallWindowSeconds` 在 KV/D1 皆失敗時回 0 且不拋錯。
- [ ] `tsc --noEmit` 通過。

---

## T1.2 抽取共用投遞服務 `MessageDeliveryService`（純重構，行為零變化）

**改動檔案**
- 新增 `src/modules/conversations/services/message-delivery-service.ts`
- `src/modules/conversations/services/message-service.ts`（`processBackgroundSending` :172-460 瘦身為呼叫新服務）

**步驟**
1. 先跑 `trace_path("processBackgroundSending", mode="calls")` 確認呼叫者只有 `conversation-messages.ts:420` 的 `waitUntil`。
2. 將「讀 conversation/customer → 組 LINE 訊息（文字判斷 :204-224、附件查詢與簽名 URL :227-317、圖片/Flex :278-303）→ 5 則分批推送 :321-375 → 更新 messages 列狀態 → WS 廣播」整段搬入 `MessageDeliveryService.deliver(messageId)`。
3. **介面關鍵**：`deliver(messageId: string): Promise<void>` 一律從 D1 讀取訊息內容與 `metadata` 中的 attachmentIds —— 不依賴 request 物件（DO alarm 呼叫時沒有 request）。`createPendingMessage` 需把 `attachmentIds` 寫入 `messages.metadata`（確認現況是否已存，缺則補）。
4. `deliver()` 開頭冪等守衛：讀取該列，`isRecalled === true || isSent === true` → log + return（SPEC D2）。
5. FB 分支同樣搬入（現行 `processBackgroundSending` 內若有 FB 邏輯一併遷移）。

**驗收**
- [ ] 現行立即發送流程（文字、單圖、多附件 >5 則分批）在 dev 環境實測行為不變。
- [ ] `deliver()` 對 `isRecalled=true` 的訊息呼叫兩次皆不觸發 LINE API（可用 log 驗證）。
- [ ] `processBackgroundSending` 保留原簽名（介面 `MessageServiceInterface` :66 不破壞），內部委派。
- [ ] `tsc --noEmit` 通過；`bash scripts/check.sh backend` 通過。

---

## T1.3 訊息狀態機：`buffered` 狀態 + `recallDeadline` 快照

**改動檔案**
- `src/modules/conversations/types/conversation-types.ts`、`src/types/`（deliveryStatus TS 聯集加 `'buffered'`；`schema.ts:131` 為 text 欄位，**不需 migration**）
- `src/modules/conversations/services/message-service.ts`（`createPendingMessage` :88-166）
- `src/constants/message-status.ts`（若有狀態常數表，同步）

**步驟**
1. `createPendingMessage` 增加參數 `recallWindowSeconds`：>0 時寫入 `deliveryStatus:'buffered'`、`isSent:false`、`recallDeadline: now + N 秒`（ISO 字串，與 `conversation-messages.ts:874` 的比較邏輯一致）；=0 時維持現行 `'pending'` 與 `recallDeadline:null`。
2. 全域 grep `deliveryStatus` 的判斷點（列表顯示、統計、快取），確認 `'buffered'` 不會被誤判為失敗或已送達。

**驗收**
- [ ] 窗口>0 時新訊息列：`buffered` / `isSent=false` / `recallDeadline` 正確（誤差 <2s）。
- [ ] 窗口=0 時與現況位元級一致。
- [ ] `tsc --noEmit` 通過。

---

## T1.4 DO 改造：可取消計時器 + 呼叫共用投遞

**改動檔案**
- `src/durable-objects/DelayedMessageScheduler.ts`（`handleSchedule` :250-315、`alarm` :527-557）
- `src/durable-objects/delayed-message/retry-handler.ts`（冪等 :49-71 / `sendMessage` :363-388）
- `src/durable-objects/delayed-message/types.ts`（`PendingMessage` 增精簡模式欄位）
- `src/constants/limits.ts`（新增 `MAX_RECALL_WINDOW_SECONDS = 300`）
- 上限硬編碼同步：`ValidationService.ts:99-116`、`delayed-message-buffer.ts:48,58-60`、`DelayedMessageController.ts:184,342-346`、`messaging/services/delayed-message-service.ts:52`

**步驟**
1. 先跑 `trace_path("alarm")` / `search_graph(name_pattern="handleSchedule")` 確認影響範圍。
2. `handleSchedule` 接受精簡 payload `{messageId, conversationId, delaySeconds, mode:'deliver-by-ref'}`：此模式下 `content/recipientPlatformId` 可缺省（內容以 D1 為準）。舊 payload（自帶 content）維持相容 —— v2 既有端點不破壞。
3. 上限檢查改為 `1..MAX_RECALL_WINDOW_SECONDS`（5 處一起改，統一引用常數）。
4. `alarm()` 派送分流：`mode==='deliver-by-ref'` → `new MessageDeliveryService(this.env).deliver(messageId)`（含其內建冪等與重試考量）；成功/失敗後同步 WS 廣播狀態事件（T1.6 定義）。舊 mode → 走現行 `retry-handler.sendMessage`。
5. `deliver-by-ref` 模式**跳過** `isMessageAlreadySent` 列存在檢查（該檢查與先入庫衝突，SPEC D2），冪等交給 `deliver()` 的狀態守衛。
6. `handleCancel` :321-342 不需改（既有 `<100ms` 取消 + `now>=scheduledAt` 拒絕即為所需語義）。

**驗收**
- [ ] 排程 300s 被接受、301s 被拒；grep 全 repo 無殘留 `> 120` 上限檢查。
- [ ] `deliver-by-ref` 排程 30s 後 Alarm 觸發，LINE 收到完整訊息（含附件情境），D1 狀態轉 `sent`。
- [ ] Alarm 觸發前手動打 DO `/cancel` → 訊息不發送、DO storage 清除。
- [ ] 對已 `isRecalled` 的訊息 Alarm 觸發 → 不發送（冪等守衛生效）。
- [ ] 既有 `/api/delayed-messages-v2` 舊 payload 排程仍可運作（回歸）。
- [ ] `tsc --noEmit` 通過。

---

## T1.5 發送路徑分流

**改動檔案**
- `src/modules/conversations/handlers/conversation-messages.ts`（POST `/:id/messages` :290-462）
- `src/modules/conversations/services/message-service.ts`

**步驟**
1. 編輯前跑 `trace_path("createPendingMessage")` 影響分析並回報。
2. handler 讀取 `getRecallWindowSeconds(c.env)`：
   - `0` → 現行路徑：`createPendingMessage(…, 0)` + `waitUntil(deliver)`。
   - `>0` → `createPendingMessage(…, N)` → 呼叫 DO（`idFromName(conversationId)`，同 `delayed-message-buffer.ts:85-86` 模式）`/schedule` 帶 `deliver-by-ref` payload。
3. **降級**：DO schedule 呼叫拋錯或非 2xx → 將該列改回 `pending`/`recallDeadline=null`，`waitUntil(deliver)` 立即發送，記 `log.error`（SPEC F2）。
4. 回應 body 增加 `recallDeadline`（前端倒數用）；WS 廣播 payload 同步帶上。

**驗收**
- [ ] 窗口=60：送出後 60 秒（±2s）客戶才收到；期間 D1 為 `buffered`。
- [ ] 窗口=0：毫秒級送達（與現況相同）。
- [ ] 模擬 DO 失敗（暫時丟例外）→ 訊息仍立即送達 + error log。
- [ ] `bash scripts/check.sh backend` 通過。

---

## T1.6 撤回真實化 + WS 事件

**改動檔案**
- `src/modules/conversations/handlers/conversation-messages.ts`（DELETE `/:id/messages/:messageId` :838-935）
- `src/modules/messaging/services/message-recall-service.ts`（`notifyPlatformRecall` :215-259）
- `src/constants/websocket-events.ts`、`src/modules/websocket/services/message-events.ts`（新事件）
- 前端 store 之後在 Phase 2 對接

**步驟**
1. 撤回 handler 重寫分支邏輯：
   ```
   讀取訊息列
   ├─ isRecalled → 400（不變）
   ├─ deliveryStatus='buffered' 且 now < recallDeadline
   │    → DO /cancel（同一 conversationId 實例）
   │       ├─ 成功 → 標記 isRecalled、廣播、activity log（沿用 :890-925）
   │       └─ 失敗 → 400「已超過可撤回時間」（Alarm 已觸發，競態由 DO 裁決）
   ├─ isSent=true 且 platform=LINE → 400「LINE 已送達的訊息無法撤回」
   └─ isSent=true 且 platform=FB  → 現行 Graph API 刪除分支（保留）
   ```
2. `notifyPlatformRecall` LINE 分支（:215-230）**整段移除**——不再推「This message has been recalled」給客戶。FB 分支保留。
3. 新 WS 事件（加入 `websocket-events.ts` 常數 + broadcast service）：
   - `message_buffered`：送出時帶 `recallDeadline`（可併入現有新訊息事件 payload，實作時擇一並記錄於 PR）。
   - `message_delivery_update`：Alarm 派送完成後帶 `deliveryStatus/sentAt`（由 T1.4 alarm 流程觸發）。
   - `message_recall_success`：沿用既有（:902）。
4. 撤回成功時，`content` 改寫沿用現行 `[This message has been recalled]`（:896）——僅平台內顯示用。

**驗收（端到端，dev 環境對真實 LINE 帳號）**
- [ ] 窗口=60，送出後 20s 撤回 → LINE 客戶**完全沒收到任何訊息**（含不再有「已撤回」通知）。
- [ ] 送出後等 61s 再撤回 → 400，客戶正常收到原訊息。
- [ ] 撤回請求與 Alarm 幾乎同時（送出後 59.5s 撤回）→ 二者只有一個生效，且 API 回應與實際結果一致。
- [ ] FB 已送達訊息撤回 → Graph API 刪除仍運作（回歸）。
- [ ] `gitnexus` 已停用 → 改跑 `mcp detect_changes` 確認變更範圍符合預期後才 commit。
- [ ] `bash scripts/check.sh` 全綠。

---

## Phase 1 完成定義（DoD）

- T1.1–T1.6 驗收全數通過，各自獨立 commit。
- 窗口=0 時全系統行為與 main 分支無差異（回歸保證）。
- 以 curl / REST client 完成 SPEC §2 F1–F3 的全部驗收（前端 UI 留待 Phase 2）。
