# 組件文檔

這個目錄包含所有 Vue 組件的詳細文檔。

## UI 組件

### 基礎組件
- [FileUpload](./FileUpload.md) - 檔案上傳組件，支援拖放、進度追蹤和驗證
- [EmptyState](./EmptyState.md) - 空狀態組件，支援載入狀態和自訂操作
- [LoadingSpinner](./LoadingSpinner.md) - 載入動畫組件，支援多種尺寸和變體

## 對話相關組件

### 對話管理
- [ConversationCard](./ConversationCard.md) - 對話卡片組件，顯示對話摘要和狀態
- [MessageInput](./MessageInput.md) - 訊息輸入組件，支援文字輸入和檔案附件

## 平台整合組件

### 平台狀態
- [PlatformStatus](./PlatformStatus.md) - 平台狀態組件，監控和管理平台連線

## 其他組件

### 登入相關
- [Login](./Login.md) - 登入組件文檔

## 文檔規範

每個組件文檔都包含以下部分：

1. **概述** - 組件的基本介紹和用途
2. **屬性 (Props)** - 所有可用屬性的詳細說明
3. **事件 (Events)** - 組件觸發的事件
4. **插槽 (Slots)** - 可用的插槽（如適用）
5. **使用範例** - 實際使用的程式碼範例
6. **樣式設定** - CSS 自訂屬性和主題設定
7. **無障礙設計** - 無障礙功能說明
8. **測試** - 測試覆蓋和執行方式
9. **效能考量** - 效能最佳化建議
10. **瀏覽器支援** - 支援的瀏覽器版本

## 貢獻指南

當新增或更新組件時，請確保：

1. 更新對應的文檔檔案
2. 包含完整的使用範例
3. 記錄所有屬性和事件
4. 說明無障礙功能
5. 更新此 README 檔案的索引

## 相關資源

- [前端開發指南](../guides/FRONTEND_README.md)
- [API 文檔](../api/)
- [測試指南](../testing/)
- [新用戶部署指南](../NEW_USER_DEPLOYMENT_GUIDE.md) - 完整自動化部署
- [開發者部署指南](../guides/DEPLOYMENT_GUIDE.md) - 手動部署參考