# 延遲發送 / 撤回窗口 (Recall Window) 指南

> **狀態**: 現行架構(取代舊版 Queue-based 與 v2 Durable-Object-buffer 設計)
> **權威文件**: [`docs/adr/0003-recall-window-delivery-architecture.md`](../adr/0003-recall-window-delivery-architecture.md) — 決策理由與取捨請以該 ADR 為準,本文件僅整理操作視角的摘要。
> **最後同步**: 2026-07-05,對照 commit `c97b8e16`(移除舊版前端)、`c17f2716`(ADR 0003)之後的程式碼狀態。

## 這份文件取代了什麼

舊版本文件描述過兩代已經不存在的實作,特此聲明作廢:

- ❌ **Queue-based 版本**(`AGENT_QUEUE` + KV + D1 consumer,±500ms 精度)— 已移除。
- ❌ **v2 Durable Object buffer 版本**(`DelayedMessageBuffer` DO、`POST /api/delayed-messages-v2/send` 等一整組 `/api/delayed-messages-v2/*` 端點、`DelayedMessageSender.vue`、`useDelayedMessage.ts` composable)— 對應的 handler(`src/modules/delayed-message/handlers/delayed-message-buffer.ts`)未被掛載到任何路由,前端元件已於 `c97b8e16` 刪除。這些路徑與元件**不要再引用**。

## 現行架構:撤回窗口(Recall Window)

這**不是**一個由 agent 逐則訊息自選延遲秒數的功能,而是一個**全域(可由管理員設定)的撤回窗口**:訊息一律立即送出到後端,但在窗口秒數內,平台實際推播會被延後,讓 agent 有機會在客戶看到之前撤回。

```
Agent 送出訊息
      │
      ▼
POST /api/conversations/:id/messages
      │
      ▼
讀取系統設定 recallWindowSeconds (0 / 30 / 60 / 120 / 300 秒)
      │
      ├─ = 0 ─────────────► 立即推播 (既有行為,不變)
      │
      └─ > 0 ─────────────► deliveryStatus='buffered', recallDeadline=now+N
                             │
                             ▼
                 scheduleBufferedDelivery()
                             │
                             ▼
              DelayedMessageScheduler DO (每個 conversation 一個實例)
                 存 { messageId, conversationId, delaySeconds } 並設 alarm
                             │
                             │  agent 可在窗口內呼叫
                             │  DELETE /api/messages/:id 撤回
                             │  → DO 的 /cancel 端點是唯一仲裁者
                             │
                             ▼ (窗口到期,且未被取消)
                 DO.alarm() → deliverByRef(messageId)
                             │
                             ▼
              MessageDeliveryService.deliver(messageId)
        (與「立即發送」共用同一套推播邏輯:LINE/Facebook 送出、
         attachment、5 則批次限制、D1 狀態更新、WebSocket 廣播)
```

排程失敗(DO 綁定缺失、非 2xx)時,訊息會**降級為立即發送**,絕不會卡在 `buffered` 狀態沒有 alarm。

## 相關程式碼(現行,已驗證存在)

| 職責 | 檔案 |
|------|------|
| 送訊息 API(觸發 buffered/立即分流) | `src/modules/conversations/handlers/conversation-messages.ts` (`POST /:id/messages`) |
| 撤回 API | `src/modules/messaging/handlers/messaging/routes/crud.ts` (`DELETE /api/messages/:id`) |
| 排程呼叫 DO | `src/modules/conversations/services/buffered-send-scheduler.ts` |
| 統一送達實作 | `src/modules/conversations/services/message-delivery-service.ts` |
| 召回業務邏輯 | `src/modules/messaging/services/message-recall-service.ts` |
| Durable Object(存 ref + alarm) | `src/durable-objects/DelayedMessageScheduler.ts` |
| 撤回窗口秒數設定(KV→D1→預設 0) | `src/services/recall-window-config.ts` |
| 前端倒數計時 composable | `frontend/src/composables/message/useRecallCountdown.ts` |
| 前端管理員設定 UI | `frontend/src/components/system-settings/AdvancedSettingsForm.vue` |

## 資料欄位(`messages` 資料表,`src/db/schema.ts`)

沒有獨立的 `pending_messages` / `message_recall_logs` 資料表(舊文件所描述的 schema 已不存在)。狀態直接存在 `messages` 表:

- `is_recalled` (boolean, 預設 `false`)
- `recall_deadline` (text, ISO timestamp,`null` 表示非 buffered 或已過窗口)
- `recalled_at` (text, ISO timestamp)
- `delivery_status` (text, 預設 `'delivered'`;buffered 訊息會是 `'buffered'`)

冪等性以這些欄位為準:`isRecalled=true` 或 `isSent`/`delivered` 已成立時,`MessageDeliveryService.deliver()` 會直接跳過,不會重複推播。

## 設定撤回窗口秒數

管理員在「進階設定」(`AdvancedSettingsForm.vue`)選擇窗口秒數,允許值為 `[0, 30, 60, 120, 300]`(見 `RECALL_WINDOW_ALLOWED_VALUES`,`src/services/recall-window-config.ts`)。`0` = 關閉,行為等同「立即發送」的舊行為。讀取順序:KV 快取(60s TTL)→ D1 `system_settings`(key: `advanced.recallWindowSeconds`)→ 預設 `0`。任何讀取失敗一律 fallback `0`,確保設定讀取失敗不會卡住訊息發送。

## 測試涵蓋

- `tests/unit/modules/conversations/services/message-delivery-service.test.ts`
- `tests/unit/modules/conversations/services/buffered-send-scheduler.test.ts`
- `tests/unit/modules/conversations/handlers/message-recall-handler.test.ts`
- `tests/unit/modules/messaging/services/message-recall-service.recall-window.test.ts`
- `frontend/src/composables/message/useRecallCountdown.test.ts`

## 已知未決事項

`DelayedMessagePanel.vue` 目前仍指向已保留的 v2 API,但沒有任何掛載點(orphaned)。是否要接上排程 UI 或隨 v2 前端一併移除,尚未決定 — 詳見 ADR 0003「Follow-ups」。

## 延伸閱讀

- ADR: [`docs/adr/0003-recall-window-delivery-architecture.md`](../adr/0003-recall-window-delivery-architecture.md)
- 規格與階段文件: `docs/specs/recall-window/`(SPEC、PHASE-1/2/3、W1-INVENTORY)
