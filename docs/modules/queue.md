# Queue 模組 — 非同步訊息傳遞

> **位置**: `src/modules/queue/`  
> **架構**: Cloudflare Queues + Durable Objects  
> **角色**: 把對外 LINE API 呼叫從 HTTP 請求生命週期解耦，讓客服體驗更快。

---

## 1. 這個模組是什麼？

當客服按下「發送」，後台不會直接打 LINE API（那會等到 LINE 回應才回 HTTP），而是把「要送的訊息」丟到 Cloudflare Queue，立刻回 success。實際送訊息由 Queue consumer 在背景處理，含批次與重試。

## 2. 解決什麼問題？

| 場景 | Queue 模組做什麼 |
|---|---|
| 客服按發送，LINE 慢半秒 | API 立刻回 200，背景處理，UX 不卡 |
| LINE 暫時 500 錯誤 | 自動 exponential backoff 重試 |
| 同時要送 10 則給同一客戶 | 批次合併（≤ 5 則 / LINE call），含 100ms 間隔 |
| 想監控佇列健康 | `GET /monitor/stats` 看 backlog |

## 3. 主要功能

- **非同步遞送**：HTTP 立即返回，背景處理
- **批次發送**：LINE API 限制每呼叫 ≤ 5 則，自動分批 + 100ms 間隔避免 rate limit
- **指數退避重試**：失敗自動排程重試
- **WebSocket 狀態同步**：sent / delivered / failed 即時推給客服
- **佇列監控**：backlog 深度、處理速率、錯誤率、平均處理時間
- **逐則 try/catch**：單則失敗不影響整批
- **去重**：`platformMessageId` 防止重試造成重複發送

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| QueueMonitor.vue（規劃中） | 管理員儀表板 |
| `WebSocketAdmin.vue` | 連線監控（與佇列相關） |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/queue/monitor/stats` | 統計（總訊息、健康佇列、系統運行時間） |
| GET | `/api/queue/monitor/health` | 健康檢查 |
| GET | `/api/queue/monitor/metrics` | 效能指標（吞吐、可靠性、成功 / 錯誤率） |

## 6. 涉及的 Durable Objects 與 Queue

- **`LINE_MESSAGE_QUEUE`**（Cloudflare Queue 綁定）— 消費 `LineMessageQueuePayload` 與 `MediaProcessingPayload`
- **`WebSocketBroadcastService`** — 廣播狀態更新給客服

## 7. 邊界案例與小細節

- **依 type 路由**：`media_processing` 走 `processMediaMessage()`；`outbound_message` 走一般訊息路徑
- **訊息 ack 規則**：成功才 `message.ack()`，失敗 `message.retry()`
- **批次失敗整批重試**：LINE 回 500 視為整批失敗（LINE API 行為）
- **失敗告警非阻塞**：寫 KV 稽核 + 選用 Slack 通知
- **每事件 try/catch**：防止一筆壞訊息卡住整個佇列
- **批次大小 / 超時**：max 10 則 / 5 秒（Cloudflare Queue 預設）
- **狀態更新含**：`messageId`, `conversationId`, `success`, `deliveredAt`, `error`

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 訊息堆積 | 看 `/monitor/stats` backlog；可能 LINE API 出問題 |
| 重複收到訊息 | 確認 `platformMessageId` 去重邏輯 |
| 監控數字異常 | 用 `/monitor/metrics` 看詳細指標 |

---

**相關模組**：[messaging](./messaging.md)、[delayed-message](./delayed-message.md)、[integrations](./integrations.md)
