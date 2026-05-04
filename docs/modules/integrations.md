# Integrations 模組 — 多渠道平台連線

> **位置**: `src/modules/integrations/`  
> **角色**: 把 LINE、Facebook、未來的 WhatsApp / Instagram / Telegram 接到系統裡。

---

## 1. 這個模組是什麼？

每個外部平台（LINE OA、Facebook 粉專）都需要：憑證、Webhook URL、訊息發送 API。Integrations 模組統一管理這些「對外渠道」，加密儲存憑證、驗證連線健康、收集統計。

## 2. 解決什麼問題？

| 場景 | Integrations 模組做什麼 |
|---|---|
| 接上新的 LINE 官方帳號 | `POST /channels` 設 channelId / accessToken / secret |
| 想知道 LINE 連線是否正常 | `GET /:id/health` 試打 LINE API |
| 想看本月 Facebook 收到幾封 | `GET /:id/stats` 看 totalReceived |
| 換新的 access token | `PUT /:id` 更新（自動重新加密） |
| 渠道暫停一陣子 | `DELETE /:id`（軟刪） |

## 3. 主要功能

- **多平台支援**：LINE、Facebook（架構就緒）、WhatsApp / Telegram / Instagram / WeChat（規劃中）
- **AES-256-GCM 憑證加密**：隨機 IV + auth tag，安全性符合企業標準
- **健康檢查**：實際呼叫平台 API 驗證可用性
- **連線測試**：可發測試訊息驗證
- **統計收集**：依平台累計 totalSent / totalReceived
- **平台能力矩陣**：列出每平台支援的功能（文字、圖、檔、Rich Menu、廣播）
- **多租戶隔離**：依團隊範圍管控
- **軟刪除**：保留歷史對話與訊息

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `PlatformIntegration.vue` | 平台連線總覽 |
| `ChannelManagement.vue` | 渠道清單與設定 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET / POST | `/api/channels` | 列表 / 建立（admin） |
| GET / PUT / DELETE | `/api/channels/:id` | 取得 / 更新 / 軟刪（admin） |
| GET | `/api/channels/:id/stats` | 訊息統計 |
| GET | `/api/channels/:id/health` | 連線健康 |
| POST | `/api/channels/:id/verify` | 設定驗證（可送測試訊息） |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。Webhook 簽章驗證等服務在 service 層處理。

## 7. 邊界案例與小細節

- **回應自動移除憑證**：API 回傳會 strip credentials，避免外洩
- **HMAC-SHA256 簽章驗證**：LINE 與 Facebook 都用，含 timing-safe equality（防時序攻擊）
- **JSON 設定欄位**：`config`、`credentials`、`webhookConfig`、`stats` 全是 JSON column，加新平台不用改 schema
- **stats 增量更新**：每次訊息進出 +1，避免大查詢
- **admin 可跨團隊建渠道**：若 admin 沒 primaryTeamId，可在 body 帶 teamId
- **與 Migration 0026 相關**：JSON 欄位設計來自此次 migration

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| Webhook 收不到訊息 | 確認簽章驗證通過、URL 設定正確 |
| 健康檢查 fail | 平台 API token 過期？查 `/health` 錯誤訊息 |
| 統計數字不動 | 確認 webhook 處理時有呼叫 stats 累加 |

---

**相關模組**：[liff](./liff.md)（LINE 額外整合）、[messaging](./messaging.md)、[queue](./queue.md)（出站訊息）
