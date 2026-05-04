# 活動記錄功能部署指南

## 概述

本指南說明如何部署活動記錄功能，包括資料庫遷移、後端更新和前端部署。

## 功能特點

###  已實現的功能

1. **完整的活動記錄系統**
   - 自動記錄用戶登入/登出
   - 記錄對話指派和轉移
   - 記錄系統設定更新
   - 記錄團隊管理操作

2. **權限控制增強**
   - Admin 可以查看所有活動記錄
   - Agent 只能查看自己的活動記錄
   - Agent 只能查看指派給自己的對話

3. **前端界面**
   - 活動記錄頁面 (`/activities`)
   - 篩選和搜尋功能
   - 分頁和詳情展開
   - 匯出功能（準備中）

## 部署步驟

### 1. 資料庫遷移

執行資料庫遷移來創建活動記錄表：

```bash
# 方法 1: 使用遷移腳本
bun run db:migrate

# 方法 2: 手動執行 SQL
# 執行 database/migrations/001_add_activities_table.sql 中的 SQL 語句
```

### 2. 後端部署

確保後端包含以下新增的檔案：

```
src/
├── services/
│   └── activity-service.ts          # 活動記錄服務
├── handlers/
│   └── activity.ts                  # 活動記錄 API 處理器
└── index.ts                         # 更新的路由配置
```

部署後端：

```bash
# 建置和部署
bun run build
bun run deploy
```

### 3. 前端部署

確保前端包含以下新增的檔案：

```
frontend/src/
├── views/
│   └── ActivityLog.vue              # 活動記錄頁面
├── api/
│   └── activities.ts                # 活動記錄 API 客戶端
├── router/
│   └── index.ts                     # 更新的路由配置
└── components/ui/
    └── AppLayout.vue                # 更新的導航選單
```

部署前端：

```bash
cd frontend
bun run build
bun run deploy
```

## 測試驗證

### 1. 執行測試腳本

```bash
# 測試活動記錄功能
bunx ts-node tests/test-activity-logging.ts

# 測試權限控制
bunx ts-node tests/test-permissions.ts
```

### 2. 手動測試

1. **登入測試**
   - 以 Admin 身份登入
   - 檢查活動記錄頁面是否顯示登入記錄

2. **對話指派測試**
   - 指派對話給 Agent
   - 檢查活動記錄是否記錄指派操作

3. **權限測試**
   - 以 Agent 身份登入
   - 確認只能看到指派給自己的對話
   - 確認只能看到自己的活動記錄

4. **系統設定測試**
   - 更新系統設定
   - 檢查活動記錄是否記錄設定更新

## API 端點

### 活動記錄 API

```
GET    /api/activities                    # 獲取活動記錄列表
GET    /api/activities/users/:id/stats    # 獲取用戶活動統計
GET    /api/activities/overview           # 獲取活動概覽（僅 Admin）
DELETE /api/activities/cleanup            # 清理舊記錄（僅 Admin）
```

### 查詢參數

```
page         - 頁碼（預設: 1）
pageSize     - 每頁數量（預設: 50，最大: 100）
userId       - 用戶 ID 篩選
action       - 操作類型篩選
resourceType - 資源類型篩選
startDate    - 開始日期
endDate      - 結束日期
```

## 權限矩陣

| 角色  | 查看所有對話 | 查看指派對話 | 指派對話 | 查看所有活動 | 查看自己活動 |
|-------|-------------|-------------|----------|-------------|-------------|
| Admin |           |           |        |           |           |
| Agent |           |           |        |           |           |

## 活動類型

### 用戶相關
- `user_login` - 用戶登入
- `user_logout` - 用戶登出
- `user_create` - 創建用戶
- `user_update` - 更新用戶
- `user_delete` - 刪除用戶

### 對話相關
- `conversation_assign` - 對話指派
- `conversation_transfer` - 對話轉移
- `conversation_close` - 對話關閉
- `conversation_reopen` - 對話重開

### 訊息相關
- `message_send` - 發送訊息
- `message_recall` - 撤回訊息

### 系統相關
- `settings_update` - 系統設定更新

### 團隊相關
- `team_invite` - 邀請成員
- `team_member_update` - 更新成員
- `team_member_remove` - 移除成員

## 故障排除

### 常見問題

1. **活動記錄表不存在**
   ```
   錯誤: table activities doesn't exist
   解決: 執行資料庫遷移腳本
   ```

2. **權限被拒絕**
   ```
   錯誤: 403 Forbidden
   解決: 檢查用戶角色和 JWT Token
   ```

3. **活動記錄頁面空白**
   ```
   問題: 前端無法載入活動記錄
   解決: 檢查 API 端點和網路連接
   ```

### 日誌檢查

```bash
# 檢查 Cloudflare Worker 日誌
wrangler tail

# 檢查前端控制台錯誤
# 開啟瀏覽器開發者工具 > Console
```

## 效能考量

1. **活動記錄清理**
   - 預設保留 90 天的記錄
   - 可透過 API 手動清理舊記錄
   - 建議設定定期清理任務

2. **查詢優化**
   - 活動記錄表已建立適當索引
   - 分頁查詢避免大量資料載入
   - 篩選條件減少查詢範圍

3. **儲存空間**
   - 活動詳情以 JSON 格式儲存
   - 避免儲存過大的詳情資料
   - 定期監控資料庫大小

## 安全考量

1. **敏感資訊**
   - 密碼等敏感資訊不會記錄
   - IP 位址和 User Agent 僅用於審計
   - 活動詳情避免包含個人資料

2. **存取控制**
   - 所有 API 端點都需要 JWT 認證
   - 權限檢查確保資料隔離
   - Admin 操作額外記錄和監控

## 監控和警報

建議設定以下監控：

1. **異常活動監控**
   - 大量登入失敗
   - 異常時間的操作
   - 批量資料變更

2. **效能監控**
   - API 回應時間
   - 資料庫查詢效能
   - 儲存空間使用量

3. **錯誤監控**
   - 活動記錄失敗
   - 權限檢查錯誤
   - API 端點錯誤率