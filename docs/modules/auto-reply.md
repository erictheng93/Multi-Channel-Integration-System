# Auto-Reply 模組 — 規則型自動回覆

> **位置**: `src/modules/auto-reply/`  
> **角色**: 客服離線或忙碌時，依規則自動回覆客戶。

---

## 1. 這個模組是什麼？

設定一組規則：「如果訊息含『退貨』就自動回退貨流程」「如果是非營業時間就回『明天 9 點再回覆您』」。Auto-Reply 模組讓客服不用 24 小時待命也能維持基本服務水準。

## 2. 解決什麼問題？

| 場景 | Auto-Reply 模組做什麼 |
|---|---|
| 客戶半夜來訊 | 偵測非營業時間 → 自動回排隊訊息 |
| 客戶問常見「怎麼退貨」 | 關鍵字命中 → 回退貨 SOP |
| 新客戶第一次來 | Welcome 規則 → 寄歡迎介紹 |
| 設「週一到週五 9-18 點」營業 | `POST /schedules` 批次設置 |
| 想看自動回覆有沒有真的觸發 | `GET /logs` 查日誌 |

## 3. 主要功能

- **多種觸發**：keyword、regex、訊息類型、非營業時間、welcome
- **AND / OR 邏輯**：每規則可有多條件，支援「全部命中」或「任一命中」
- **動作鏈**：每個規則可串接多動作（文字 + 圖 + Flex Message），按 `sortOrder` 執行
- **營業時間排程**：每週各日獨立設定，支援時區（如 `Asia/Taipei`）
- **規則優先級與啟用狀態**：可暫時關閉某規則
- **全域 vs 團隊範圍**：`teamId=null` 為全域；指定為團隊專屬
- **軟刪除**：用 `deletedAt`
- **KV 快取**：規則 / 排程更新時自動失效快取

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `AutoReply.vue` | 規則建構（條件 + 動作） |
| AutoReplySchedules.vue（規劃中） | 營業時間表 |
| AutoReplyLogs.vue（規劃中） | 觸發日誌 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET / POST | `/api/auto-reply/rules` | 列表 / 建立 |
| PUT / DELETE | `/api/auto-reply/rules/:id` | 編輯 / 軟刪 |
| GET / POST | `/api/auto-reply/schedules` | 取 / 批次 upsert 排程 |
| GET | `/api/auto-reply/logs` | 觸發稽核 |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。規則在訊息進來時於 Webhook handler 評估，引擎讀 KV 快取。

## 7. 邊界案例與小細節

- **時間格式**：`HH:mm` 24h 制，正規表達式驗證 `^([01]\d|2[0-3]):[0-5]\d$`
- **schedules 是「全清重塞」**：批次 upsert 會刪掉該團隊所有舊排程後重塞，不是 merge
- **caseSensitive 與 matchMode**：條件可設大小寫敏感、any / all 邏輯
- **動作排序由 sortOrder 決定**：不要靠陣列順序
- **KV 快取依 teamId 失效**：跨團隊不互相影響

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 規則不觸發 | 確認 `isActive=true`、條件邏輯正確、KV 快取已更新 |
| 營業時間判斷錯 | 確認時區設定（預設可能是 UTC） |
| 動作順序怪 | 檢查 `sortOrder` 數值 |

---

**相關模組**：[messaging](./messaging.md)（出站訊息）、[integrations](./integrations.md)（觸發來源）
