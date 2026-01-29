# Error Code Migration Guide

## (Overview)

 `response.errorCode` `response.metadata.errorCode`

This guide explains how to migrate from the old `response.errorCode` format to the new `response.metadata.errorCode` format.

## (Background)

### (Old Format)
```typescript
interface OldApiResponse {
 success: boolean;
 data?: T;
 error?: string;
 errorCode?: string; //
}
```

### (New Format)
```typescript
interface NewApiResponse {
 success: boolean;
 data?: T;
 error?: string;
 metadata?: {
 errorCode?: string; // metadata
 processedAt?: string;
 queryTime?: number;
 cacheHit?: boolean;
 totalRecords?: number;
 }
}
```

## ? (Why Change?)

1. ****:
2. ****: TypeScript
3. ****: metadata
4. ****: API

## (Migration Steps)

### 1. API

#### Before ()
```typescript
return {
 success: false,
 error: 'Validation failed',
 errorCode: 'VALIDATION_ERROR' //
};
```

#### After ()
```typescript
return {
 success: false,
 error: 'Validation failed',
 metadata: {
 errorCode: 'VALIDATION_ERROR', //
 processedAt: new Date().toISOString(),
 queryTime: Date.now() - startTime
 }
};
```

### 2.

#### Before ()
```typescript
try {
 const response = await apiClient.get('/api/analytics/conversations');
 if (!response.success) {
 //
 if (response.errorCode === 'VALIDATION_ERROR') {
 showValidationError(response.error);
 }
 }
} catch (error) {
 console.error(error);
}
```

#### After ()
```typescript
try {
 const response = await apiClient.get('/api/analytics/conversations');
 if (!response.success) {
 //
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

### 3. TypeScript

#### Before ()
```typescript
interface ApiResponse<T> {
 success: boolean;
 data?: T;
 error?: string;
 errorCode?: string; //
}
```

#### After ()
```typescript
interface ApiResponse<T> {
 success: boolean;
 data?: T;
 error?: string;
 metadata?: {
 errorCode?: string; //
 processedAt?: string;
 queryTime?: number;
 cacheHit?: boolean;
 totalRecords?: number;
 [key: string]: unknown;
 };
}
```

## (Error Code Types)

### Analytics Module
- `VALIDATION_ERROR`:
- `PROCESSING_ERROR`:
- `ANALYTICS_ERROR`:
- `DATABASE_ERROR`:
- `CACHE_ERROR`:

### Reports Module
- `VALIDATION_ERROR`:
- `GENERATION_ERROR`:
- `NOT_FOUND`:
- `PERMISSION_DENIED`:
- `EXPORT_ERROR`:

## (Best Practices)

### 1. metadata
```typescript
const errorCode = response.metadata?.errorCode;
if (errorCode) {
 //
}
```

### 2.
```typescript
const errorCode = response.metadata?.errorCode || 'UNKNOWN_ERROR';
switch (errorCode) {
 case 'VALIDATION_ERROR':
 //
 break;
 case 'PROCESSING_ERROR':
 //
 break;
 default:
 //
 break;
}
```

### 3.
```typescript
function isValidationError(response: ApiResponse): boolean {
 return response.metadata?.errorCode === 'VALIDATION_ERROR';
}

if (isValidationError(response)) {
 //
}
```

### 4.
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

## (Component Error Handling Example)

```typescript
// Vue 3 Composition API
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

 // UI
 showErrorNotification(errorType.value, errorMessage.value);
 }
 } catch (error) {
 errorMessage.value = 'Network error occurred';
 errorType.value = 'unknown';
 }
}
```

## (Testing Example)

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

## (Backward Compatibility)

,:

1. ****:
```typescript
const errorCode = response.metadata?.errorCode || (response as any).errorCode;
```

2. ****:
```typescript
if ((response as any).errorCode && !response.metadata?.errorCode) {
 console.warn('Using deprecated errorCode format. Please update to use metadata.errorCode');
}
```

3. ****:
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

## (Checklist)

,:

- [ ] API `metadata.errorCode`
- [ ]
- [ ] TypeScript
- [ ]
- [ ]
- [ ]
- [ ] CI/CD

## (Related Resources)

- [Analytics Module Fix Report](../ANALYTICS_MODULE_FIX_REPORT.md)
- [API Response Standards](./standards/API_RESPONSE_STANDARDS.md)
- [Error Handling Best Practices](./standards/ERROR_HANDLING_BEST_PRACTICES.md)

## (Support)

,:
- : tech-support@example.com
- : docs@example.com

---

****: 1.0.0
****: 2025-09-30
****: Development Team