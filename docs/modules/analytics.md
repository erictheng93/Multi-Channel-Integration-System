# Analytics 模組 — 業務指標彙整

> **位置**: `src/modules/analytics/`  
> **角色**: 算「對話量」「訊息趨勢」「客服效能」「系統效能」並提供匯出。

---

## 1. 這個模組是什麼？

Analytics 模組把分散在 conversations / messages / users / metrics 的資料，用各種維度聚合（依日 / 平台 / 團隊 / 角色），供 Dashboard、儀表板小工具與 ad-hoc 報表使用。

## 2. 解決什麼問題？

| 場景 | Analytics 模組做什麼 |
|---|---|
| 主管想看本週 vs 上週對話量 | `GET /conversations` + 期間參數 |
| 想知道哪個平台訊息最多 | `groupBy=platform` |
| 看每個 agent 接客戶數 | `GET /users?userType=agent` |
| 查 P95 回應時間 | `GET /performance?metrics=response_times` |
| 自製查詢 | `POST /custom` |
| 匯出 CSV 給老闆 | `POST /export?format=csv` |

## 3. 主要功能

- **對話分析**：總量、狀態分布、平台分布、回應時間、依團隊 / 平台 / 日期分組
- **訊息分析**：每小時量、入站 / 出站比、趨勢
- **使用者分析**：活躍人數、依角色、登入頻率
- **效能指標**：P50 / P95、吞吐、錯誤率、延遲趨勢
- **自訂查詢**：含篩選 / 分組 / 排序
- **資料匯出**：JSON / CSV / PDF（PDF 可嵌圖表）
- **即時儀表板**：WebSocket 推送活指標

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `Dashboard.vue` | lazy-load AnalyticsComparison 區塊 |
| `ComparisonDashboardExample.vue` | 期間比較小工具 |
| 自訂儀表板頁面 | DashboardService 管理拖拉佈局 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/analytics/conversations` | 對話指標 |
| GET | `/api/analytics/messages` | 訊息指標 |
| GET | `/api/analytics/users` | 使用者指標 |
| GET | `/api/analytics/performance` | 效能指標 |
| POST | `/api/analytics/custom` | 自訂查詢 |
| POST | `/api/analytics/export` | 匯出 |
| GET | `/api/analytics/health` | 健康 |
| GET / POST | `/api/analytics/metrics/:name` | 指標查 / 寫入 |
| 多端點 | `/api/analytics/dashboard/...` | 儀表板 / widget / layout 管理 |

## 6. 涉及的 Durable Objects

- **`MetricsCollectorDO`** — 消費定期快照
- 中介層攔截所有請求標 `(method, path, status, responseTime)` 入庫

## 7. 邊界案例與小細節

- **KV 快取策略**：分析結果有可調 TTL；DB 查失敗回退舊資料
- **時區支援**：Asia/Taipei、UTC、America/New_York、Europe/London
- **百分位計算**：每端點 200 筆滾動視窗算 P50 / P95
- **時間範圍語法**：`7d` / `24h` / `30d` 或明確 startDate/endDate；預設 7d
- **併發查詢上限**：每用戶最多 5 個並行報表生成

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| 數字不更新 | KV 快取尚未失效；確認 TTL |
| 自訂查詢回 400 | 看 filters / groupBy 語法 |
| 匯出檔很大 | 縮短時間範圍；用 CSV 比 JSON 小 |

---

**相關模組**：[reports](./reports.md)（更高階報表）、[monitoring](./monitoring.md)、[system](./system.md)
