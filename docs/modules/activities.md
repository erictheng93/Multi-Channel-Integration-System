# Activities 模組 — 全系統稽核日誌

> **位置**: `src/modules/activities/`  
> **角色**: 紀錄「誰在何時對什麼做了什麼」 — 合規、除錯、責任追溯都靠它。

---

## 1. 這個模組是什麼？

系統裡幾乎每個動作（登入、建對話、改設定、加標籤、傳檔）都會自動寫一筆活動紀錄到 `activities` 表，包含使用者、動作、資源、時間、IP、User-Agent。它是合規稽核與除錯的最後一道防線。

## 2. 解決什麼問題？

| 場景 | Activities 模組做什麼 |
|---|---|
| 客戶投訴「某客服改了我的標籤」 | 查 activity log 看誰改的 |
| 主管想看本週工作量 | `GET /trends` 時間序列 |
| 老闆想看一週活動熱力圖 | `GET /heatmap` 一覽 |
| 稽核要求 90 天前資料能刪除 | `POST /cleanup?days=90` |
| 想看哪些動作最常被執行 | `GET /overview` |

## 3. 主要功能

- **時序日誌**：建立 / 更新 / 刪除 / 登入 / 登出 等動作
- **角色可見性**：admin 看全部；agent 只看自己的
- **使用者統計**：個人動作分布
- **總覽報表**：總數、動作分布、資源分布、role 分布（admin）
- **趨勢分析**：依日 / 時序列
- **熱力圖**：星期 × 小時 動作頻率
- **資源 / 角色維度**：各種統計 endpoint
- **過期清理**：清掉 N 天前紀錄（admin）
- **匯出**：CSV / JSON（在 ActivityLog.vue 內整合）

## 4. 操作介面入口

| 介面 | 用途 |
|---|---|
| `ActivityLog.vue` | 主頁面（時間軸、篩選、匯出） |
| `ActivityTimeline.vue` / `ActivityTimelineItem.vue` | 時間軸視圖 |
| `ActivityDetailPanel.vue` | 單筆詳細展開 |
| `ActivityFilterPills.vue` / `ActivityPagination.vue` | 篩選與分頁 |
| `ActivityStatsCards.vue` | 上方統計卡 |
| `Dashboard.vue` 的 `RecentActivityWidget` / `ActivityFeedCard` | 摘要 |

## 5. 主要 API 端點

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/activities` | 列表 + 篩選 + 分頁 |
| GET | `/api/activities/:id` | 單筆詳細 |
| GET | `/api/activities/user/:userId/stats` | 個人統計 |
| GET | `/api/activities/overview` | 總覽（admin） |
| GET | `/api/activities/trends` | 時序 |
| GET | `/api/activities/heatmap` | 熱力圖 |
| GET | `/api/activities/stats/resources` `/roles` `/custom` | 維度統計 |
| POST | `/api/activities/cleanup` | 過期清理（admin） |

## 6. 涉及的 Durable Objects

**不直接使用 DO**。純資料庫驅動。

## 7. 邊界案例與小細節

- **隱式使用者過濾**：非 admin 即使傳 `?userId=other` 也只會回自己的
- **失敗不抛錯**：寫 log 失敗只回 null，不影響主業務（fail-open）
- **details 欄位是 JSON 字串**：複雜內容（如批次結果）序列化後存
- **沒有 updated_at**：活動是不可變紀錄
- **resourceId 可為 null**：系統級動作（如備份）沒有單一資源
- **每個模組都會呼叫 `ActivityService.logActivity()`**：覆蓋率高

## 8. 常見疑難

| 症狀 | 排查方向 |
|---|---|
| Agent 看不到某些紀錄 | 預期行為（只能看自己）；用 admin 帳號驗證 |
| 紀錄太多查詢變慢 | 跑 `/cleanup` 清舊資料；確認 D1 索引 |
| 時間對不上 | 全用 UTC ISO 8601；前端要做時區轉換 |

---

**相關模組**：[auth](./auth.md)（登入登出來源）、[notifications](./notifications.md)（部分動作觸發通知）

## Activity Restore (Phase 1)

The activities module now includes restore infrastructure for future undo support:

- `ActivityCapture` creates reversible activity INSERT statements with `previousState`, `newState`, `restorePolicy`, `restoreHandler`, and `restoredByActivityId` metadata.
- `RestoreRegistry` maps a `details.restoreHandler` key to a `RestoreHandler` with both `buildMutation()` and `getCurrentState()`.
- `POST /api/activities/:id/restore` performs policy validation, permission checks, expiry checks, idempotency checks, mid-air conflict detection, CAS slot acquisition, D1 batch dispatch, and restore-event broadcast.

Phase 1 does not migrate existing write handlers. Records become restorable only after Phase 2 starts writing `details.reversible: true` and a valid `restoreHandler`.

RESTORE logs use the caller from the current JWT context, not the actor from the original activity. This keeps audit attribution clear: the original operation and the restore operation may be performed by different users.

`details.restoredByActivityId` is the idempotency marker:

- `null`: not restored.
- `-1`: restore currently in progress.
- positive activity id: already restored by that RESTORE activity.