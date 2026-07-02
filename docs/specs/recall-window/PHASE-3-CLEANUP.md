# Phase 3 — 收斂與測試補強

> 依據：[SPEC.md](./SPEC.md) D6。前置：Phase 1、2 已上線驗證穩定。
> T3.1 具破壞性（刪路由），動手前需完成依賴盤點並回報（SPEC「Ask First」）。

---

## T3.1 淘汰死路徑實作 B / C

**背景（已驗證）**
- 實作 B：`src/modules/delayed-message/` 的 `DelayedMessageManager` + `MessageSchedulerService` 只寫 D1 + KV 標記，**無任何派送觸發器**（`MessageSchedulerService.ts:42-98` 不設 alarm；`MessageProcessorService.processQueueMessage` 唯一入口是實作 C）。
- 實作 C：`src/modules/messaging/services/delayed-message-service.ts` 的 `processDelayedSend`（:249-251）**無呼叫者**。
- 路由：`/api/delayed-messages/*`（`src/core/route-config.ts:104-110`）、legacy `/api/messages/delayed|/recall|/pending|/:id/can-recall`（`legacy-delayed.ts:86-131`）。

**步驟**
1. **盤點（先做、回報後才刪）**：
   - grep 前端對上述路由的呼叫（重點：`frontend/src/composables/useDelayedMessages.ts`、`frontend/src/components/message/PendingMessagesList.vue:284,383`）。
   - `trace_path` / `search_graph` 確認後端內部無其他引用（health check 探針除外：`websocket-health.ts:269,430`、`system-main.ts:118-122` 針對的是 DO 綁定，保留）。
   - 查 production log / metrics 確認端點近 30 天流量為零。
2. 移除實作 B/C 服務與路由註冊；`delayedMessages` D1 表若無在途資料則保留 schema（不做 drop migration，僅標記 deprecated）。
3. 前端若 `PendingMessagesList` 仍掛在頁面上，改接新機制（buffered 訊息列表）或一併下架 —— 依盤點結果回報決策。
4. `/api/delayed-messages-v2` 保留（DO 健康檢查與新流程共用）。

**驗收**
- [ ] 盤點報告先行提交（受影響呼叫點清單 + 流量證據）。
- [ ] 刪除後 `bash scripts/check.sh` 全綠、`bun run check:routes:ci` 無路由衝突。
- [ ] dev 環境全功能回歸（送訊、撤回、窗口 0/60 兩檔）。

---

## T3.2 測試補強

**背景（已驗證）**：唯一測試 `src/modules/delayed-message/__tests__/integration.test.ts` 為 inert（vitest import 被註解，:4-12），DO 排程/取消/Alarm/撤回競態**零覆蓋**。

**新增測試**
1. `recall-window-config`：合法值、KV/D1 fallback、快取失效。
2. `MessageDeliveryService.deliver`：
   - 冪等：`isRecalled`/`isSent` 跳過不觸發平台 API（mock fetch）。
   - 附件組訊息、>5 則分批。
3. DO `DelayedMessageScheduler`（以 DO 測試工具或抽出純函式測）：
   - schedule 上限 1..300；`deliver-by-ref` payload 驗證。
   - cancel 於 `now >= scheduledAt` 拒絕（競態語義）。
4. 撤回 handler 分支矩陣：buffered+窗口內（成功）、buffered+cancel 失敗（400）、LINE 已送達（400）、FB 已送達（走 Graph 刪除）、已撤回（400）。
5. 前端：氣泡狀態規則與倒數恢復（Vitest，`frontend/`）。

**驗收**
- [ ] 上述案例全部落地且通過；後端測試可在 CI 執行。
- [ ] 刪除或修復 inert 的舊 integration.test.ts（不留假測試）。

---

## T3.3 文件與收尾

**步驟**
1. 更新 `CLAUDE.md` DO 清單註記（DelayedMessageBuffer 的新職責：recall-window 計時器）。
2. `docs/claude/` 若有訊息流程文件，補「緩衝發送」時序圖。
3. 撰寫 ADR：撤回窗口架構決策（D1 統一投遞、D2 狀態冪等、DO 為裁決者）。
4. 本 spec 目錄狀態改為「已實作」，勾銷驗收清單。

**驗收**
- [ ] 文件與程式碼一致（抽查 3 個檔案路徑/行為描述）。
- [ ] ADR 入庫。

---

## Phase 3 完成定義（DoD)

- 延遲發送僅剩單一入口（DO 路徑），無死程式碼路由。
- 測試矩陣覆蓋排程、取消、冪等、競態與撤回分支。
- 文件同步完成。
