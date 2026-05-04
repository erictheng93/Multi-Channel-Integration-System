# Realtime 模組 — 即時事件總匯

> **位置**: `src/modules/realtime/`  
> **角色**: 把 WebSocket 連線承載的「位元流」，包裝成有意義的「事件」（打字、指派、狀態變更）。

---

## 1. 這個模組是什麼？

Realtime 模組處理所有「即時事件」的語意：誰在打字？對話被指派給誰？用戶現在的狀態是線上還是離開？它建立在 [WebSocket 模組](./websocket.md) 之上，負責把這些抽象事件路由到正確的接收者。

## 2. 解決什麼問題？

| 場景 | Realtime 模組做什麼 |
|---|---|
| 客服 A 看到客戶 B 正在輸入「...」 | 發送 `typing_started` 事件到該對話房間 |
| 主管把對話從 A 轉給 B | 發送 `assignment_changed` 事件給雙方 |
| 系統要全站公告維護 | 發送 `system_announcement` 給所有在線用戶 |
| 客服把狀態切到「忙碌」 | 廣播 `presence_updated` 給其有權看到的同事 |

## 3. 主要功能

- **打字狀態**：`typing_started` / `typing_stopped`，自動排除送出者本人
- **線上狀態**：online / away / busy / offline 四種，附帶 `currentConversation` 與自訂 metadata
- **指派變更通知**：對話換手時雙方即時得知
- **優先級事件路由**：low / normal / high / urgent — urgent 跳過批次直接送出
- **系統公告**：管理員專用，含嚴重度（low/medium/high/critical）
- **事件統計**：以 1000 筆滾動視窗追蹤事件處理時間，每小時重置

## 4. 操作介面入口

通常**不直接被人操作** — Realtime 是底層服務，UI 透過以下方式間接使用：
- 對話頁面的「正在輸入」泡泡
- 用戶頭像旁的綠/黃/紅圓點（線上狀態）
- 對話列表的指派變更小提示
- 全站公告橫幅（管理員觸發後所有人看到）

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| POST | `/api/realtime/typing` | 送出打字狀態（start / stop） |
| POST | `/api/realtime/presence` | 更新自己的線上狀態 |
| POST | `/api/realtime/broadcast-to-conversation` | 廣播自訂事件到對話房間 |
| POST | `/api/realtime/send-*-event` | 型別安全的事件發送家族（message / status / assignment / notification / system） |
| GET | `/api/realtime/stats` | 事件處理統計 |
| GET/POST | `/api/realtime/config` | 管理員配置 |

## 6. 涉及的 Durable Objects

- **`ConversationRoom`** — 接收打字、狀態、指派事件並廣播給房間成員
- **`UserConnection`** — 接收用戶範圍事件（個人通知、狀態同步）
- **`MessageBroadcaster`** — 系統級事件分發

## 7. 邊界案例與小細節

- **送出者不收回音**：自己打字不會看到自己的「正在輸入」泡泡
- **嚴格事件驗證**：`EventValidator` 會拒絕格式不符的事件，每種事件有獨立驗證器
- **錯誤不外傳**：事件送出失敗只更新 `error_count` 統計，不會把錯誤回傳給用戶端（避免影響體驗）
- **SSE 已完全移除**：v4 唯一遞送通道是 WebSocket，舊的 SSE 程式碼已下架

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 打字泡泡顯示卡住不消失 | 檢查前端是否正確發送 `typing_stopped`；後端有 10 秒自動 timeout 兜底 |
| 線上狀態長時間不更新 | 確認 `UserConnection` DO 是否被清理；檢查 heartbeat |
| 緊急公告沒送到 | 看 `/api/realtime/stats` 的 urgent 分類；檢查接收者是否真的在線 |

---

**相關模組**：[websocket](./websocket.md)（傳輸層）、[collaboration](./collaboration.md)（協作狀態的持久化）
