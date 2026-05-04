# Customer 模組 — 客戶資料與身分整合

> **位置**: `src/modules/customer/`  
> **角色**: 客戶（end user）的單一資料來源，跨平台聚合身分與歷史。

---

## 1. 這個模組是什麼？

每一位透過 LINE / Facebook / 網頁聊天進入系統的客戶，都需要一個資料檔。Customer 模組負責建立、查詢、更新這些資料，並提供標籤與歷史對話聚合。

## 2. 解決什麼問題？

| 場景 | Customer 模組做什麼 |
|---|---|
| 同一個 LINE 用戶第二次來 | 透過 `(platform, platformUserId)` 認出舊客 |
| 想標記 VIP 客戶 | 加上 `VIP` 標籤，未來自動高優先級 |
| 客服想看客戶過去的對話 | `GET /:customerId` 回傳所有對話 |
| 行銷想找所有有電話的客戶 | `GET /` + `hasPhone=true` 篩選 |

## 3. 主要功能

- **跨平台身分**：以 `(platform, platformUserId)` 為複合鍵唯一識別
- **完整資料儲存**：暱稱、頭像、Email、電話、自訂 metadata（JSON）
- **平台 ID 查找**：給定平台用戶 ID，回客戶與所有對話
- **標籤系統整合**：增 / 刪 / 改 / 取代客戶標籤
- **來源團隊追蹤**：`sourceTeamId` 記錄首次接觸的團隊
- **多維度篩選**：依平台、團隊、標籤、Email/電話有無、日期

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `CustomerTags.vue` | 客戶標籤管理 |
| `ConversationList.vue` | 對話列表中顯示客戶名稱 |
| `Dashboard.vue` | 客戶統計摘要 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/customers` | 列表 + 篩選 |
| GET | `/api/customers/platform/:platform/:platformUserId` | 平台 ID 查找 |
| GET | `/api/customers/:customerId` | 詳細（含所有對話） |
| GET | `/api/customers/:customerId/tags` | 列出標籤 |
| POST | `/api/customers/:customerId/tags` | 新增標籤 |
| PUT | `/api/customers/:customerId/tags` | 取代所有標籤 |
| DELETE | `/api/customers/:customerId/tags` | 移除標籤 |
| GET | `/api/customers/tags/available` | 可用標籤清單（含 conversationCount） |

## 6. 涉及的 Durable Objects

純 D1 資料庫，**不直接使用 DO**。對話相關更新可能間接觸發 `MessageBroadcaster`。

## 7. 邊界案例與小細節

- **平台身分獨立**：同一人若同時有 LINE 與 Facebook 帳號，會被視為「兩個客戶」（這是設計，不是 bug）
- **客戶不刪除**：歷史完整保留，僅可移除其標籤
- **metadata 是 JSON 欄位**：可塞平台原生 profile（如 LINE 完整 profile）
- **標籤是全域的**：不存在「某客戶獨有的標籤」

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 同個人出現兩次 | 確認是否 LINE/FB 雙平台；目前無自動合併 |
| 標籤計數不準 | `getAvailableTags` 有 `conversationCount` 子查詢，確認 SQL 正確 |
| 找不到客戶 | 確認 `platformUserId` 大小寫與 LINE 原值一致 |

---

**相關模組**：[customer-conversations](./customer-conversations.md)（客戶端聊天）、[tags](./tags.md)、[conversations](./conversations.md)
