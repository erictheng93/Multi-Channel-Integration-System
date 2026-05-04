# System 模組 — 基礎設施健康與 API 索引

> **位置**: `src/modules/system/`  
> **角色**: 系統「儀表板」的資料來源 — 健康度、KPI、API 索引都在這。

---

## 1. 這個模組是什麼？

System 模組提供「系統層」的對外端點：健康檢查、KPI 統計（今日訊息、線上客服、平均回應時間、滿意度）、訊息回覆樹、API 端點清單。它是 Dashboard 與管理後台的主要資料來源。

## 2. 解決什麼問題？

| 場景 | System 模組做什麼 |
|---|---|
| 老闆問「系統還活著嗎」 | `GET /health` 一秒回答 |
| 早會看「今天表現」 | `GET /stats` 給 KPI 卡片 |
| 客服想看訊息回覆關聯樹 | `GET /conversations/:id/message-tree` |
| 開發者想知道有哪些 API | `GET /api` 機讀清單 |

## 3. 主要功能

- **健康儀表板**：DB / KV / R2 / DO 即時狀態
- **系統統計**：今日訊息、線上客服、回應時間平均、滿意率
- **訊息樹狀**：對話內回覆關係視覺化
- **回覆鏈查詢**：給定訊息找其後續回覆
- **Session 統計**：對話內會話的時長 / 參與度
- **API 索引**：所有端點機讀目錄（給 SDK 產生器或文件用）

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `Dashboard.vue` | 主消費 `/stats` |
| `SystemSettings.vue` | 設定殼層（巢狀路由） |
| `WebSocketMonitoring.vue` | 即時連線監控 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/health` | 公開健康檢查 |
| GET | `/api/system/status` | 詳細狀態（需 JWT） |
| GET | `/api/stats` | 儀表板 KPI |
| GET | `/api/conversations/:id/message-tree` | 訊息樹 |
| GET | `/api/messages/:id/replies` | 回覆鏈 |
| GET | `/api/conversations/:id/sessions` | 會話統計 |
| GET | `/api/api` | API 索引 |

## 6. 涉及的 Durable Objects

僅在 status 端點「列出」DO 類型；**不直接互動**。

## 7. 邊界案例與小細節

- **舊 QR 同步端點已撤**：改用 LIFF 流程（見 [liff](./liff.md)）
- **時區處理用 UTC**：`today.setUTCHours(0,0,0,0)` 避免日光節約問題
- **回應時間人類可讀**：「X 分鐘」或「X 小時 Y 分鐘」
- **滿意率算法**：4-5 星才算 satisfied；無評價預設 0

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| Dashboard KPI 卡空 | 確認 `/stats` 200；檢查 D1 連線 |
| 健康檢查時好時壞 | 看是否觸發限流；查 Cloudflare 狀態頁 |
| 訊息樹斷掉 | `replyToMessageId` 鏈中是否有訊息已 hard delete |

---

**相關模組**：[monitoring](./monitoring.md)（細部指標）、[analytics](./analytics.md)（業務分析）
