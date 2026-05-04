# Messaging 模組 — 訊息核心引擎

> **位置**: `src/modules/messaging/`  
> **角色**: 所有訊息級操作的引擎：建立、搜尋、撤回、轉發、附件、匯出。

---

## 1. 這個模組是什麼？

訊息與對話是兩個不同抽象層 —— 對話是「容器」，訊息是「內容」。Messaging 模組專注在「內容」這層，提供強大的搜尋、撤回、轉發、附件、匯出能力。

## 2. 解決什麼問題？

| 場景 | Messaging 模組做什麼 |
|---|---|
| 客服打錯字想撤回 | 在 deadline（預設 5 分鐘）內可撤回 |
| 想把同樣訊息發給多個客戶 | `POST /:id/forward` 一次轉發 ≤ 20 對話 |
| 主管要月底匯出對話紀錄 | `POST /export` 輸出 JSON / CSV |
| 客戶說過「我要退款」要找出來 | `GET /search?q=退款` 全文搜 |
| 訊息要附 PDF | `POST /:id/attachments` 串連 R2 |

## 3. 主要功能

- **完整 CRUD**：建立 / 取得 / 更新 / 刪除
- **訊息撤回**：軟刪除（`isRecalled=true` + `recalledAt`），有期限
- **訊息轉發**：≤ 20 個目標、附選用註解
- **全文搜尋**：跨對話、可篩訊息類型 / 寄件人 / 日期 / 撤回狀態
- **附件管理**：上傳到 R2、依訊息列出、可下載
- **匯出**：JSON / CSV 兩種格式
- **訊息標籤**：訊息級分類（與對話標籤不同）
- **批次操作**：建立 / 刪除多筆，含逐筆錯誤追蹤
- **回覆鏈**：`replyToMessageId` + `threadId` 支援巢狀討論
- **@mention**：解析訊息內容中的 @username 自動觸發提及通知

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `ConversationDetail.vue` | 訊息列表、發送、撤回、轉發 |
| `Dashboard.vue` | 訊息統計小工具 |
| API clients | `frontend/src/api/messages.ts`, `export.ts`, `delayedMessages.ts` |

## 5. 主要 API 端點（部分）

| 方法 | 路徑 | 用途 |
|---|---|---|
| POST | `/api/messages` | 建立訊息 |
| GET | `/api/messages/:id` | 詳細（含寄件人與對話） |
| PUT/DELETE | `/api/messages/:id` | 更新 / 刪除 |
| GET | `/api/messages/conversation/:conversationId` | 對話內訊息分頁 |
| GET | `/api/messages/search` | 全文搜尋 |
| GET | `/api/messages/stats` | 統計 |
| POST | `/api/messages/:id/forward` | 轉發 |
| GET/POST | `/api/messages/:id/attachments` | 附件 |
| POST | `/api/messages/export` | 匯出（JSON / CSV） |
| POST | `/api/messages/bulk-create` `bulk-delete` | 批次操作 |

## 6. 涉及的 Durable Objects

- **`MessageBroadcaster`** — 廣播新訊息與編輯給訂閱者
- **`ConversationRoom`** — 把訊息送達連線中的客服

## 7. 邊界案例與小細節

- **撤回是軟刪除**：訊息留著但 `isRecalled=true`，仍可被獨立搜尋
- **撤回有 deadline**：超時呼叫會回 "deadline exceeded" 錯誤
- **轉發上限 20**：防止濫用；目標對話的權限會逐一檢查
- **delivery status 流轉**：`pending → sent → delivered → failed / recalled`
- **附件清理**：訊息建立失敗時，暫存的 R2 檔案會被清掉
- **session sequence**：訊息含 `sessionSequence` 欄位，跨客戶端正確排序

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 撤回失敗 | 看是否超過 deadline；前端要顯示倒數 |
| 搜尋很慢 | 確認 D1 索引；考慮加上時間範圍縮小結果 |
| 附件沒顯示 | 確認 `getPublicFileUrl` 路徑生成正確 |

---

**相關模組**：[conversations](./conversations.md)、[delayed-message](./delayed-message.md)、[file-management](./file-management.md)
