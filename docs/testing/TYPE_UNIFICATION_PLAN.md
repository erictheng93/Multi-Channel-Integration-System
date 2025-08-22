# 型別統一計劃

## 🎯 目標

統一專案中重複的型別定義，建立清晰的型別層次結構，提高型別安全性和維護性。

## 📊 當前型別分佈分析

### 重複型別識別

| 型別名稱 | 定義位置 | 差異說明 |
|---------|---------|---------|
| `Agent` | `src/types/shared.ts`, `shared/api-types.ts` | 字段略有不同 |
| `ApiResponse` | `src/types/shared.ts`, `shared/api-types.ts` | 結構相似但命名不同 |
| `Conversation` | `src/types/shared.ts`, `shared/api-types.ts` | 關聯字段處理不同 |
| `Message` | `src/types/shared.ts`, `shared/api-types.ts` | 媒體類型字段不同 |
| `User` | `src/types/shared.ts`, `shared/api-types.ts` | 平台字段定義不同 |

## 🏗️ 統一策略

### 方案選擇：分層型別系統

```
shared/
├── api-types.ts          # API 契約型別（前後端共用）
├── types/
│   ├── core.ts          # 核心業務型別
│   ├── api.ts           # API 專用型別
│   └── index.ts         # 統一匯出
```

### 型別層次定義

#### 1. 核心型別 (`shared/types/core.ts`)
```typescript
// 平台無關的核心業務型別
export type Platform = 'line' | 'facebook'
export type UserRole = 'admin' | 'agent'
export type ConversationStatus = 'open' | 'assigned' | 'closed'
export type MessageType = 'text' | 'image' | 'video' | 'file'
export type SenderType = 'user' | 'agent' | 'system'
```

#### 2. API 型別 (`shared/types/api.ts`)
```typescript
// API 請求/響應專用型別
export interface StandardApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
}

export interface PaginatedResponse<T> extends StandardApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

#### 3. 業務實體型別 (`shared/types/entities.ts`)
```typescript
// 統一的業務實體定義
export interface User {
  id: string
  name: string
  platform: Platform
  platformUserId: string
  avatarUrl?: string
  createdAt: number
}

export interface Agent {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  createdAt: number
  lastActive?: number
}

export interface Conversation {
  id: string
  userId: string
  user?: User
  assignedTo?: string
  assignedAgent?: Agent
  status: ConversationStatus
  lastMessageAt: number
  unreadCount: number
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  senderType: SenderType
  senderId: string
  content: string
  messageType: MessageType
  mediaUrl?: string
  platform: Platform
  timestamp: number
  createdAt: number
}
```

## 🔄 遷移步驟

### 步驟 1: 創建統一型別定義
1. 創建 `shared/types/` 目錄結構
2. 定義核心型別
3. 定義 API 型別
4. 定義業務實體型別

### 步驟 2: 更新現有文件
1. 更新 `shared/api-types.ts` 使用新的統一型別
2. 移除 `src/types/shared.ts` 中的重複定義
3. 更新 `src/types/index.ts` 的匯出

### 步驟 3: 更新引用
1. 前端組件和 store 更新引用
2. API 客戶端更新引用
3. 測試文件更新引用

### 步驟 4: 驗證和測試
1. TypeScript 編譯檢查
2. 運行所有測試
3. 構建驗證

## 📝 實施細節

### 型別轉換器保留
```typescript
// src/types/converters.ts - 保留現有轉換邏輯
// 用於處理資料庫型別和前端型別之間的轉換
export function dbUserToUser(dbUser: DbUser): User {
  return {
    id: dbUser.id.toString(),
    name: dbUser.displayName,
    platform: dbUser.platform as Platform,
    platformUserId: dbUser.platform_user_id,
    avatarUrl: dbUser.avatar_url,
    createdAt: new Date(dbUser.created_at).getTime()
  }
}
```

### 向後兼容性
- 保留現有的資料庫型別定義
- 使用型別別名確保現有代碼繼續工作
- 逐步遷移，避免破壞性變更

## ✅ 驗證標準

### 編譯檢查
```bash
# 前端編譯檢查
cd frontend && npx vue-tsc --noEmit

# 後端編譯檢查
npx tsc --noEmit
```

### 測試驗證
```bash
# 前端測試
cd frontend && npm test

# 後端測試
cd tests && npm test
```

### 型別覆蓋率
- 目標：95% 以上的型別覆蓋率
- 工具：使用 TypeScript 編譯器 API 檢查
- 報告：生成型別覆蓋率報告

## 📅 時程規劃

### 第一天
- [x] 分析現有型別重複情況
- [x] 設計統一型別架構
- [ ] 創建核心型別定義

### 第二天
- [ ] 實施型別統一
- [ ] 更新主要引用
- [ ] 驗證編譯和測試

### 第三天
- [ ] 完善型別轉換器
- [ ] 更新文檔
- [ ] 最終驗證

## 🎯 預期效果

### 短期效果
- 消除型別定義重複
- 提高型別一致性
- 減少維護成本

### 長期效果
- 更好的開發體驗
- 更少的型別相關錯誤
- 更容易的功能擴展

---

**下一步**: 開始實施步驟 1，創建統一的型別定義結構。