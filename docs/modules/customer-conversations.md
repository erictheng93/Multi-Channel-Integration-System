# Customer-Conversations 模組 — 客戶端即時聊天橋接

> **位置**: `src/modules/customer-conversations/`  
> **角色**: 給「客戶端聊天介面」用的 WebSocket 入口（區別於客服後台用的 [websocket](./websocket.md)）。

---

## 1. 這個模組是什麼？

這是個「橋接層」：把客戶端網頁聊天介面的訊息與檔案上傳，導向專屬的 Durable Objects（`CustomerConversationDO` / `CustomerMessageDO`），與客服後台的對話系統解耦但即時同步。

## 2. 解決什麼問題？

| 場景 | 模組做什麼 |
|---|---|
| 客戶在網頁聊天視窗打字 | WebSocket 直接連到 `CustomerConversationDO` |
| 客戶上傳一張圖片 | 暫存到 R2 → 建訊息 → 連結 attachment |
| 客戶想看上次的對話 | `GET /:id/messages` 分頁取歷史 |
| 客服在後台回覆 | 透過 `MessageBroadcaster` 即時推播給客戶端 |

## 3. 主要功能

- **WebSocket 升級**：客戶端專用入口，使用 sessionId 認證
- **訊息發送與接收**：含打字狀態與已讀回執
- **檔案上傳**：上限 10MB，先暫存後關聯
- **分頁歷史**：訊息歷史可分批載入

## 4. 操作介面入口

客戶端聊天介面（通常是嵌入網站的小元件，**不在管理後台內**）。後台不直接使用此模組。

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/customer-ws` | WebSocket 升級（query: conversationId, sessionId） |
| POST | `/:id/messages` | 發送訊息（轉發給 `CustomerMessageDO`） |
| GET | `/:id/messages` | 取訊息歷史 |
| POST | `/:id/upload` | 上傳附件 |

## 6. 涉及的 Durable Objects

- **`CustomerConversationDO`** — 管理連線、廣播訊息給連線中的客戶與客服
- **`CustomerMessageDO`** — 訊息 CRUD、檔案上傳、內容驗證

## 7. 邊界案例與小細節

- **不用 JWT**：用 `x-session-id` 標頭，先驗證 conversation 存取權再放行
- **Body 必須先讀**：傳入 DO 前要先消費 request body，避免 "body already consumed" 錯誤
- **DO ID 用 `idFromName(conversationId)`**：同對話永遠路由到同 DO 實例
- **暫存檔案模式**：上傳先丟到 R2 的 `pending/` 路徑，訊息建立後才搬到永久路徑

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| WebSocket 一直握手失敗 | sessionId 是否仍有效、conversationId 是否正確 |
| 上傳檔案沒顯示 | 確認訊息建立是否成功（pending 路徑會被定期清理） |
| 客服端看不到客戶訊息 | 確認 `MessageBroadcaster` 廣播設定 |

---

**相關模組**：[messaging](./messaging.md)、[file-management](./file-management.md)、[websocket](./websocket.md)
