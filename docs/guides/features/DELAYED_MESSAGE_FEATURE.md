# 延遲發送功能總覽(現稱「撤回窗口 Recall Window」)

> **狀態**: 本文件先前描述的 `DelayedMessageSender.vue`、`useDelayedMessage.ts`、
> `POST /api/messages/delayed/send` 等 UI 與 API 已在 commit `c97b8e16`
> (「remove legacy delayed frontend code」)被移除,不再存在於程式碼庫中。
> 現行功能已重新設計為「全域撤回窗口」,細節與程式碼對照請見:
>
> - 操作/架構摘要: [`docs/guides/DELAYED_MESSAGING_GUIDE.md`](../DELAYED_MESSAGING_GUIDE.md)
> - 決策紀錄(權威來源): [`docs/adr/0003-recall-window-delivery-architecture.md`](../../adr/0003-recall-window-delivery-architecture.md)
> - 規格文件: `docs/specs/recall-window/`
>
> 本文件僅保留一頁式功能總覽,避免與上述文件重複維護。

## 功能是什麼

- **不是**每則訊息由 agent 自選延遲秒數再發送。
- **是**一個全域、可由管理員在「進階設定」調整的**撤回窗口**:所有 agent 訊息立即送出到後端,但實際推播到 LINE / Facebook 的動作會延後 N 秒(`0/30/60/120/300`,`0` = 關閉),窗口內 agent 可以撤回,客戶就永遠不會收到該訊息。

## 使用者操作

1. 管理員於系統設定 → 進階設定選擇撤回窗口秒數(前端元件:`AdvancedSettingsForm.vue`)。
2. Agent 正常發送訊息(`POST /api/conversations/:id/messages`),無需任何額外參數。
3. 若窗口 > 0,前端訊息氣泡會顯示倒數(`useRecallCountdown.ts`),agent 可在倒數結束前點擊撤回。
4. 撤回呼叫 `DELETE /api/messages/:id`;由 `DelayedMessageScheduler` Durable Object 擔任撤回/送達競態的唯一仲裁者。
5. 窗口到期且未撤回 → 透過與立即發送共用的 `MessageDeliveryService` 送達平台。

## 為何重新設計

舊版(v1 Queue-based、v2 DelayedMessageBuffer DO)各自維護一套獨立的推播邏輯,與正常訊息路徑分岔,導致附件處理、LINE 5 則批次限制、D1 狀態更新、WebSocket 廣播必須维護兩份實作。新設計讓 Durable Object 只負責「存 messageId 引用 + alarm」,實際推播一律呼叫同一個 `MessageDeliveryService`,詳見 ADR 0003。

## 測試涵蓋

見 [`DELAYED_MESSAGING_GUIDE.md#測試涵蓋`](../DELAYED_MESSAGING_GUIDE.md#測試涵蓋)。
