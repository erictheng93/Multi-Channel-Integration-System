# Session 模組 — 對話會話切分與分析

> **位置**: `src/modules/session/`  
> **角色**: 把長對話切成有意義的「會話段落」（topic / 主題 / 工單），讓統計分析有粒度。

---

## 1. 這個模組是什麼？

一個客戶可能跟客服聊了三個月，談了 5 個不同的問題。Session 模組做的就是「自動偵測話題切換」並把對話切成幾段，每段有自己的開始 / 結束時間、主題、訊息數、參與者。

> 注意：「Session」在這個專案裡指**對話會話段落**，不是登入會話（登入會話請見 [auth](./auth.md)）。

## 2. 解決什麼問題？

| 場景 | Session 模組做什麼 |
|---|---|
| 主管想看「這個月平均處理時長」 | 用 session 開始 / 結束時間計算 |
| 客服想搜「上次討論退款的那段對話」 | `/sessions/search?q=退款` 全文搜 |
| 訂閱客戶第三次問同一問題 | 主題分析自動聚類，標記「重複問題」 |
| 客戶回覆中斷對話 | `detect-boundary` 判定要不要開新 session |

## 3. 主要功能

- **完整生命週期**：建立 / 更新 / 關閉 / 重開
- **智慧邊界偵測**：分析訊息內容判斷話題是否切換
- **Get-or-create**：訊息進來時自動決定是否新開 session
- **健康度分析**：訊息密度、情緒、參與度
- **主題抽取與建議**：從訊息內容萃取關鍵字、推薦 top 3 主題
- **批次操作**：一次關閉 / 重開 / 刪除多筆
- **全文搜尋**：跨所有 session 訊息搜關鍵字
- **活動趨勢**：每小時 / 每日訊息量、尖峰時段

## 4. 操作介面入口

| 介面 | 看到什麼 |
|---|---|
| `ConversationDetail.vue` | 對話時間軸上的「session 分隔線」與主題標籤 |
| `Reports.vue` | Session 平均長度、最忙主題等指標 |
| 全文搜尋介面 | 後端是 `/sessions/search` |

## 5. 主要 API 端點（部分）

| 方法 | 路徑 | 用途 |
|---|---|---|
| POST | `/api/sessions` | 建立新 session |
| GET | `/api/sessions` | 列表（分頁、篩選） |
| POST | `/api/sessions/:id/close` | 關閉並結算統計 |
| POST | `/api/sessions/:id/reopen` | 重開（僅限已關閉） |
| GET | `/api/sessions/:id/messages` | 取段落內訊息 |
| GET | `/api/sessions/:id/health` | 健康度分析 |
| POST | `/api/sessions/detect-boundary` | 判定訊息是否跨段 |
| POST | `/api/sessions/get-or-create` | 自動取得或建立 session |
| GET | `/api/sessions/search?q=` | 全文搜尋 |
| POST | `/api/sessions/topics/analyze` | 抽取主題 |
| POST | `/api/sessions/topics/suggest?limit=3` | 推薦主題 |
| POST | `/api/sessions/batch` | 批次操作 |

## 6. 涉及的 Durable Objects

純資料庫驅動，**不直接使用 DO**。如需即時推送 session 邊界事件，可透過 `ConversationRoom` 廣播。

## 7. 邊界案例與小細節

- **邊界偵測非自動觸發**：呼叫端必須主動呼叫 `/detect-boundary` 或 `/get-or-create`
- **關閉是冪等的**：對已關閉的 session 再呼叫 close 不會出錯
- **重開只對已關閉有效**：對開啟中的 session 重開會回錯誤
- **刪除是軟刪除**：更新 `deletedAt`，仍會出現在統計除非明確篩出
- **權限分層**：客服只能看自己被指派對話的 session；管理員看全部
- **批次部分成功**：回傳成功 ID 與失敗 ID 兩個陣列

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| Session 分得太碎 | 邊界偵測門檻可在服務層調整 |
| 主題分析結果差 | 信心分數低代表該訊息缺乏明確語意 |
| 統計數字跟對話數對不上 | 一個對話可能有多個 session；以 session 為單位計算 |

---

**相關模組**：[conversations](./conversations.md)（對話本體）、[reports](./reports.md)（會話級統計）
