# TODO 審查報告

**審查日期**: 2026-01-29
**上次審查**: 2025-12-01
**總計 TODO 數量**: ~105 個 (從 136 減少)
**審查人**: Claude Code Assistant

---

##  執行摘要

```
┌─────────────────────────────────────────────────────────────────────┐
│ TODO 分布概覽 │
├─────────────────────────────────────────────────────────────────────┤
│  後端 (src/) : ~88 個 (84%) │
│  前端 (frontend/src/) : ~17 個 (16%) │
├─────────────────────────────────────────────────────────────────────┤
│  變化摘要 (自 2025-12-01): │
│  ├── 總數減少: 136 → ~105 (-23%) │
│  ├── 已完成: Durable Objects Session 驗證 │
│  ├── 已完成: 前端 WebSocket 整合 (5 項) │
│  ├── 已移除: 邀請系統相關 TODO (功能移除) │
│  └── 已清理: 過時/重複 TODO (~20 項) │
├─────────────────────────────────────────────────────────────────────┤
│  優先級分布: │
│  ├──  Critical (緊急) : 5 個  (5%) - 立即處理 │
│  ├──  High (高優先) : 18 個 (17%)  - 1-2 週內處理 │
│  ├──  Medium (中優先) : 40 個 (38%)  - 下個迭代處理 │
│  └──  Low (低優先) : 42 個 (40%)  - 待排程 │
└─────────────────────────────────────────────────────────────────────┘
```

---

##  Critical (緊急) - 5 個

需要立即處理，影響系統安全或核心功能。

### 1. 認證/授權相關

| 文件 | 行號 | TODO 內容 | 狀態 | 建議操作 |
|------|------|-----------|------|----------|
| `modules/session/middleware/session-auth.ts` | ~145 | 實現對話存取權限檢查 |  待處理 | 實現權限檢查邏輯 |
| `modules/messaging/middleware/message-auth.ts` | ~295 | 從資料庫取得代理人的對話清單 |  待處理 | 實現資料庫查詢 |

### 2. 安全相關

| 文件 | 行號 | TODO 內容 | 狀態 | 建議操作 |
|------|------|-----------|------|----------|
| `modules/reports/services/reports-service.ts` | ~1290 | 實現權限檢查 |  待處理 | 實現報告訪問權限控制 |
| `modules/reports/services/reports-service.ts` | ~1300 | 檢查下載權限 |  待處理 | 實現下載權限驗證 |
| `modules/reports/services/reports-service.ts` | ~1307 | 檢查刪除權限 |  待處理 | 實現刪除權限驗證 |

###  已解決 (本次審查)

| 文件 | TODO 內容 | 狀態 |
|------|-----------|------|
| `durable-objects/CustomerConversationDO.ts` | Validate session |  已完整實現 |
| `durable-objects/CustomerMessageDO.ts` | Validate session |  已完整實現 |
| `modules/teams/handlers/invitations.ts` | In-memory invitations store |  功能已移除 |

---

##  High (高優先) - 18 個

影響用戶體驗或重要功能，應在 1-2 週內處理。

### 報告服務核心功能 (8 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `reports/services/reports-service.ts` | ~1036 | 儲存到資料庫 | 實現資料庫持久化 |
| `reports/services/reports-service.ts` | ~1055 | 從資料庫獲取現有報告 | 實現查詢邏輯 |
| `reports/services/reports-service.ts` | ~1080 | 更新到資料庫 | 實現更新邏輯 |
| `reports/services/reports-service.ts` | ~1095 | 檢查權限和刪除 | 實現刪除邏輯 |
| `reports/services/reports-service.ts` | ~1108 | 從資料庫查詢 | 實現列表查詢 |
| `reports/services/reports-service.ts` | ~1314 | 啟動後台生成任務 | 實現異步任務 |
| `reports/services/reports-service.ts` | ~1345 | 刪除 R2 存儲的檔案 | 實現檔案清理 |
| `reports/services/reports-service.ts` | ~820 | 從資料庫刪除 | 實現刪除功能 |

### 分析服務增強 (5 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `analytics/services/dashboard-service.ts` | ~280 | 實現上期對比 | 實現對比功能 |
| `analytics/services/dashboard-service.ts` | ~283 | 實現趨勢計算 | 實現趨勢分析 |
| `analytics/services/dashboard-service.ts` | ~544 | 實現 WebSocket/SSE 訂閱邏輯 | 實現實時訂閱 |
| `analytics/services/period-comparison-service.ts` | ~423 | 需要 resolution_time 計算邏輯 | 實現解決時間計算 |
| `analytics/services/period-comparison-service.ts` | ~428 | 需要評分系統支援 | 實現評分系統 |

### 整合模組 (4 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `integrations/index.ts` | ~125 | 實作統計數據獲取 | 實現統計 API |
| `integrations/index.ts` | ~163 | 實作健康狀態檢查 | 實現健康檢查 |
| `integrations/handlers/channel-handler.ts` | ~471 | Add activity logging | 添加活動日誌 |
| `integrations/handlers/integration-main.ts` | ~874 | 實作認證測試 | 實現認證測試 |

### 郵件服務 (1 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `services/alert-notification-service.ts` | ~348 | 整合實際的 SMTP 服務 | 整合郵件服務 |

###  已解決 (本次審查)

| 原條目 | 狀態 |
|--------|------|
| 前端 WebSocket 整合 (5 項) |  已完成重構，TODO 已移除 |
| 緊急回滾服務 (2 項) |  文件已重構為 PowerShell 腳本 |

---

##  Medium (中優先) - 40 個

功能增強或優化，可在下個迭代中處理。

### 消息模組處理器實現 (17 個)

這些是消息模組中的處理器占位符：

| 文件 | 類型 | 數量 | 建議操作 |
|------|------|------|----------|
| `messaging/handlers/index.ts` | 延遲訊息處理器 | 5 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 訊息召回處理器 | 3 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 批量操作處理器 | 3 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 附件處理器 | 3 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 反應/已讀處理器 | 3 | 根據 messaging-main.ts 實現 |

### 統計指標計算 (10 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `reports/services/reports-service.ts` | 實作各類統計計算 | 實現統計邏輯 |
| `reports/services/reports-service.ts` | 計算客服績效指標 | 實現績效計算 |
| `session/services/session-service.ts` | 實現會話統計 | 實現統計查詢 |
| `session/services/session-service.ts` | 實現活動和標籤統計 | 實現相關功能 |

### 系統功能 (6 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `system/handlers/index.ts` | 實現安全性稽核功能 | 實現稽核 |
| `system/handlers/index.ts` | 實現效能報告功能 | 實現報告 |
| `system/handlers/index.ts` | 實現維護模式功能 | 實現維護模式 |
| `system/handlers/index.ts` | 實現系統日誌查詢功能 | 實現日誌查詢 |
| `system/handlers/index.ts` | 實現配置驗證功能 | 實現驗證 |
| `system/handlers/index.ts` | 實現系統診斷功能 | 實現診斷 |

### 其他中優先項目 (7 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `analytics/handlers/reports-main.ts` | 實現實際的文件下載邏輯 | 實現下載 |
| `analytics/services/analytics-core.ts` | 計算實際文件大小 | 實現計算 |
| `analytics/services/analytics-core.ts` | 添加更多統計指標 | 擴展指標 |
| `file-management/handlers/file-main.ts` | Extend getFileStatistics | 擴展統計 |
| `file-management/utils/error-handler.ts` | 發送告警通知 | 整合告警 |
| `modules/qrcode/services/qrcode-crud-service.ts` | 實現更複雜的權限檢查邏輯 | 增強權限 |
| `analytics/services/report-scheduler-service.ts` | 實現 cron 表達式解析 | 實現解析 |

---

##  Low (低優先) - 42 個

次要功能或優化，可按需安排。

### 用戶體驗優化 (8 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `components/ui/AppLayout.vue` | 實現個人資料頁面 | 規劃開發 |
| `components/ui/AppLayout.vue` | 實現修改密碼功能 | 規劃開發 |
| `components/conversation/MessageInput.vue` | 實現消息歷史瀏覽功能 | 規劃開發 |
| `components/channels/ChannelConfigDialog.vue` | Implement edit mode loading | 規劃開發 |
| `views/ConversationDetail.vue` | Show user notification for failed refresh | 規劃開發 |
| `views/ApiMonitor.vue` | 可以在UI上顯示錯誤提示 | 規劃開發 |
| `composables/useErrorHandler.ts` | 顯示用戶通知 | 規劃開發 |
| `composables/useErrorHandler.ts` | 上報到服務器 | 規劃開發 |

### Session 模組功能 (7 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `session/handlers/index.ts` | 實現設定管理功能 | 規劃開發 |
| `session/handlers/index.ts` | 實現邊界檢測測試 | 規劃開發 |
| `session/handlers/index.ts` | 實現清理功能 | 規劃開發 |
| `session/handlers/index.ts` | 實現匯出功能 | 規劃開發 |
| `session/handlers/index.ts` | Generate actual download URL | 規劃開發 |
| `session/handlers/index.ts` | WebSocket integration | 標記為未來功能 |
| `session/middleware/index.ts` | Implement middleware | 規劃開發 |

### 分析服務擴展 (7 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `analytics/services/period-comparison-service.ts` | 計算消息間的時間差 | 規劃開發 |
| `analytics/services/period-comparison-service.ts` | session 持續時間計算 | 規劃開發 |
| `analytics/services/period-comparison-service.ts` | 定義 engagement 計算邏輯 | 規劃開發 |
| `analytics/services/realtime-dashboard-service.ts` | 實現指標記錄 | 規劃開發 |
| `analytics/services/metrics-collector.ts` | 實現緩存檢測 | 規劃開發 |
| `analytics/services/report-scheduler-service.ts` | 實現 Webhook 發送邏輯 | 規劃開發 |
| `analytics/services/reports-service.ts` | 從上下文獲取用戶信息 | 規劃開發 |

### 中間件和日誌 (6 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `modules/qrcode/middleware/index.ts` | 實現操作日誌記錄 | 規劃開發 |
| `modules/qrcode/middleware/index.ts` | 實現日誌記錄邏輯 | 規劃開發 |
| `modules/reports/middleware/reports-validation.ts` | 實現速率限制邏輯 | 規劃開發 |
| `session/middleware/session-validation.ts` | 實現速率限制邏輯 | 規劃開發 |
| `modules/system/middleware/system-auth.ts` | 實作真正的頻率限制 | 規劃開發 |
| `handlers/messaging-main.ts` | Consider refactoring routes | 規劃重構 |

### 其他低優先項目 (14 個)

| 文件 | TODO 內容 | 建議操作 |
|------|-----------|----------|
| `messaging/services/delayed-message-service.ts` | 發送到實際平台 | Phase 2 功能 |
| `messaging/services/delayed-message-service.ts` | 決定刪除或archived | 設計決策 |
| `messaging/services/message-recall-service.ts` | 通知平台撤回訊息 | Phase 2 功能 |
| `integrations/services/message-normalization-service.ts` | Implement WhatsApp extraction | 未來整合 |
| `integrations/index.ts` | 實作批量操作 | 未來功能 |
| `views/CustomerTags.vue` | 从认证状态获取 | 小改進 |

---

##  建議的行動計劃

### Phase 1: 立即處理 (本週)

```
□ 處理 5 個 Critical TODO
  ├── 實現 session-auth.ts 對話存取權限檢查
  ├── 實現 message-auth.ts 代理人對話查詢
  └── 實現 reports-service.ts 權限檢查 (3 項)
```

### Phase 2: 短期處理 (1-2 週)

```
□ 處理 18 個 High 優先級 TODO
  ├── 報告服務核心功能 (8 個)
  ├── 分析服務增強 (5 個)
  ├── 整合模組完善 (4 個)
  └── SMTP 服務整合 (1 個)
```

### Phase 3: 中期處理 (下個迭代)

```
□ 處理 40 個 Medium 優先級 TODO
  ├── 消息模組處理器實現 (17 個)
  ├── 統計指標計算 (10 個)
  ├── 系統功能完善 (6 個)
  └── 其他增強 (7 個)
```

---

##  建議的 TODO 格式標準

為了更好地追蹤技術債務，建議採用以下 TODO 格式：

```typescript
// TODO: [PRIORITY] [CATEGORY] 描述
// - Priority: CRITICAL, HIGH, MEDIUM, LOW
// - Category: SECURITY, FEATURE, REFACTOR, PERF, DOCS
// - Example: TODO: [HIGH] [SECURITY] 實現 session 驗證
// - Example: TODO: [LOW] [PERF] 優化查詢效能
```

---

## 附錄: 按模組分類統計

| 模組 | TODO 數量 | Critical | High | Medium | Low |
|------|----------|----------|------|--------|-----|
| reports | 26 | 3 | 8 | 10 | 5 |
| messaging | 20 | 1 | 0 | 17 | 2 |
| session | 15 | 1 | 0 | 0 | 14 |
| analytics | 14 | 0 | 5 | 4 | 5 |
| system | 7 | 0 | 0 | 6 | 1 |
| integrations | 6 | 0 | 4 | 1 | 1 |
| frontend | 17 | 0 | 0 | 2 | 15 |
| **總計** | **~105** | **5** | **18** | **40** | **42** |

---

##  本次審查變更摘要

### 已完成項目
-  Durable Objects Session 驗證 (2 項) - 完整實現 `validateSession()` 方法
-  前端 WebSocket 整合 (5 項) - 文件已重構，TODO 已清理

### 已移除項目
-  邀請系統相關 TODO (3 項) - 功能已完整移除
  - `invitations.ts` In-memory store 遷移
  - 發送邀請郵件
  - 相關 API 端點

### 檔案變更
-  `emergency-rollback-service.ts` - 已重構為 PowerShell 腳本

### 行號偏移說明
由於代碼重構，部分行號可能有 10-20 行的偏移。建議使用 TODO 內容文字搜索定位。

---

*報告生成時間: 2026-01-29*
*下次審查建議: 2026-02-15*
