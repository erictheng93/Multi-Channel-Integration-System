# 活動記錄功能

## 概述

活動記錄功能提供完整的用戶操作追蹤和審計功能，確保系統的安全性和可追溯性。

## 功能特點

### 自動記錄
- 用戶登入/登出
- 對話指派和轉移
- 系統設定更新
- 團隊管理操作
- 對話狀態變更

### 權限控制
- **Admin**: 可查看所有用戶的活動記錄
- **Agent**: 只能查看自己的活動記錄
- 嚴格的資料隔離和存取控制

### 查詢功能
- 多維度篩選（用戶、操作類型、資源類型、時間範圍）
- 分頁查詢支援大量資料
- 統計分析和概覽資訊

## API 端點

### 獲取活動記錄列表
```
GET /api/activities
```

查詢參數：
- `page`: 頁碼（預設: 1）
- `pageSize`: 每頁數量（預設: 50）
- `userId`: 用戶 ID 篩選
- `action`: 操作類型篩選
- `resourceType`: 資源類型篩選
- `startDate`: 開始日期
- `endDate`: 結束日期

### 獲取活動概覽
```
GET /api/activities/overview
```
僅限 Admin 用戶訪問，提供統計分析資訊。

### 獲取用戶活動統計
```
GET /api/activities/users/:userId/stats
```

### 清理舊記錄
```
DELETE /api/activities/cleanup
```
僅限 Admin 用戶，清理指定天數之前的記錄。

## 前端界面

### 活動記錄頁面
路由：`/activities`

功能：
- 活動記錄列表顯示
- 多維度篩選器
- 分頁控制
- 詳情展開查看

### 權限控制
- Admin 用戶可以在篩選器中選擇任何用戶
- Agent 用戶只能查看自己的記錄
- 未授權用戶無法訪問頁面

## 資料結構

### 活動記錄表 (activities)
```sql
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT, -- JSON 格式
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 活動類型
- `user_login`: 用戶登入
- `user_logout`: 用戶登出
- `conversation_assign`: 對話指派
- `conversation_transfer`: 對話轉移
- `conversation_close`: 對話關閉
- `settings_update`: 系統設定更新
- `team_invite`: 團隊成員邀請
- `team_member_update`: 團隊成員更新

## 安全考量

### 資料保護
- 敏感資訊（如密碼）不會記錄
- 個人資料遵循最小化原則
- 活動詳情避免包含機密資訊

### 存取控制
- 所有 API 端點都需要 JWT 認證
- 基於角色的權限檢查
- 防止跨用戶資料存取

### 審計追蹤
- 完整的操作記錄
- 不可篡改的時間戳記
- 操作者身份確認

## 效能考量

### 查詢優化
- 資料庫索引優化
- 分頁查詢減少負載
- 篩選條件優化

### 儲存管理
- 定期清理舊記錄
- 資料歸檔策略
- 儲存空間監控

## 使用指南

### 管理員使用
1. 登入系統
2. 點擊左側導航的「活動記錄」
3. 查看所有用戶的活動記錄
4. 使用篩選功能查找特定記錄
5. 查看活動概覽和統計資訊

### 客服使用
1. 登入系統
2. 點擊左側導航的「活動記錄」
3. 查看自己的活動記錄
4. 使用篩選功能查找特定記錄