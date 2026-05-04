# Delayed-Message 模組 — 延遲發送與即時撤回

> **位置**: `src/modules/delayed-message/`  
> **DO**: `DelayedMessageScheduler`（綁定名 `DelayedMessageBuffer`）  
> **角色**: 給客服一個「後悔藥」 — 發出訊息後仍有幾秒鐘可以撤回。

---

## 1. 這個模組是什麼？

訊息點下「發送」按鈕後，不會立刻送到客戶手裡，而是排程在 1–120 秒後送出。在這個延遲視窗內，客服可以用「撤回」按鈕真正取消發送 —— 不是假裝已撤回，是真的沒送出去。

## 2. 解決什麼問題？

| 場景 | Delayed-Message 模組做什麼 |
|---|---|
| 客服按下發送發現打錯字 | 5 秒倒數內按「撤回」，訊息根本沒到客戶手機 |
| 主管想設「全公司預設延遲 10 秒」 | 系統設定可調整全域預設延遲 |
| 想知道某客服一週撤回幾次 | `GET /stats/:userId` 看撤回統計 |
| 大量排程訊息要監控 | `GET /pending` 列出所有待送 |

## 3. 主要功能

- **可調延遲**：1–120 秒，可全域預設亦可單則覆蓋
- **真正撤回**：不是已讀標記，是 DO 從佇列取消，永不送出
- **即時取消**：撤回延遲 < 100ms（直接寫 DO 狀態）
- **重新排程**：在 deadline 前可改延遲時間
- **狀態查詢**：剩餘時間、是否仍可撤回
- **批次處理**：佇列消費端可批次處理多則
- **健康監控**：`/health` 含特性旗標（instantCancel / preciseScheduling / durableObjects）

## 4. 操作介面入口

| 介面 | 看到什麼 |
|---|---|
| `ConversationDetail.vue` | 發送後出現倒數 chip + 撤回按鈕 |
| `SystemSettings.vue` | 全域延遲秒數預設、撤回視窗等設定 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| POST | `/api/delayed-messages/send` | 排程新訊息 |
| POST | `/api/delayed-messages/recall/:messageId` | 撤回（即時，無等待） |
| POST | `/api/delayed-messages/reschedule/:messageId` | 變更延遲 |
| GET | `/api/delayed-messages/pending` | 待送清單（分頁） |
| GET | `/api/delayed-messages/status/:messageId` | 狀態查詢 |
| GET | `/api/delayed-messages/stats/:userId` | 統計 |
| GET | `/api/delayed-messages/health` | 健康檢查 |

## 6. 涉及的 Durable Objects

- **`DelayedMessageScheduler`**（對外綁定名 `DelayedMessageBuffer`）— 用 DO Alarm 精準排程，撤回即時，無輪詢開銷
- **內部子路由**：`/schedule`, `/cancel`, `/list`, `/send-now`

## 7. 邊界案例與小細節

- **DO Alarm 精準度**：使用 Cloudflare Alarm，零漂移，不像舊版 KV 輪詢有秒級誤差
- **撤回保證**：寫 DO 狀態 + 移出 Queue，不需等待傳播
- **deadline 是硬限**：通常 = `now + delay × 0.2` 或固定窗（如 5 分鐘），過期就送出
- **狀態流轉**：`pending → sent`（成功）/ `cancelled`（撤回）/ `failed`（傳輸錯誤）
- **DO 被驅逐風險**：若 DO 被 Cloudflare 驅逐，已排程訊息會丟失 → 同步寫一份到 D1 `delayedMessages` 表保險
- **元資料完整保留**：附件、@mention、threadId 都跟著訊息一起延遲

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 撤回鈕點了沒反應 | 是否已超過 recall deadline |
| 訊息沒準時送 | 看 DO Alarm 是否被觸發；查 `/health` |
| 撤回統計看起來怪 | 確認 `/stats/:userId` 的時間範圍參數 |

---

**相關模組**：[messaging](./messaging.md)、[queue](./queue.md)、[system](./system.md)（全域預設）
