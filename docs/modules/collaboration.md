# Collaboration 模組 — 協作狀態與在場感

> **位置**: `src/modules/collaboration/`  
> **角色**: 管理「誰正在看這個對話、誰正在打字、誰剛離開」。

---

## 1. 這個模組是什麼？

Collaboration 模組維護對話房間的「在場名單」（viewers）與打字集合（typing set），讓客服團隊可以看到「對話 #1234 現在被同事小王和小李同時看著」。它是「協作感」的來源 —— 沒有它，每個人都像在獨自工作。

## 2. 解決什麼問題？

| 場景 | Collaboration 模組做什麼 |
|---|---|
| 兩個客服同時點開同一對話 | 兩人都看到對方的頭像出現在「正在查看」清單 |
| 客戶傳訊息時主管也想旁聽 | 主管加入房間後，名單即時更新 |
| 客服關閉分頁離開 | 自動觸發 leave 事件，名單立即移除 |
| 想知道團隊整體協作熱度 | `/api/collaboration/stats` 看活躍對話數、打字人數 |

## 3. 主要功能

- **即時 viewers 名單**：對話頁面右上角頭像列表
- **打字指示器**：含使用者身分（不只「有人在打字」而是「小王正在打字」）
- **加入 / 離開事件**：自動廣播給房間其他成員
- **線上狀態管理**：online / away / busy / offline，附 `currentConversation` 上下文
- **狀態快照**：可隨時取出某對話完整協作狀態
- **過期清理**：管理員可批次清掉超過 5 分鐘的殭屍記錄

## 4. 操作介面入口

| 介面 | 看到什麼 |
|---|---|
| `ConversationDetail.vue` | 右上角「正在查看」頭像列、對話框上方「對方正在輸入」 |
| `Dashboard.vue` | 整體協作統計卡片 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/collaboration/conversations/:id/state` | 取得房間完整狀態 |
| GET | `/api/collaboration/conversations/:id/viewers` | 列出當前查看者 |
| POST | `/api/collaboration/conversations/:id/join` | 加入房間（自動發送 join 事件） |
| POST | `/api/collaboration/conversations/:id/leave` | 離開房間 |
| POST | `/api/collaboration/typing` | 發送打字狀態 |
| POST | `/api/collaboration/presence` | 更新線上狀態 |
| GET | `/api/collaboration/stats` | 全域協作指標 |
| POST | `/api/collaboration/cleanup` | （管理員）清理過期狀態 |

## 6. 涉及的 Durable Objects

- **`ConversationRoom`** — 主要：保存 viewers 與 typing 集合，廣播 join/leave/typing 事件
- **`UserConnection`** — 接收 leave 事件，清理該用戶的訂閱
- **`MessageBroadcaster`** — 跨房間 presence 廣播（如啟用）

## 7. 邊界案例與小細節

- **WebSocket vs HTTP 通道差異**：用 WebSocket 加入時狀態存在 DO 記憶體；用 HTTP 加入時退回 KV
- **打字 10 秒自動停止**：前端必須做 debounce，否則 server 端 10 秒後會自動發 `typing_stopped`
- **離開動作是原子的**：同時清理 `UserConnection` 訂閱與 `ConversationRoom` 名單
- **加入需通過權限檢查**：使用者角色不符合對話權限會被拒絕

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 同事頭像沒消失（但人已離開） | 跑一次 `/api/collaboration/cleanup`；確認 leave 事件有送達 |
| 看不到自己的頭像 | 預期行為 — viewers 不顯示自己 |
| 打字泡泡跳很快（閃爍） | 前端未正確 debounce typing 事件 |

---

**相關模組**：[realtime](./realtime.md)（事件語意層）、[conversations](./conversations.md)（對話本體）
