# 測試文檔

這個目錄包含了多渠道客服系統的所有測試文件。

## 目錄結構

```
tests/
├── unit/                    # 單元測試
│   ├── utils/              # 工具函數測試
│   │   └── auth.test.ts    # 認證系統測試
│   ├── handlers/           # API 處理器測試
│   └── services/           # 服務層測試
├── integration/            # 整合測試
│   └── activity-log.test.ts # 活動記錄整合測試 ⭐
├── e2e/                   # 端到端測試
├── helpers/               # 測試輔助工具
│   ├── mockDatabase.ts    # 資料庫模擬
│   ├── mockKV.ts         # KV 存儲模擬
│   └── testData.ts       # 測試數據
├── test-activity-logging.ts # 活動記錄功能測試 ⭐
├── test-permissions.ts     # 權限系統測試 ⭐
├── run-all-tests.ts       # 執行所有測試 ⭐
├── setup.ts              # 測試環境設置
├── vitest.config.ts      # Vitest 配置
└── package.json          # 測試依賴
```

## 安裝依賴

```bash
cd tests
npm install
```

## 運行測試

### 運行所有測試
```bash
# 使用 npm
npm test

# 或直接執行整合測試
npx tsx run-all-tests.ts
```

### 運行特定測試文件
```bash
# 活動記錄整合測試
npx tsx integration/activity-log.test.ts

# 活動記錄功能測試
npx tsx test-activity-logging.ts

# 權限系統測試
npx tsx test-permissions.ts

# 單元測試
npm test auth.test.ts
```

### 運行測試並生成覆蓋率報告
```bash
npm run test:coverage
```

### 監視模式運行測試
```bash
npm run test:watch
```

### 使用 UI 界面運行測試
```bash
npm run test:ui
```

## 測試分類

### 🔥 高優先級測試
1. **認證與授權系統** (`unit/utils/auth.test.ts`)
   - JWT 簽名和驗證
   - 密碼哈希和驗證
   - 用戶認證流程
   - 權限檢查邏輯
   - 會話管理

### 🔶 中優先級測試
2. **資料庫操作** (`unit/utils/database.test.ts`)
3. **LINE 整合** (`unit/utils/line.test.ts`)
4. **API 處理器** (`unit/handlers/`)

### 🔷 低優先級測試
5. **前端組件** (`unit/frontend/`)
6. **整合測試** (`integration/`)

## 測試輔助工具

### MockD1Database
模擬 Cloudflare D1 資料庫的行為：
```typescript
import { createMockDatabase } from './helpers/mockDatabase'

const mockDB = createMockDatabase()
mockDB.mockQuery('SELECT * FROM users WHERE id = ?', mockUser)
```

### MockKVNamespace
模擬 Cloudflare KV 存儲的行為：
```typescript
import { createMockKV } from './helpers/mockKV'

const mockKV = createMockKV()
mockKV.setMockValue('session:123', JSON.stringify(sessionData))
```

### 測試數據
預定義的測試數據：
```typescript
import { mockUsers, testPasswords } from './helpers/testData'

// 使用預定義的用戶數據
const adminUser = mockUsers.admin
const validPassword = testPasswords.valid
```

## 編寫新測試

### 單元測試模板
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { functionToTest } from '../../../src/path/to/module'
import { createMockDatabase } from '../../helpers/mockDatabase'

describe('Module Name', () => {
  const mockDB = createMockDatabase()

  beforeEach(() => {
    mockDB.reset()
  })

  describe('functionToTest', () => {
    it('should do something when given valid input', async () => {
      // Arrange
      const input = 'test-input'
      mockDB.mockQuery('SELECT * FROM table', { id: 1 })

      // Act
      const result = await functionToTest(mockDB, input)

      // Assert
      expect(result).toBeDefined()
      expect(result.id).toBe(1)
    })
  })
})
```

## 測試最佳實踐

1. **AAA 模式**: Arrange（準備）、Act（執行）、Assert（斷言）
2. **描述性測試名稱**: 清楚說明測試的目的和預期結果
3. **獨立測試**: 每個測試應該獨立運行，不依賴其他測試
4. **模擬外部依賴**: 使用 mock 來隔離被測試的代碼
5. **邊界條件測試**: 測試邊界值和異常情況
6. **清理**: 在 `beforeEach` 中重置 mock 狀態

## 持續整合

測試應該在以下情況下自動運行：
- 提交代碼前
- Pull Request 創建時
- 合併到主分支前

## 覆蓋率目標

- 核心業務邏輯: 90%+
- API 處理器: 80%+
- 工具函數: 85%+
- 整體覆蓋率: 75%+