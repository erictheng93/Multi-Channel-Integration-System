# TODO 審查報告

**審查日期**: 2025-12-01
**總計 TODO 數量**: 136 個
**審查人**: Claude Code Assistant

---

## 📊 執行摘要

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TODO 分布概覽                               │
├─────────────────────────────────────────────────────────────────────┤
│  後端 (src/)          : 113 個 (83%)                               │
│  前端 (frontend/src/) : 23 個  (17%)                               │
├─────────────────────────────────────────────────────────────────────┤
│  優先級分布:                                                        │
│  ├── 🔴 Critical (緊急)     : 8 個  (6%)   - 立即處理              │
│  ├── 🟠 High (高優先)       : 25 個 (18%)  - 1-2 週內處理          │
│  ├── 🟡 Medium (中優先)     : 42 個 (31%)  - 下個迭代處理          │
│  ├── 🟢 Low (低優先)        : 35 個 (26%)  - 待排程                │
│  └── ⚪ Obsolete (過時)     : 26 個 (19%)  - 可移除或已過時        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 Critical (緊急) - 8 個

需要立即處理，影響系統安全或核心功能。

### 1. 認證/授權相關

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `durable-objects/CustomerConversationDO.ts` | 96 | Validate session with existing auth system | 實現 session 驗證 |
| `durable-objects/CustomerMessageDO.ts` | 362 | Validate session | 實現 session 驗證 |
| `modules/session/middleware/session-auth.ts` | 144 | 實現對話存取權限檢查 | 實現權限檢查邏輯 |

### 2. 安全相關

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `modules/reports/services/reports-service.ts` | 1275 | 實現權限檢查 | 實現報告訪問權限控制 |
| `modules/reports/services/reports-service.ts` | 1285 | 檢查下載權限 | 實現下載權限驗證 |
| `modules/reports/services/reports-service.ts` | 1292 | 檢查刪除權限 | 實現刪除權限驗證 |

### 3. 資料完整性

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `modules/teams/handlers/invitations.ts` | 15 | In-memory invitations store - Move to database | 遷移到持久化存儲 |
| `modules/messaging/middleware/message-auth.ts` | 295 | 從資料庫取得代理人的對話清單 | 實現資料庫查詢 |

---

## 🟠 High (高優先) - 25 個

影響用戶體驗或重要功能，應在 1-2 週內處理。

### 前端 WebSocket 整合 (5 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `views/ConversationsTable.vue` | 288 | Replace with WebSocket-based real-time updates | 整合 WebSocket |
| `views/ConversationsTable.vue` | 358 | Replace with WebSocket event handler | 整合 WebSocket |
| `views/Dashboard.vue` | 436 | Replace with WebSocket-based activity stream | 整合 WebSocket |
| `views/ConversationDetail.vue` | 1250 | Implement WebSocket typing start | 實現打字指示器 |
| `views/ConversationDetail.vue` | 1255 | Implement WebSocket typing stop | 實現打字指示器 |

### 報告服務核心功能 (8 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `reports/services/reports-service.ts` | 1021 | 儲存到資料庫 | 實現資料庫持久化 |
| `reports/services/reports-service.ts` | 1040 | 從資料庫獲取現有報告 | 實現查詢邏輯 |
| `reports/services/reports-service.ts` | 1065 | 更新到資料庫 | 實現更新邏輯 |
| `reports/services/reports-service.ts` | 1080 | 檢查權限和刪除 | 實現刪除邏輯 |
| `reports/services/reports-service.ts` | 1093 | 從資料庫查詢 | 實現列表查詢 |
| `reports/services/reports-service.ts` | 1299 | 啟動後台生成任務 | 實現異步任務 |
| `reports/services/reports-service.ts` | 1330 | 刪除 R2 存儲的檔案 | 實現檔案清理 |
| `reports/services/reports-service.ts` | 805 | 從資料庫刪除 | 實現刪除功能 |

### 分析服務增強 (5 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `analytics/services/dashboard-service.ts` | 280 | 實現上期對比 | 實現對比功能 |
| `analytics/services/dashboard-service.ts` | 283 | 實現趨勢計算 | 實現趨勢分析 |
| `analytics/services/dashboard-service.ts` | 544 | 實現 WebSocket/SSE 訂閱邏輯 | 實現實時訂閱 |
| `analytics/services/period-comparison-service.ts` | 423 | 需要 resolution_time 計算邏輯 | 實現解決時間計算 |
| `analytics/services/period-comparison-service.ts` | 428 | 需要評分系統支援 | 實現評分系統 |

### 整合模組 (4 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `integrations/index.ts` | 124 | 實作統計數據獲取 | 實現統計 API |
| `integrations/index.ts` | 162 | 實作健康狀態檢查 | 實現健康檢查 |
| `integrations/handlers/channel-handler.ts` | 470 | Add activity logging | 添加活動日誌 |
| `integrations/handlers/integration-main.ts` | 874 | 實作認證測試 | 實現認證測試 |

### 緊急回滾服務 (3 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `services/emergency-rollback-service.ts` | 93 | Refactor emergency rollback for WebSocket-only | 重構回滾邏輯 |
| `services/emergency-rollback-service.ts` | 880 | Support graceful WebSocket degradation | 實現優雅降級 |
| `services/alert-notification-service.ts` | 348 | 整合實際的 SMTP 服務 | 整合郵件服務 |

---

## 🟡 Medium (中優先) - 42 個

功能增強或優化，可在下個迭代中處理。

### 消息模組處理器實現 (17 個)

這些是消息模組中的處理器占位符，已有相應的實現計劃：

| 文件 | 類型 | 數量 | 建議操作 |
|------|------|------|----------|
| `messaging/handlers/index.ts` | 延遲訊息處理器 | 5 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 訊息召回處理器 | 3 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 批量操作處理器 | 3 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 附件處理器 | 3 | 根據 messaging-main.ts 實現 |
| `messaging/handlers/index.ts` | 反應/已讀處理器 | 3 | 根據 messaging-main.ts 實現 |

### 統計指標計算 (12 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `reports/services/reports-service.ts` | 382-386 | 實作各類統計計算 | 實現統計邏輯 |
| `reports/services/reports-service.ts` | 447-459 | 計算客服績效指標 | 實現績效計算 |
| `session/services/session-service.ts` | 637-657 | 實現會話統計 | 實現統計查詢 |
| `session/services/session-service.ts` | 669-713 | 實現活動和標籤統計 | 實現相關功能 |

### 系統功能 (6 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `system/handlers/index.ts` | 101 | 實現安全性稽核功能 | 實現稽核 |
| `system/handlers/index.ts` | 152 | 實現效能報告功能 | 實現報告 |
| `system/handlers/index.ts` | 225 | 實現維護模式功能 | 實現維護模式 |
| `system/handlers/index.ts` | 282 | 實現系統日誌查詢功能 | 實現日誌查詢 |
| `system/handlers/index.ts` | 324 | 實現配置驗證功能 | 實現驗證 |
| `system/handlers/index.ts` | 361 | 實現系統診斷功能 | 實現診斷 |

### 其他中優先項目 (7 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `analytics/handlers/reports-main.ts` | 130 | 實現實際的文件下載邏輯 | 實現下載 |
| `analytics/services/analytics-core.ts` | 565 | 計算實際文件大小 | 實現計算 |
| `analytics/services/analytics-core.ts` | 707 | 添加更多統計指標 | 擴展指標 |
| `file-management/handlers/file-main.ts` | 72 | Extend getFileStatistics | 擴展統計 |
| `file-management/utils/error-handler.ts` | 244 | 發送告警通知 | 整合告警 |
| `modules/qrcode/services/qrcode-crud-service.ts` | 801 | 實現更複雜的權限檢查邏輯 | 增強權限 |
| `analytics/services/report-scheduler-service.ts` | 1055 | 實現 cron 表達式解析 | 實現解析 |

---

## 🟢 Low (低優先) - 35 個

次要功能或優化，可按需安排。

### 用戶體驗優化 (8 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `components/ui/AppLayout.vue` | 500 | 實現個人資料頁面 | 規劃開發 |
| `components/ui/AppLayout.vue` | 506 | 實現修改密碼功能 | 規劃開發 |
| `components/conversation/MessageInput.vue` | 429 | 實現消息歷史瀏覽功能 | 規劃開發 |
| `components/channels/ChannelConfigDialog.vue` | 636 | Implement edit mode loading | 規劃開發 |
| `views/ConversationDetail.vue` | 1184 | Show user notification for failed refresh | 規劃開發 |
| `views/ApiMonitor.vue` | 801 | 可以在UI上顯示錯誤提示 | 規劃開發 |
| `composables/useErrorHandler.ts` | 221 | 顯示用戶通知 | 規劃開發 |
| `composables/useErrorHandler.ts` | 227 | 上報到服務器 | 規劃開發 |

### Session 模組功能 (7 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `session/handlers/index.ts` | 91 | 實現設定管理功能 | 規劃開發 |
| `session/handlers/index.ts` | 166 | 實現邊界檢測測試 | 規劃開發 |
| `session/handlers/index.ts` | 243 | 實現清理功能 | 規劃開發 |
| `session/handlers/index.ts` | 309 | 實現匯出功能 | 規劃開發 |
| `session/handlers/index.ts` | 323 | Generate actual download URL | 規劃開發 |
| `session/handlers/index.ts` | 118 | WebSocket integration | 標記為未來功能 |
| `session/middleware/index.ts` | 167-172 | Implement middleware | 規劃開發 |

### 分析服務擴展 (7 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `analytics/services/period-comparison-service.ts` | 474 | 計算消息間的時間差 | 規劃開發 |
| `analytics/services/period-comparison-service.ts` | 512 | session 持續時間計算 | 規劃開發 |
| `analytics/services/period-comparison-service.ts` | 517 | 定義 engagement 計算邏輯 | 規劃開發 |
| `analytics/services/realtime-dashboard-service.ts` | 564 | 實現指標記錄 | 規劃開發 |
| `analytics/services/metrics-collector.ts` | 149 | 實現緩存檢測 | 規劃開發 |
| `analytics/services/report-scheduler-service.ts` | 843 | 實現 Webhook 發送邏輯 | 規劃開發 |
| `analytics/services/reports-service.ts` | 244 | 從上下文獲取用戶信息 | 規劃開發 |

### 中間件和日誌 (6 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `modules/qrcode/middleware/index.ts` | 227 | 實現操作日誌記錄 | 規劃開發 |
| `modules/qrcode/middleware/index.ts` | 259 | 實現日誌記錄邏輯 | 規劃開發 |
| `modules/reports/middleware/reports-validation.ts` | 112 | 實現速率限制邏輯 | 規劃開發 |
| `session/middleware/session-validation.ts` | 95 | 實現速率限制邏輯 | 規劃開發 |
| `modules/system/middleware/system-auth.ts` | 504 | 實作真正的頻率限制 | 規劃開發 |
| `handlers/messaging-main.ts` | 103 | Consider refactoring routes | 規劃重構 |

### 其他低優先項目 (7 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `messaging/services/delayed-message-service.ts` | 296 | 發送到實際平台 | Phase 2 功能 |
| `messaging/services/delayed-message-service.ts` | 435 | 決定刪除或archived | 設計決策 |
| `messaging/services/message-recall-service.ts` | 105 | 通知平台撤回訊息 | Phase 2 功能 |
| `integrations/services/message-normalization-service.ts` | 384 | Implement WhatsApp extraction | 未來整合 |
| `integrations/index.ts` | 247 | 實作批量操作 | 未來功能 |
| `teams/handlers/invitations.ts` | 53 | Send invitation email | 整合郵件服務 |
| `views/CustomerTags.vue` | 710 | 从认证状态获取 | 小改進 |

---

## ⚪ Obsolete (過時/可移除) - 26 個

這些 TODO 已過時、已實現或可以直接移除。

### 已實現或可移除 (14 個)

| 文件 | 行號 | TODO 內容 | 理由 |
|------|------|-----------|------|
| `composables/index.ts` | 27 | Re-add useConversationActions | 類型已對齊 |
| `composables/useCustomerMessages.ts` | 306 | 處理文件上傳 | 已有文件上傳功能 |
| `views/Dashboard.vue` | 460 | Restore with WebSocket activity | WebSocket 已部署 |
| `views/Dashboard.vue` | 499 | Restore when WebSocket implemented | WebSocket 已部署 |
| `views/WebSocketMonitoring.vue` | 399 | 重新載入歷史資料 | 監控功能已完善 |
| `session/middleware/index.ts` | 40 | 在系統穩定後重新啟用 | 系統已穩定 |
| `session/middleware/index.ts` | 176 | 在系統穩定後重新啟用 | 系統已穩定 |
| `modules/qrcode/index.ts` | 264 | Implement QRCode services | QRCode 服務已實現 |
| `modules/messaging/services/index.ts` | 13 | Implement messaging services | 消息服務已實現 |
| `analytics/services/reports-service.ts` | 381 | 修復類型定義 | 可直接修復 |
| `reports/services/reports-service.ts` | 831 | 實現真實統計查詢 | 已有實現 |
| `reports/services/reports-service.ts` | 955 | 實現重新生成 | 功能可能已存在 |
| `reports/services/reports-service.ts` | 964 | 實現匯出功能 | 匯出功能已存在 |
| `index.ts` | 1143 | 考慮整合到 realtime handler | 路由已整合 |

### 設計決策/文檔類 (7 個)

這些需要轉換為文檔或設計文件：

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| `components/customer/TagStatsModal.vue` | 529 | 未來實現對話標籤功能時 | 轉為功能規劃文檔 |
| `components/reports/ReportViewer.vue` | 451 | 實現 ShareDialog 組件 | 轉為功能規劃文檔 |
| `components/reports/ReportViewer.vue` | 461 | 實現 ExportDialog 組件 | 轉為功能規劃文檔 |
| `durable-objects/DelayedMessageScheduler.ts` | 891 | 發送緊急告警到監控系統 | Phase 2 規劃 |

### 重複或可合併 (5 個)

| 文件 | 行號 | TODO 內容 | 建議操作 |
|------|------|-----------|----------|
| 多個速率限制 TODO | - | 實現速率限制邏輯 | 合併為統一實現 |
| 多個權限檢查 TODO | - | 實現權限檢查 | 合併為統一中間件 |

---

## 📋 建議的行動計劃

### Phase 1: 立即處理 (本週)

```
□ 處理 8 個 Critical TODO
  ├── 實現 Durable Objects session 驗證
  ├── 實現報告服務權限檢查
  └── 將 invitations 遷移到資料庫
```

### Phase 2: 短期處理 (1-2 週)

```
□ 處理 25 個 High 優先級 TODO
  ├── 前端 WebSocket 整合 (5 個)
  ├── 報告服務核心功能 (8 個)
  ├── 分析服務增強 (5 個)
  └── 整合模組完善 (7 個)
```

### Phase 3: 中期處理 (下個迭代)

```
□ 處理 42 個 Medium 優先級 TODO
  ├── 消息模組處理器實現 (17 個)
  ├── 統計指標計算 (12 個)
  ├── 系統功能完善 (6 個)
  └── 其他增強 (7 個)
```

### Phase 4: 清理工作

```
□ 移除或更新 26 個過時 TODO
  ├── 移除已實現的 TODO 註釋
  ├── 將設計類 TODO 轉為文檔
  └── 合併重複的 TODO
```

---

## 📈 建議的 TODO 格式標準

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

| 模組 | TODO 數量 | Critical | High | Medium | Low | Obsolete |
|------|----------|----------|------|--------|-----|----------|
| reports | 31 | 3 | 10 | 12 | 2 | 4 |
| messaging | 22 | 1 | 1 | 17 | 2 | 1 |
| session | 19 | 1 | 0 | 0 | 11 | 7 |
| analytics | 14 | 0 | 5 | 4 | 5 | 0 |
| system | 7 | 0 | 0 | 6 | 1 | 0 |
| integrations | 7 | 0 | 4 | 1 | 2 | 0 |
| frontend | 23 | 0 | 5 | 0 | 10 | 8 |
| 其他 | 13 | 3 | 0 | 2 | 2 | 6 |
| **總計** | **136** | **8** | **25** | **42** | **35** | **26** |

---

*報告生成時間: 2025-12-01*
*下次審查建議: 2026-01-01*
