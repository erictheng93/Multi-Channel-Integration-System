# Documentation Index

本文檔提供專案文檔的完整索引和導航指南。

## 文檔架構概覽

```
docs/
 analytics/ # 分析功能相關文檔
 api/ # API 參考文檔
 architecture/ # 系統架構設計文檔
 components/ # 前端元件文檔
 database/ # 資料庫相關文檔
 deployment/ # 部署相關文檔
 enterprise/ # 企業級功能文檔
 features/ # 功能特性文檔
 message-search/ # 訊息搜尋功能文檔
 fixes/ # 修復報告
 guides/ # 操作指南
 implementation/ # 實作報告
 migration/ # 遷移指南
 monitoring/ # 監控相關文檔
 optimization/ # 效能優化文檔
 performance/ # 效能測試報告
 reports/ # 各類報告
 analytics/ # 分析功能報告
 deployment/ # 部署報告
 enhancement/ # 功能增強報告
 migration/ # 遷移報告
 modules/ # 模組報告
 monitoring/ # 監控報告
 verification/ # 驗證報告
 websocket/ # WebSocket 相關報告
 standards/ # 編碼標準和規範
 testing/ # 測試文檔
 troubleshooting/ # 故障排除指南
```

## 核心文檔

### 專案概覽
- [README.md](../README.md) - 專案主要說明文件
- [CLAUDE.md](../CLAUDE.md) - Claude Code 開發指南
- [CURRENT_STATUS.md](./CURRENT_STATUS.md) - 當前專案狀態

### 需求與規格
- [BRD.md](./BRD.md) / [BRD_TW.md](./BRD_TW.md) - 業務需求文件
- [FRS.md](./FRS.md) / [FRS_TW.md](./FRS_TW.md) - 功能需求規格
- [SRS.md](./SRS.md) / [SRS_TW.md](./SRS_TW.md) - 軟體需求規格
- [NFR.md](./NFR.md) / [NFR_TW.md](./NFR_TW.md) - 非功能性需求

### 系統架構
- [architecture/WEBSOCKET_FINAL_ARCHITECTURE.md](./architecture/WEBSOCKET_FINAL_ARCHITECTURE.md) - WebSocket 最終架構
- [architecture/ROUTE_REGISTRATION_ORDER.md](./architecture/ROUTE_REGISTRATION_ORDER.md) - 路由註冊順序指南
- [architecture/MODULE_DEPENDENCY_DIAGRAM.md](./architecture/MODULE_DEPENDENCY_DIAGRAM.md) - 模組依賴關係圖
- [architecture/MULTI_TENANT_ARCHITECTURE_EVALUATION.md](./architecture/MULTI_TENANT_ARCHITECTURE_EVALUATION.md) - 多租戶架構評估

## 開發指南

### 快速開始
- [guides/QUICK_START.md](./guides/QUICK_START.md) - 快速開始指南
- [guides/SETUP_GUIDE.md](./guides/SETUP_GUIDE.md) - 環境設定指南
- [guides/LOCAL_DEVELOPMENT_SETUP.md](./guides/LOCAL_DEVELOPMENT_SETUP.md) - 本地開發設定

### 部署指南
- [guides/DEPLOYMENT_GUIDE.md](./guides/DEPLOYMENT_GUIDE.md) - 完整部署指南
- [guides/CLOUDFLARE_PAGES_DEPLOYMENT.md](./guides/CLOUDFLARE_PAGES_DEPLOYMENT.md) - Cloudflare Pages 部署
- [deployment/WEBSOCKET_MIGRATION_COMPLETE.md](./deployment/WEBSOCKET_MIGRATION_COMPLETE.md) - WebSocket 遷移完成報告

### API 文檔
- [api/api-endpoints.md](./api/api-endpoints.md) - API 端點總覽
- [api/MESSAGING_API_REFERENCE.md](./api/MESSAGING_API_REFERENCE.md) - 訊息 API 參考
- [api/MODULAR_API_REFERENCE.md](./api/MODULAR_API_REFERENCE.md) - 模組化 API 參考

## 功能文檔

### 核心功能
- [DELAYED_MESSAGING_GUIDE.md](./DELAYED_MESSAGING_GUIDE.md) - 延遲訊息功能指南
- [QUEUE_MANAGEMENT_GUIDE.md](./QUEUE_MANAGEMENT_GUIDE.md) - 佇列管理指南
- [CORS_CONFIGURATION_GUIDE.md](./CORS_CONFIGURATION_GUIDE.md) - CORS 配置指南
- [TAG_SYSTEM_IMPLEMENTATION.md](./TAG_SYSTEM_IMPLEMENTATION.md) - 標籤系統實作

### 訊息搜尋
- [features/message-search/MESSAGE_SEARCH_README.md](./features/message-search/MESSAGE_SEARCH_README.md) - 訊息搜尋功能總覽
- [features/message-search/MESSAGE_SEARCH_API_REFERENCE.md](./features/message-search/MESSAGE_SEARCH_API_REFERENCE.md) - 訊息搜尋 API
- [features/message-search/MESSAGE_SEARCH_USER_GUIDE.md](./features/message-search/MESSAGE_SEARCH_USER_GUIDE.md) - 訊息搜尋使用指南

### 企業功能
- [enterprise/ENTERPRISE_ROLES_SYSTEM.md](./enterprise/ENTERPRISE_ROLES_SYSTEM.md) - 企業角色系統
- [enterprise/RBAC_DESIGN.md](./enterprise/RBAC_DESIGN.md) - 角色權限設計
- [enterprise/AUDIT_LOGGING_DESIGN.md](./enterprise/AUDIT_LOGGING_DESIGN.md) - 審計日誌設計

## 測試文檔

### 測試指南
- [testing/testing-guide.md](./testing/testing-guide.md) - 測試總指南
- [testing/ANALYTICS_TESTING_STRATEGY.md](./testing/ANALYTICS_TESTING_STRATEGY.md) - 分析功能測試策略
- [../tests/README.md](../tests/README.md) - 測試套件說明

### 測試報告
- [testing/FINAL_TEST_REPORT.md](./testing/FINAL_TEST_REPORT.md) - 最終測試報告
- [testing/FRONTEND_TEST_COMPLETION_REPORT.md](./testing/FRONTEND_TEST_COMPLETION_REPORT.md) - 前端測試完成報告

## 效能與優化

### 效能文檔
- [PERFORMANCE_OPTIMIZATION_GUIDE.md](./PERFORMANCE_OPTIMIZATION_GUIDE.md) - 效能優化指南
- [performance/LOAD_TESTING_GUIDE.md](./performance/LOAD_TESTING_GUIDE.md) - 負載測試指南
- [performance/performance_baseline_report.md](./performance/performance_baseline_report.md) - 效能基準報告

### 優化報告
- [optimization/FRONTEND_STATE_MANAGEMENT_OPTIMIZATION.md](./optimization/FRONTEND_STATE_MANAGEMENT_OPTIMIZATION.md) - 前端狀態管理優化
- [optimization/OPTIMIZED_CHAT_EXPERIENCE.md](./optimization/OPTIMIZED_CHAT_EXPERIENCE.md) - 聊天體驗優化

## 故障排除

### 故障排除指南
- [troubleshooting/SSE_CONNECTION_ISSUE_ANALYSIS.md](./troubleshooting/SSE_CONNECTION_ISSUE_ANALYSIS.md) - SSE 連線問題分析
- [troubleshooting/TYPESCRIPT_ERRORS_RESOLUTION_COMPLETE.md](./troubleshooting/TYPESCRIPT_ERRORS_RESOLUTION_COMPLETE.md) - TypeScript 錯誤解決方案
- [troubleshooting/debug-line-webhook.md](./troubleshooting/debug-line-webhook.md) - LINE Webhook 除錯

## 遷移報告

### WebSocket 遷移
- [reports/websocket/WEBSOCKET_DEPLOYMENT_REPORT.md](./reports/websocket/WEBSOCKET_DEPLOYMENT_REPORT.md) - WebSocket 部署報告
- [reports/websocket/WEBSOCKET_IMPLEMENTATION_SUMMARY.md](./reports/websocket/WEBSOCKET_IMPLEMENTATION_SUMMARY.md) - WebSocket 實作總結
- [reports/websocket/WEBSOCKET_FINAL_VERIFICATION.md](./reports/websocket/WEBSOCKET_FINAL_VERIFICATION.md) - WebSocket 最終驗證

### 系統遷移
- [reports/migration/MIGRATION_TO_DURABLE_OBJECTS_COMPLETE.md](./reports/migration/MIGRATION_TO_DURABLE_OBJECTS_COMPLETE.md) - Durable Objects 遷移完成
- [reports/migration/ERROR_HANDLING_MIGRATION_REPORT.md](./reports/migration/ERROR_HANDLING_MIGRATION_REPORT.md) - 錯誤處理遷移報告
- [migration/MIGRATION_HISTORY.md](./migration/MIGRATION_HISTORY.md) - 遷移歷史記錄

## 監控與分析

### 監控文檔
- [API_MONITORING.md](./API_MONITORING.md) - API 監控
- [monitoring/API_MONITOR_IMPROVEMENTS.md](./monitoring/API_MONITOR_IMPROVEMENTS.md) - API 監控改進
- [reports/monitoring/SHORT_TERM_MONITORING_REPORT.md](./reports/monitoring/SHORT_TERM_MONITORING_REPORT.md) - 短期監控報告

### 分析功能
- [analytics/COMPARISON_QUICK_START.md](./analytics/COMPARISON_QUICK_START.md) - 比較分析快速開始
- [analytics/PERIOD_COMPARISON_INTEGRATION_GUIDE.md](./analytics/PERIOD_COMPARISON_INTEGRATION_GUIDE.md) - 期間比較整合指南

## 模組文檔

### 後端模組
- [../src/modules/activities/README.md](../src/modules/activities/README.md) - 活動模組
- [../src/modules/analytics/README.md](../src/modules/analytics/README.md) - 分析模組
- [../src/modules/auth/README.md](../src/modules/auth/README.md) - 認證模組
- [../src/modules/collaboration/README.md](../src/modules/collaboration/README.md) - 協作模組
- [../src/modules/realtime/README.md](../src/modules/realtime/README.md) - 即時通訊模組

### 模組報告
- [reports/modules/MESSAGING_MODULE_ENHANCEMENT_REPORT.md](./reports/modules/MESSAGING_MODULE_ENHANCEMENT_REPORT.md) - 訊息模組增強報告
- [reports/modules/FILE_MANAGEMENT_MODULE_REPORT.md](./reports/modules/FILE_MANAGEMENT_MODULE_REPORT.md) - 檔案管理模組報告

## 編碼標準

- [standards/PATH_ALIAS_GUIDE.md](./standards/PATH_ALIAS_GUIDE.md) - 路徑別名指南
- [standards/MODULE_EXPORT_STANDARD.md](./standards/MODULE_EXPORT_STANDARD.md) - 模組匯出標準

## 使用手冊

- [USER_GUIDE.md](./USER_GUIDE.md) - 使用者指南
- [reports/USER_MANUAL.md](./reports/USER_MANUAL.md) - 使用者手冊
- [reports/DEVELOPER_GUIDE.md](./reports/DEVELOPER_GUIDE.md) - 開發者指南

## 系統報告

### 架構與設計報告
- [reports/ARCHITECTURAL_REVIEW.md](./reports/ARCHITECTURAL_REVIEW.md) - 系統架構審查報告
- [reports/SMART_REGISTRY_FAILURE_ANALYSIS.md](./reports/SMART_REGISTRY_FAILURE_ANALYSIS.md) - Smart Registry 失敗分析
- [reports/ROUTE_CONFLICT_RESOLUTION_PATH_FORWARD.md](./reports/ROUTE_CONFLICT_RESOLUTION_PATH_FORWARD.md) - 路由衝突解決方案

### 安全報告
- [reports/SECURITY_AUDIT_REPORT.md](./reports/SECURITY_AUDIT_REPORT.md) - 安全審計報告
- [reports/SECURITY_FIXES_SUMMARY_DETAILED.md](./reports/SECURITY_FIXES_SUMMARY_DETAILED.md) - 安全修復總結（詳細版）

### UI/UX 改進報告
- [reports/TOAST_DIALOG_REPLACEMENT_REPORT.md](./reports/TOAST_DIALOG_REPLACEMENT_REPORT.md) - Toast 對話框替換報告

### 模組重組報告
- [reports/modules/AGENTS_MODULE_REORDERING_PLAN.md](./reports/modules/AGENTS_MODULE_REORDERING_PLAN.md) - 代理模組重排計劃
- [reports/modules/TEAMS_MODULE_REORDERING_PLAN.md](./reports/modules/TEAMS_MODULE_REORDERING_PLAN.md) - 團隊模組重排計劃

### 驗證報告
- [reports/verification/PASSWORD_RESET_VERIFICATION_REPORT.md](./reports/verification/PASSWORD_RESET_VERIFICATION_REPORT.md) - 密碼重置功能驗證報告

## 修復報告

- [fixes/QRCODE_FIX_SUCCESS_REPORT.md](./fixes/QRCODE_FIX_SUCCESS_REPORT.md) - QR Code 功能修復成功報告
- [fixes/CUSTOMER_HANDLER_ROUTE_FIX_SUMMARY.md](./fixes/CUSTOMER_HANDLER_ROUTE_FIX_SUMMARY.md) - 客戶處理器路由修復總結

## 部署文檔

- [deployment/DEPLOYMENT_RECOMMENDATION.md](./deployment/DEPLOYMENT_RECOMMENDATION.md) - 部署建議

## 實作文檔

- [implementation/IMPLEMENTATION_SUMMARY.md](./implementation/IMPLEMENTATION_SUMMARY.md) - 實作總結

## 效能文檔

- [performance/PERFORMANCE_ANALYSIS_REPORT.md](./performance/PERFORMANCE_ANALYSIS_REPORT.md) - 效能分析報告

## 測試文檔

- [testing/TEST_COVERAGE_QUALITY_EVALUATION.md](./testing/TEST_COVERAGE_QUALITY_EVALUATION.md) - 測試覆蓋率品質評估

## 更新記錄

- 2025-10-22: 完成根目錄文檔整理，移動 15 個文檔到正確位置
- 2025-10-22: 清理臨時文件，合併備份目錄
- 2025-10-18: 完成文檔架構重組，移動所有錯放文檔至正確位置
- 2025-10-18: 移除所有文檔中的 emoji（95% 完成）
- 2025-10-18: 建立文檔索引系統

## 貢獻指南

當新增或更新文檔時，請確保：

1. 文檔放置在正確的文件夾中
2. 在本索引文件中添加相應的連結
3. 使用清晰的文件命名（英文大寫加底線）
4. 不使用 emoji 符號
5. 包含適當的元數據（日期、作者、版本等）

## 相關資源

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Vue 3 文檔](https://vuejs.org/)
- [TypeScript 文檔](https://www.typescriptlang.org/docs/)
- [Drizzle ORM 文檔](https://orm.drizzle.team/)
