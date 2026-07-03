# Phase 3 施工工單（執行者：Eric ／ 審收：Claude）

> 依據 [PHASE-3-CLEANUP.md](./PHASE-3-CLEANUP.md)。每個工項獨立 commit，方便逐項審收。
> 審收方式：完成後告知 commit 範圍，我會逐項跑驗收指令 + 讀 diff 審查。
> ⚠️ 順序必須是 W1 → W2 → W3 → W4：先有盤點證據才能動刀。

---

## W1. 盤點報告（先做，不動任何程式碼）

產出一份 `docs/specs/recall-window/W1-INVENTORY.md`，內容：

1. **端點流量證據**：production 近 30 天內下列端點的請求量（Cloudflare dashboard 或 wrangler tail 觀察一段時間）：
   - `POST/GET /api/delayed-messages/*`（實作 B 模組路由，`src/core/route-config.ts:104-106`）
   - `POST /api/messages/delayed`、`/api/messages/recall`、`GET /api/messages/pending`、`GET /api/messages/:id/can-recall`（legacy 路由，`src/modules/messaging/handlers/messaging/index.ts:106-109`）
2. **後端引用清單**：`grep -rn "DelayedMessageManager\|MessageSchedulerService\|MessageProcessorService\|delayed-message-service" src/ --include="*.ts" | grep -v test` 的輸出，逐條標記「將刪除 / 保留（原因）」。
3. **前端引用確認**：`PendingMessagesList.vue` 無掛載點、`useDelayedMessages` 無消費者（我已初步確認，請複核並附 grep 輸出）。
4. **D1 在途資料**：`delayed_messages` 表中 `status='pending'` 的列數（remote D1 查詢）。若 >0，列出並說明處置（等它們過期 vs 直接作廢）。

**驗收標準**
- [ ] 四項證據齊全，每一條「將刪除」都有流量為零或無引用的佐證。
- [ ] 在途資料處置方案明確。

---

## W2. 移除死路徑（後端）

**前提：W1 審核通過。**

刪除範圍（實作 B + C，僅路由與服務層）：

| 動作 | 目標 |
|------|------|
| 移除路由註冊 | `src/core/route-config.ts:104-110` 的 `delayed-messages` 群組（**保留** `:334-336` 的 `delayed-messages-v2`） |
| 移除路由註冊 | `messaging/index.ts` 的 legacy-delayed 四條路由 + `routes/legacy-delayed.ts` 檔案 |
| 刪除服務 | `src/modules/delayed-message/` 下：`controllers/DelayedMessageController.ts`、`services/`（Manager/Scheduler/Processor）、`handlers/delayed-message-modular.ts`、`infrastructure/` 中僅被上述引用的部分 |
| 刪除服務 | `src/modules/messaging/services/delayed-message-service.ts` |
| **保留** | `handlers/delayed-message-buffer.ts`（v2 DO 路徑）、`DelayedMessageScheduler` DO 全部、`ValidationService` 若 buffer handler 仍引用則保留 |
| **保留** | `src/db/schema.ts` 的 `delayedMessages` 表定義（標 `@deprecated` 註解，不做 drop migration） |

注意事項：
- 健康檢查探針（`websocket-health.ts:269,430`、`system-main.ts:118-122`）探的是 **DO 綁定**，不要刪。
- `MessageRecallService.recallDelayedMessage`（`message-recall-service.ts:277-388`）若只服務 legacy 路由，一併刪除；`recallMessage` 本體是撤回窗口在用的，**不能動**。
- 每刪一批先跑 `bunx tsc --noEmit`，最後跑 `bun run check:routes:ci`。

**驗收標準（我會執行）**
- [ ] `grep -rn "DelayedMessageManager\|processDelayedSend\|delayed-message-modular" src/` 零結果（測試除外）。
- [ ] `/api/delayed-messages-v2/health` 與撤回窗口全流程（窗口 0/30 兩檔）回歸正常。
- [ ] `bash scripts/check.sh` 全綠、`bun run check:routes:ci` 無衝突。
- [ ] diff 中沒有觸碰：`delayed-message-buffer.ts`、DO 目錄、`recallMessage` 本體、broadcast 功能檔案。

---

## W3. 移除死代碼（前端）

- 刪除 `frontend/src/components/message/PendingMessagesList.vue`、`frontend/src/composables/useDelayedMessages.ts`，並清掉 `frontend/src/composables/index.ts:18` 的 barrel export。
- 若 `frontend/src/api/` 有僅供上述使用的 delayed API client 函式/contract，一併刪除（先 grep 確認無他人引用）。
- 檢查 `shared/api-contracts/delayed-messages-v2.ts`：v2 contract **保留**（health check / 未來立即發送跳過窗口可能用）；legacy delayed contract 若存在且無引用則刪。

**驗收標準**
- [ ] `bun run type-check`、`bun run test`、`bun run lint` 全綠。
- [ ] `grep -rn "useDelayedMessages\|PendingMessagesList" frontend/src` 零結果。

---

## W4. 測試補強

新增（後端 Vitest，放 `tests/` 對應目錄；禁 `any`）：

1. **recall-window-config**（`src/services/recall-window-config.ts`）
   - 合法值 0/30/60/120/300 通過、45/-1/'60' 拒絕（`isValidRecallWindow`）。
   - KV 命中返回快取值；KV miss → D1 讀取並回填；KV+D1 都失敗 → 回傳 0 不拋錯。
2. **MessageDeliveryService.deliver()**（mock fetch + D1）
   - `isRecalled=true` / `isSent=true` → 不呼叫 LINE API（冪等）。
   - 正常 buffered 訊息 → 呼叫 push、更新 `sent` + `sentAt`、廣播 `message_updated`。
   - 附件 >5 則 → 分批呼叫。
3. **buffered-send-scheduler**
   - DO 回 2xx → true；非 2xx / 拋錯 / 綁定缺失 → false。
   - `downgradeBufferedMessage` 將列改回 `pending` + `recallDeadline=null`。
4. **撤回 handler 分支矩陣**（可以 service 層或 handler 整合測試實作）
   - buffered + DO cancel 成功 → isRecalled、無 LINE 推播。
   - buffered + DO cancel 失敗 → 400「deadline has passed」，訊息不變。
   - LINE 已送達 → 400；FB 已送達 → 走 Graph delete 分支。
   - 已撤回 → 400。
5. **處理 inert 舊測試**：`src/modules/delayed-message/__tests__/integration.test.ts` 隨 W2 刪除模組一併刪除（不留假測試）。
6. **前端**（Vitest）：`useRecallCountdown` — buffered 倒數、`isRecalled` 排除、歸零轉 `isAwaitingDelivery`、非 buffered 全 false。

**驗收標準**
- [ ] 上述案例全部存在且通過；我會抽查 2-3 個測試把 mock 斷言反轉確認測試真的會失敗（不是恆真測試）。
- [ ] 測試檔無 `any`（測試檔雖豁免規範，仍希望維持）。

---

## W5. 文件與 ADR

- `CLAUDE.md`：DO 清單處把 `DelayedMessageBuffer` 職責註記更新為「撤回窗口計時器（deliver-by-ref）+ v2 排程」。
- 新增 ADR（`docs/adr/` 或專案慣例位置）：撤回窗口架構決策——D1 統一投遞（DO 不自帶發送邏輯）、狀態冪等取代列存在檢查、DO 為撤回競態唯一裁決者、失敗降級立即發送。
- `docs/specs/recall-window/SPEC.md` 狀態改「已實作」，勾銷 F1-F4 驗收清單（真機驗證項除外，標註待驗）。

**驗收標準**
- [ ] 文件描述與程式碼一致（我會抽查 3 處檔案路徑/行為）。
- [ ] ADR 涵蓋上述四個決策與其理由。

---

## 審收流程

1. 每完成一個 W 項，commit 並告訴我 commit hash（或直接說「W2 done」）。
2. 我會：讀 diff、跑驗收指令、對 W4 做「測試會不會真的失敗」抽查，然後給你 ✅ / 需修清單。
3. 全部通過後，我做最終整合回歸（scripts/check.sh + 全套測試 + 路由檢查），Phase 3 收官。
