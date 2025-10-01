# Error Code Migration Guide
# 錯誤代碼遷移指南

## 概述 (Overview)

本指南說明如何從舊的 `response.errorCode` 格式遷移到新的 `response.metadata.errorCode` 格式。

This guide explains how to migrate from the old `response.errorCode` format to the new `response.metadata.errorCode` format.

## 背景 (Background)

### 舊格式 (Old Format)
```typescript
interface OldApiResponse {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;  // ❌ 在根層級
}
```

### 新格式 (New Format)
```typescript
interface NewApiResponse {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    errorCode?: string;  // ✅ 在 metadata 中
    processedAt?: string;
    queryTime?: number;
    cacheHit?: boolean;
    totalRecords?: number;
  }
}
```

## 為什麼要改變? (Why Change?)

1. **統一標準**: 將錯誤代碼與其他元數據統一管理
2. **類型安全**: 提供更好的 TypeScript 類型檢查
3. **可擴展性**: metadata 可以容納更多上下文信息
4. **一致性**: 與業界標準 API 響應格式對齊

## 遷移步驟 (Migration Steps)

### 1. 後端 API 響應

#### Before (舊代碼)
```typescript
return {
  success: false,
  error: 'Validation failed',
  errorCode: 'VALIDATION_ERROR'  // ❌ 錯誤
};
```

#### After (新代碼)
```typescript
return {
  success: false,
  error: 'Validation failed',
  metadata: {
    errorCode: 'VALIDATION_ERROR',  // ✅ 正確
    processedAt: new Date().toISOString(),
    queryTime: Date.now() - startTime
  }
};
```

### 2. 前端錯誤處理

#### Before (舊代碼)
```typescript
try {
  const response = await apiClient.get('/api/analytics/conversations');
  if (!response.success) {
    // ❌ 舊方式
    if (response.errorCode === 'VALIDATION_ERROR') {
      showValidationError(response.error);
    }
  }
} catch (error) {
  console.error(error);
}
```

#### After (新代碼)
```typescript
try {
  const response = await apiClient.get('/api/analytics/conversations');
  if (!response.success) {
    // ✅ 新方式
    const errorCode = response.metadata?.errorCode;
    if (errorCode === 'VALIDATION_ERROR') {
      showValidationError(response.error);
    } else if (errorCode === 'PROCESSING_ERROR') {
      showProcessingError(response.error);
    } else {
      showGenericError(response.error);
    }
  }
} catch (error) {
  console.error(error);
}
```

### 3. TypeScript 類型更新

#### Before (舊類型)
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;  // ❌ 舊定義
}
```

#### After (新類型)
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    errorCode?: string;  // ✅ 新定義
    processedAt?: string;
    queryTime?: number;
    cacheHit?: boolean;
    totalRecords?: number;
    [key: string]: unknown;
  };
}
```

## 錯誤代碼類型 (Error Code Types)

### Analytics Module
- `VALIDATION_ERROR`: 查詢參數驗證失敗
- `PROCESSING_ERROR`: 數據處理過程中發生錯誤
- `ANALYTICS_ERROR`: 通用分析服務錯誤
- `DATABASE_ERROR`: 數據庫操作失敗
- `CACHE_ERROR`: 緩存操作失敗

### Reports Module
- `VALIDATION_ERROR`: 報表參數驗證失敗
- `GENERATION_ERROR`: 報表生成過程中發生錯誤
- `NOT_FOUND`: 報表不存在
- `PERMISSION_DENIED`: 權限不足
- `EXPORT_ERROR`: 導出過程中發生錯誤

## 錯誤處理最佳實踐 (Best Practices)

### 1. 始終檢查 metadata 存在性
```typescript
const errorCode = response.metadata?.errorCode;
if (errorCode) {
  // 處理特定錯誤
}
```

### 2. 提供降級處理
```typescript
const errorCode = response.metadata?.errorCode || 'UNKNOWN_ERROR';
switch (errorCode) {
  case 'VALIDATION_ERROR':
    // 處理驗證錯誤
    break;
  case 'PROCESSING_ERROR':
    // 處理處理錯誤
    break;
  default:
    // 通用錯誤處理
    break;
}
```

### 3. 使用類型守衛
```typescript
function isValidationError(response: ApiResponse): boolean {
  return response.metadata?.errorCode === 'VALIDATION_ERROR';
}

if (isValidationError(response)) {
  // 處理驗證錯誤
}
```

### 4. 記錄完整錯誤上下文
```typescript
if (!response.success) {
  console.error('API Error:', {
    error: response.error,
    errorCode: response.metadata?.errorCode,
    queryTime: response.metadata?.queryTime,
    processedAt: response.metadata?.processedAt
  });
}
```

## 組件錯誤處理範例 (Component Error Handling Example)

```typescript
// Vue 3 Composition API 範例
import { ref } from 'vue';
import { apiClient } from '@/api/base';
import type { ApiResponse } from '@/types';

const errorMessage = ref('');
const errorType = ref<'validation' | 'processing' | 'unknown'>('unknown');

async function loadAnalytics() {
  try {
    const response: ApiResponse = await apiClient.get('/api/analytics/conversations');

    if (!response.success) {
      errorMessage.value = response.error || 'Unknown error occurred';

      const errorCode = response.metadata?.errorCode;
      if (errorCode === 'VALIDATION_ERROR') {
        errorType.value = 'validation';
      } else if (errorCode === 'PROCESSING_ERROR') {
        errorType.value = 'processing';
      } else {
        errorType.value = 'unknown';
      }

      // 根據錯誤類型顯示不同的 UI
      showErrorNotification(errorType.value, errorMessage.value);
    }
  } catch (error) {
    errorMessage.value = 'Network error occurred';
    errorType.value = 'unknown';
  }
}
```

## 測試範例 (Testing Example)

```typescript
describe('Error Handling', () => {
  it('should handle validation errors correctly', async () => {
    const mockResponse = {
      success: false,
      error: 'Invalid time range',
      metadata: {
        errorCode: 'VALIDATION_ERROR',
        processedAt: '2025-09-30T12:00:00Z',
        queryTime: 50
      }
    };

    // Mock API call
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResponse);

    const result = await getAnalytics();

    expect(result.success).toBe(false);
    expect(result.metadata?.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should handle missing metadata gracefully', async () => {
    const mockResponse = {
      success: false,
      error: 'Unknown error'
      // No metadata
    };

    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResponse);

    const result = await getAnalytics();

    // Should not throw error
    expect(result.metadata?.errorCode).toBeUndefined();
  });
});
```

## 向後兼容性 (Backward Compatibility)

為了確保平滑過渡,建議:

1. **在過渡期支持兩種格式**:
```typescript
const errorCode = response.metadata?.errorCode || (response as any).errorCode;
```

2. **記錄舊格式的使用**:
```typescript
if ((response as any).errorCode && !response.metadata?.errorCode) {
  console.warn('Using deprecated errorCode format. Please update to use metadata.errorCode');
}
```

3. **提供遷移工具**:
```typescript
function migrateErrorResponse(response: any): ApiResponse {
  if (response.errorCode && !response.metadata?.errorCode) {
    return {
      ...response,
      metadata: {
        ...response.metadata,
        errorCode: response.errorCode
      }
    };
  }
  return response;
}
```

## 檢查清單 (Checklist)

遷移完成後,請確認:

- [ ] 所有後端 API 響應使用 `metadata.errorCode`
- [ ] 所有前端錯誤處理代碼已更新
- [ ] TypeScript 類型定義已更新
- [ ] 測試用例已更新
- [ ] 錯誤處理文檔已更新
- [ ] 團隊成員已了解新格式
- [ ] CI/CD 管道通過所有測試

## 相關資源 (Related Resources)

- [Analytics Module Fix Report](../ANALYTICS_MODULE_FIX_REPORT.md)
- [API Response Standards](./standards/API_RESPONSE_STANDARDS.md)
- [Error Handling Best Practices](./standards/ERROR_HANDLING_BEST_PRACTICES.md)

## 支援 (Support)

如有疑問,請聯繫:
- 技術支援: tech-support@example.com
- 文檔維護: docs@example.com

---

**版本**: 1.0.0
**最後更新**: 2025-09-30
**維護者**: Development Team