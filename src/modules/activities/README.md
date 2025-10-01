# Activities 模組 (活動追蹤模組)

## 📖 概覽

Activities 模組提供了完整的活動記錄和追蹤功能，支援系統內各種用戶操作的記錄、統計分析和監控。

## 🏗️ 架構設計

```
src/modules/activities/
├── 📁 services/             # 業務邏輯服務
│   ├── ActivityService.ts         # 核心活動記錄服務
│   ├── TeamActivityService.ts     # 團隊活動特化服務
│   └── ActivityStatsService.ts    # 統計分析服務
├── 📁 handlers/             # HTTP 處理器
│   └── ActivityHandler.ts         # API 請求處理
├── 📁 types/                # 型別定義
│   └── interfaces.ts              # 核心介面
├── 📁 constants/            # 常數定義
│   ├── actions.ts                 # 活動類型常數
│   └── resources.ts               # 資源類型常數
├── 📁 utils/                # 工具函數
│   ├── validators.ts              # 數據驗證
│   └── formatters.ts              # 格式化工具
└── 📄 index.ts              # 模組統一匯出
```

## 🚀 主要功能

### 1. 活動記錄 (Activity Logging)
- **記錄各種用戶操作**: 登入、團隊管理、對話操作等
- **結構化數據存儲**: 支援 JSON 格式的詳細信息
- **自動時間戳記**: 自動記錄操作時間
- **IP 和 User Agent 追蹤**: 可選的環境信息記錄

### 2. 統計分析 (Analytics)
- **用戶活動統計**: 按用戶統計操作頻率和類型
- **系統使用趨勢**: 日期、小時級別的使用模式分析
- **操作類型分布**: 各類操作的頻率統計
- **性能指標**: 系統負載和使用高峰分析

### 3. 團隊活動追蹤 (Team Activity Tracking)
- **團隊管理操作**: 創建、更新、刪除團隊
- **成員管理**: 添加、移除團隊成員
- **權限變更**: 角色和權限修改記錄
- **QR 碼生成**: 團隊 QR 碼生成記錄

## 💻 使用方式

### 基本匯入
```typescript
import {
  ActivityService,
  TeamActivityService,
  ActivityStatsService,
  ACTIVITY_ACTIONS,
  RESOURCE_TYPES
} from '../modules/activities'
```

### 活動記錄服務
```typescript
const activityService = new ActivityService(database)

// 記錄單一活動
await activityService.logActivity({
  userId: 'user123',
  userName: 'John Doe',
  userRole: 'admin',
  action: ACTIVITY_ACTIONS.USER_LOGIN,
  resourceType: RESOURCE_TYPES.USER,
  resourceId: 'user123',
  details: { loginMethod: 'oauth' }
})

// 獲取活動列表
const activities = await activityService.getActivities({
  page: 1,
  pageSize: 50,
  userId: 'user123'
})
```

### 團隊活動服務
```typescript
const teamActivityService = new TeamActivityService(database)

// 記錄團隊創建
await teamActivityService.logTeamCreate({
  userId: 'admin123',
  userName: 'Admin User',
  userRole: 'admin',
  teamId: 1,
  teamName: '客服團隊',
  description: '處理客戶服務相關事務'
})

// 記錄成員操作
await teamActivityService.logMemberAdd({
  userId: 'admin123',
  userName: 'Admin User',
  userRole: 'admin',
  teamId: 1,
  teamName: '客服團隊',
  addedAgentId: 'agent456',
  addedAgentName: 'Agent Smith'
})
```

### 統計分析服務
```typescript
const statsService = new ActivityStatsService(database)

// 獲取系統概覽
const overview = await statsService.getOverview(7) // 最近 7 天

// 獲取活動趨勢
const trends = await statsService.getActivityTrends(30) // 最近 30 天

// 獲取熱力圖數據
const heatmap = await statsService.getActivityHeatmap(30)
```

## 🔧 API 端點

### 活動記錄 API
- `GET /api/activities` - 獲取活動列表
- `GET /api/activities/:id` - 獲取活動詳情
- `GET /api/activities/user/:userId/stats` - 獲取用戶統計
- `DELETE /api/activities/cleanup` - 清理舊記錄 (僅 admin)

### 統計分析 API
- `GET /api/activities/overview` - 系統概覽統計
- `GET /api/activities/stats/resources` - 資源類型統計
- `GET /api/activities/stats/roles` - 用戶角色統計
- `GET /api/activities/trends` - 活動趨勢分析
- `GET /api/activities/heatmap` - 活動熱力圖
- `GET /api/activities/metrics` - 性能指標

## 📊 支援的活動類型

### 對話相關
- `conversation_assign` - 對話指派
- `conversation_transfer` - 對話轉移
- `conversation_close` - 關閉對話
- `conversation_reopen` - 重開對話

### 訊息相關
- `message_send` - 發送訊息
- `message_recall` - 撤回訊息

### 用戶管理
- `user_login` - 用戶登入
- `user_logout` - 用戶登出
- `user_create` - 創建用戶
- `user_update` - 更新用戶
- `user_delete` - 刪除用戶

### 團隊管理
- `team_create` - 創建團隊
- `team_update` - 更新團隊
- `team_delete` - 刪除團隊
- `member_add` - 添加成員
- `member_remove` - 移除成員

### 系統操作
- `settings_update` - 設定更新
- `qr_code_generate` - QR 碼生成

## 🛡️ 權限控制

### 讀取權限
- **Admin**: 可查看所有用戶的活動記錄
- **Team/Agent**: 只能查看自己的活動記錄

### 統計權限
- **Admin**: 可存取所有統計和分析功能
- **Team/Agent**: 無法存取系統級統計

### 管理權限
- **Admin**: 可執行清理舊記錄等管理操作
- **其他角色**: 無管理權限

## 🔄 向後相容性

此模組提供完整的向後相容性支援：

### Legacy 匯入支援
```typescript
// 舊的匯入方式仍然有效
import { ActivityService } from '../services/activity-service'
import { TeamActivityService } from '../modules/teams/services/activity-service'
```

### API 相容性
- 所有現有 API 端點保持不變
- 現有的處理器邏輯無需修改
- 資料庫結構完全相容

## 🚀 性能特性

### 資料庫優化
- **索引優化**: 針對常用查詢字段建立索引
- **分頁支援**: 大量數據的高效分頁處理
- **條件查詢**: 支援多條件組合查詢

### 記憶體管理
- **懶載入**: 按需載入數據和統計
- **批次處理**: 支援批次記錄活動
- **錯誤隔離**: 記錄失敗不影響主要業務流程

### 統計效能
- **快取支援**: 統計數據支援快取機制
- **增量計算**: 支援增量統計更新
- **並行處理**: 多個統計任務並行執行

## 🧪 測試支援

模組提供完整的測試支援：

### 單元測試
- 所有服務類都可以獨立測試
- 提供 Mock 數據和測試工具
- 支援依賴注入的測試模式

### 整合測試
- 完整的 API 端點測試
- 資料庫操作測試
- 權限控制測試

## 🔮 擴展性

### 新增活動類型
```typescript
// 在 constants/actions.ts 中添加新的活動類型
export const ACTIVITY_ACTIONS = {
  // ... 現有類型
  NEW_ACTION: 'new_action'
}
```

### 客制化統計
```typescript
// 擴展 ActivityStatsService 類
class CustomStatsService extends ActivityStatsService {
  async getCustomReport() {
    // 自定義統計邏輯
  }
}
```

### 新增驗證規則
```typescript
// 在 utils/validators.ts 中添加新的驗證邏輯
export class CustomValidator extends ActivityValidator {
  static validateCustom(data: any): ValidationError[] {
    // 客制化驗證邏輯
  }
}
```

## 📈 監控和除錯

### 日誌記錄
```typescript
// 自動記錄操作日誌
console.log('✅ [Activity Service] Activity logged with ID:', activityId)
console.error('❌ [Activity Service] Failed to log activity:', error)
```

### 錯誤處理
- **靜默失敗**: 記錄失敗不影響主業務
- **詳細錯誤**: 提供詳細的錯誤信息
- **重試機制**: 支援失敗重試

### 性能監控
- **響應時間**: 追蹤各操作的響應時間
- **錯誤率**: 監控錯誤發生頻率
- **使用統計**: 分析功能使用情況

## 🎯 最佳實務

### 記錄活動
1. **必要信息**: 確保包含 userId, userName, userRole
2. **詳細描述**: 在 details 中提供操作的詳細信息
3. **資源識別**: 提供 resourceId 便於關聯查詢

### 統計查詢
1. **分頁處理**: 大量數據查詢時使用分頁
2. **時間範圍**: 適當限制查詢的時間範圍
3. **索引利用**: 利用已建立的索引進行查詢

### 權限控制
1. **最小權限**: 只給予必要的查詢權限
2. **數據隔離**: 確保用戶只能存取自己的數據
3. **審計追蹤**: 記錄所有的權限變更操作

---

## 📝 更新日誌

### v1.0.0 (2024-09-26)
- ✨ 完成模組化重組
- 🏗️ 建立獨立的模組結構
- 🔄 實現向後相容性
- 📊 新增統計分析功能
- 🛡️ 完善權限控制
- 🧪 提供完整測試支援