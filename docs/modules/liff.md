# LIFF 模組 — LINE Front-end Framework 團隊綁定

> **位置**: `src/modules/liff/`  
> **角色**: 透過 LINE LIFF QR Code 把客戶「黏」到指定客服團隊。

---

## 1. 這個模組是什麼？

LIFF（LINE Front-end Framework）讓你可以做一個跑在 LINE 內的迷你網頁。本模組利用 LIFF 做「掃 QR → 自動綁團隊」的流程：客戶掃了業務組的 QR，未來訊息就自動進業務組。

## 2. 解決什麼問題？

| 場景 | LIFF 模組做什麼 |
|---|---|
| 客戶從業務名片掃 QR | 開 LIFF → 紀錄該客戶屬「業務組」 |
| 客戶第一次來訊但還沒加好友 | WebSocket 預通知客服「pending 對話即將出現」 |
| 客戶換掃了「客服組」QR | 重新指派團隊並廣播 transfer 事件 |
| 客戶完成加好友 | 自動寄歡迎訊息，同步團隊 |

## 3. 主要功能

- **LIFF 設定端點**：給前端 LIFF app bootstrap 用
- **團隊資訊端點**：給 LIFF UI 顯示組名 / 描述
- **QR Code 綁定**：紀錄到 `customerTeamAssignments` 表
- **WebSocket 預通知**：客服在客戶實際發訊前就看到「準備中」對話（延遲從 2-8s 降到 < 500ms）
- **Welcome 訊息**：完成加好友後自動發
- **重新綁定**：已存在客戶掃新 QR 會更新團隊
- **掃描計數**：累計到 `teamLiffQrCodes.scanCount`

## 4. 操作介面入口

獨立的 LIFF mini-app（**不是管理後台**），客戶從 LINE 內開啟。設定面板可在 [Teams 模組](./teams.md) 產生 QR。

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/liff/config` | LIFF 啟動設定（liffId, lineBotId, apiEndpoint） |
| GET | `/api/liff/health` | 健康檢查 |
| GET | `/api/liff/teams/:teamId` | 取團隊顯示資訊 |
| POST | `/api/liff/assign-team` | 紀錄掃描指派 |
| POST | `/api/liff/welcome` | 寄歡迎訊息 + 同步指派 |

## 6. 涉及的 Durable Objects

- **`MessageBroadcaster`**（透過 `WebSocketBroadcastService.broadcastConversationTransferred`）— 預通知 / 轉移事件廣播
- 可能間接觸發 `CustomerConversationDO` / `CustomerMessageDO`

## 7. 邊界案例與小細節

- **預通知非阻塞**：WebSocket 廣播失敗不影響指派（記 warning）
- **既有好友重新指派**：自動發 transfer 事件，更新 `assignedTeamId`
- **歡迎訊息同步失敗不擋發送**：LINE 訊息照寄
- **bot ID 預設 fallback**：環境沒設 `LINE_BOT_ID` 時用 `@110xsqef`
- **記 user-agent 入 metadata**：稽核用途

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 客戶掃描沒反應 | 確認 LIFF ID 設定正確、HTTPS 證書有效 |
| 預通知不出現 | WebSocket 連線是否在線；查 `MessageBroadcaster` log |
| 客戶被指派到舊團隊 | 確認最近一次掃描是否成功更新 |

---

**相關模組**：[teams](./teams.md)（QR 來源）、[customer](./customer.md)、[integrations](./integrations.md)（LINE 渠道）
