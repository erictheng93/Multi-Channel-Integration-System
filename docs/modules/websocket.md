# WebSocket 模組 — 即時連線基石

> **位置**: `src/modules/websocket/`  
> **角色**: 整個系統即時通訊的「總機」 — 所有對話、狀態、通知都透過它送達。

---

## 1. 這個模組是什麼？

WebSocket 模組負責建立並維護「客服人員瀏覽器 ↔ Cloudflare Workers」之間的雙向長連線。它取代了舊版 v3 的 SSE（Server-Sent Events）+ KV 輪詢方案，把訊息延遲從 P95 約 2 秒降到 < 500ms。

簡單說：**沒有它，所有「即時」功能都會退化成需要按 F5 才會更新。**

## 2. 解決什麼問題？

| 痛點（沒有 WebSocket 模組時） | 解決方式 |
|---|---|
| 客戶傳訊息，客服要重新整理才看得到 | 連線建立後，新訊息直接推送 |
| 同事正在打字，自己完全不知道 | 透過 ConversationRoom DO 廣播打字狀態 |
| 換頁就斷線 | UserConnection DO 保留多分頁狀態 |
| 高峰期撐不住 1000+ 連線 | Durable Objects 分散式架構，1000+ 併發無壓力 |

## 3. 主要功能

- **連線升級**：`GET /api/websocket/connect?conversationId=X` 將 HTTP 升級為 WebSocket
- **多分頁同步**：同一帳號開多個分頁，皆能收到同一份事件
- **心跳偵測**：每 30 秒一次 ping，無回應自動重連
- **連線數限制**：單一用戶上限 10 條、全域 10,000 條（防止資源被耗盡）
- **健康檢查**：`/api/websocket/health` 即時看連線數、延遲、錯誤率
- **批次訊息**：300ms 視窗合併最多 50 個事件，DO 呼叫量降 60–80%
- **優雅斷線**：`POST /api/websocket/disconnect` 主動釋放資源

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `WebSocketAdmin.vue` | 管理員後台（連線數、強制斷線、設定） |
| `WebSocketMonitoring.vue` | 即時監控儀表板 |
| 所有對話頁面 | 隱式使用，透過 `useWebSocket()` composable |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/websocket/connect` | 建立 WebSocket 連線（HTTP Upgrade） |
| POST | `/api/websocket/disconnect` | 主動斷線 |
| GET | `/api/websocket/health` | 連線健康指標 |
| GET | `/api/websocket/migration-status` | 遷移狀態（v3→v4 已 100%） |
| GET | `/api/websocket/test-connection` | 整合測試端點 |

## 6. 涉及的 Durable Objects

- **`UserConnection`** — 每位用戶一個實例，保存其所有分頁的訂閱狀態
- **`ConversationRoom`** — 每個對話一個實例，管理該對話的成員、打字、線上狀態
- **`MessageBroadcaster`** — 全域單例，跨房間事件分發中心

## 7. 邊界案例與小細節

- **連線升級不走主路由**：升級請求會直接導向目標 DO，避免被 Hono middleware 攔截造成 WebSocket 握手失敗
- **失效模式為 fail-closed**：速率限制器若不可用，預設拒絕新連線（避免雪崩）
- **分散式鎖 TTL 2 秒**：清理流程使用鎖防止競態，超時自動釋放
- **批次視窗會延後事件**：低優先級事件會被批次延遲最多 300ms；高優先級事件立即送出

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 連線一建立就斷 | 檢查 `wrangler.toml` 的 DO 綁定是否正確、JWT 是否過期 |
| 訊息延遲變高 | 看 `/api/websocket/health` 的批次堆積是否異常 |
| 達到連線上限 | 確認用戶是否真的開了 10+ 分頁；考慮在 `constants/limits.ts` 調整 |

---

**相關模組**：[realtime](./realtime.md)（事件語意層）、[collaboration](./collaboration.md)（協作狀態）、[notifications](./notifications.md)（通知遞送）
