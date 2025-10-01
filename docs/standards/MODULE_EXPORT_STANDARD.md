# 模組導出格式標準規範

## 一、標準模組導出結構

每個模組的 `index.ts` 檔案應遵循以下標準結構：

```typescript
// ============================================================================
// [MODULE_NAME] Module - [模組中文名稱]
// [模組簡要描述]
// ============================================================================

// ======================== 類型導出 ========================
export type * from './types/[module]-types';

// ======================== 服務導出 ========================
export { MainService } from './services/main-service';
// 其他服務...

// ======================== 處理器導出 ========================
export { mainHandler } from './handlers/main-handler';
export { default as moduleHandler } from './handlers/index';

// ======================== 中間件導出 ========================
export * from './middleware/index';

// ======================== 工具函數導出 ========================
export * from './utils/index';

// ======================== 常數導出 ========================
export * from './constants/index';

// ======================== 模組配置 ========================
export interface ModuleConfig {
  // 配置介面定義
}

export const DEFAULT_MODULE_CONFIG: ModuleConfig = {
  // 預設配置
};

// ======================== 模組資訊 ========================
export const MODULE_INFO = {
  name: 'module-name',
  version: '1.0.0',
  description: '模組描述',

  features: [
    // 功能列表
  ],

  endpoints: {
    total: 0,
    implemented: 0,
    pending: 0,
    categories: {}
  },

  permissions: {
    admin: { /* 權限描述 */ },
    team: { /* 權限描述 */ },
    agent: { /* 權限描述 */ }
  },

  technical: {
    // 技術規格
  },

  status: {
    development: 'completed' | 'in_progress' | 'pending',
    testing: 'completed' | 'in_progress' | 'pending',
    deployment: 'completed' | 'in_progress' | 'pending',
    integration: 'completed' | 'in_progress' | 'pending'
  }
} as const;

// ======================== 初始化函數 ========================
export function initializeModule(config: Partial<ModuleConfig> = {}) {
  // 模組初始化邏輯
}

// ======================== 向後兼容 ========================
export { moduleHandler as default } from './handlers/index';
```

## 二、命名約定

1. **模組名稱**: 使用 kebab-case
2. **導出服務**: 使用 PascalCase，以 Service 結尾
3. **導出處理器**: 使用 camelCase，以 Handler 結尾
4. **類型導出**: 使用 `export type *` 語法
5. **常數**: 使用 UPPER_SNAKE_CASE

## 三、必需元素

每個模組必須包含：
- 模組資訊 (MODULE_INFO)
- 預設配置 (DEFAULT_MODULE_CONFIG)
- 主要處理器導出
- 類型導出
- 向後兼容性導出

## 四、可選元素

根據模組複雜度可包含：
- 初始化函數
- 工具函數
- 中間件
- 常數定義