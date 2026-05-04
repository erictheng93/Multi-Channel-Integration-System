# Monitoring 模組 — 細粒度可觀測性與斷路器

> **位置**: `src/modules/monitoring/`  
> **角色**: 觀察 Durable Objects、警報、斷路器，是 SRE 的儀表板。

---

## 1. 這個模組是什麼？

System 模組看「系統整體生死」，Monitoring 模組看「每個元件的細節」：每個 DO 實例的延遲與錯誤率、活躍警報、斷路器狀態。它讓 SRE 能在事件發生時快速定位。

## 2. 解決什麼問題？

| 場景 | Monitoring 模組做什麼 |
|---|---|
| 系統突然慢，要找哪個 DO 有問題 | `GET /metrics` 看每個實例延遲 |
| 過載要緊急斷流 | `POST /circuit-breaker/open` |
| 想看歷史警報 | `GET /alerts/history?limit=N` |
| 確認分區性能 | `GET /instances/:type` |

## 3. 主要功能

- **健康狀態儀表板**：healthy / degraded / unhealthy 三態
- **詳細指標**：每端點延遲、錯誤率、連線數、記憶體、運行時間（admin）
- **活躍警報源**：含 severity、type、age
- **警報歷史**：分頁查詢、可調 limit
- **斷路器手動控制**：開 / 重置 / 查狀態（緊急用）
- **依 DO 類型篩選**：`ConversationRoom` / `UserConnection` / `MessageBroadcaster` 等

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `ApiMonitor.vue` | 端點延遲 / 錯誤率（用 metrics 端點） |
| `WebSocketMonitoring.vue` | 即時連線指標 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/monitoring/health` | 公開健康 |
| GET | `/api/monitoring/metrics` | 詳細指標（admin） |
| GET | `/api/monitoring/alerts` | 活躍警報 |
| GET | `/api/monitoring/alerts/history?limit=N` | 警報歷史 |
| POST | `/api/monitoring/health-check` | 手動觸發健康檢查 |
| GET | `/api/monitoring/circuit-breaker/status` | 斷路器狀態 |
| POST | `/api/monitoring/circuit-breaker/reset` `/open` | 重置 / 開啟（緊急） |
| GET | `/api/monitoring/instances/:type` | 依 DO 類型查實例 |

## 6. 涉及的 Durable Objects

- **`MetricsCollectorDO`** — 主要資料源（即時指標累加器）
- **`RateLimiterDO`** — middleware 引用，請求節流

## 7. 邊界案例與小細節

- **HTTP 207 Multi-Status**：degraded 時回 207，不是 200（標準 SRE 做法）
- **斷路器是緊急開關**：開啟後立即拒絕請求；只能 admin 操作
- **健康判定門檻**：≥ 70% 健康 = healthy，30-70% = degraded，< 30% = unhealthy
- **警報歷史分頁**：metrics response 內最多 20 筆；`?limit=N` 控制

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| metrics 都是 0 | `MetricsCollectorDO` 是否正常 ingest（middleware 有沒有掛上） |
| 斷路器跳閘 | 看為何觸發，確認原因排除後再 reset |
| degraded 一直回不來 | 個別 DO 實例可能還在啟動中 |

---

**相關模組**：[system](./system.md)、[analytics](./analytics.md)、`MetricsCollectorDO`（見 `docs/CURRENT_STATUS.md`）
