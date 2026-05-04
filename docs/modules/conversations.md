# Conversations 模組 — 對話總調度

> **位置**: `src/modules/conversations/`  
> **角色**: 整個系統的「工單」中樞 — 客服每天最常打開的就是這個。

---

## 1. 這個模組是什麼？

每一個客戶傳來的訊息流，都會在系統裡形成一個「對話」（conversation）。Conversations 模組負責：建立對話、追蹤狀態、指派團隊、轉移、加標籤、查訊息。它是客服日常作業的主幹。

## 2. 解決什麼問題？

| 場景 | Conversations 模組做什麼 |
|---|---|
| 客戶從 LINE 來訊 | 自動建立對話，初始狀態 `pending` |
| 主管想把對話分給 A 組 | `POST /:id/assign` 指派到團隊 |
| A 組做不下去要轉給 B 組 | `POST /:id/transfer` 並記錄轉移歷史 |
| 客服想批次處理 50 個對話 | `POST /bulk` 一次設優先級或加標籤 |
| 想搜「上週討論退貨的對話」 | `GET /` 帶 `search=退貨` 參數 |

## 3. 主要功能

- **狀態流轉**：`active` / `pending` / `in-progress` / `waiting` / `assigned`
- **團隊指派**：v4 起只支援團隊指派，個人指派已移除
- **對話轉移**：自動寫入 `conversationTransfers` 表，可追溯
- **標籤管理**：單筆與批次新增 / 移除
- **批次操作**：上限 100 筆 / 次，含權限預檢
- **訊息轉發**：單則訊息可轉到 20 個對話，附選用註解
- **優先級**：normal / high / urgent — 控制佇列順序

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `ConversationList.vue` | 主列表（搜尋、篩選、快取命中率） |
| `ConversationsTable.vue` | 表格視圖（批次選取） |
| `ConversationDetail.vue` | 單一對話詳細頁（訊息串、轉發、撤回） |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/conversations` | 列表 + 篩選 + 分頁 |
| GET | `/api/conversations/:id` | 詳細（含最後訊息預覽） |
| POST | `/api/conversations/bulk` | 批次操作 |
| POST | `/api/conversations/:id/assign` | 指派團隊 |
| POST | `/api/conversations/:id/unassign` | 取消指派 |
| POST | `/api/conversations/:id/transfer` | 跨團隊轉移 |
| GET/POST/DELETE | `/api/conversations/:id/tags` | 標籤管理 |
| GET/POST | `/api/conversations/:id/messages` | 訊息（與 messaging 模組共用） |

## 6. 涉及的 Durable Objects

- **`ConversationRoom`** — 每個對話一個實例，維護成員、訊息流
- **`UserConnection`** — 追蹤客服連線
- **`MessageBroadcaster`** — 跨房間事件廣播
- **`LatestMessageCacheCoordinator`** — 列表查詢的最新訊息快取

## 7. 邊界案例與小細節

- **沒有真正的刪除**：對話不會被刪掉，只用狀態欄位控制可見性
- **批次上限 100**：超過會被拒絕；權限不足的對話自動從批次中過濾
- **轉移原因為選用**：但建議填寫，方便日後稽核
- **訊息計數用子查詢**：避免 N+1 query 性能問題
- **個人指派已退場**：歷史 API 仍存在但會回 410 Gone

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 列表很慢 | 檢查 `LatestMessageCacheCoordinator` 是否正常運作 |
| 批次操作部分成功 | 看回傳的 `failed[]` 陣列，多半是權限問題 |
| 轉移後對話不見 | 確認接收團隊的 `allowedTeamIds` 是否包含當前用戶 |

---

**相關模組**：[messaging](./messaging.md)（訊息本體）、[teams](./teams.md)（指派目標）、[tags](./tags.md)（分類）、[customer](./customer.md)（對話對象）
