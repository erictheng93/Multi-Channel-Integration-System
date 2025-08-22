# API 客戶端更新說明

## 更新概述

已成功整合你提供的 `base.ts` API 客戶端實作，並將整個前端 API 架構從 axios 遷移到原生 fetch API。

## 主要變更

### 1. 新增 API 基礎客戶端

**文件**: `frontend/src/api/base.ts`

- 使用原生 fetch API 替代 axios
- 統一的錯誤處理機制
- 自動 401 重定向處理
- 支援 Bearer Token 認證
- 環境變數配置支援

**核心功能**:
```typescript
class ApiClient {
  setAuthHeader(token: string)     // 設定認證標頭
  removeAuthHeader()               // 移除認證標頭
  get<T>(endpoint: string)         // GET 請求
  post<T>(endpoint, data?)         // POST 請求
  put<T>(endpoint, data?)          // PUT 請求
  delete<T>(endpoint)              // DELETE 請求
}
```

### 2. API 服務更新

#### Auth API (`frontend/src/api/auth.ts`)
- 移除 axios 依賴
- 使用新的 `apiClient` 實例
- 簡化錯誤處理邏輯
- 保持相同的公開介面

#### Conversations API (`frontend/src/api/conversations.ts`)
- 遷移到 fetch API
- 改進查詢參數處理
- 統一錯誤處理
- 保持所有現有方法

#### Messages API (`frontend/src/api/message.ts`)
- 完全遷移到新架構
- 簡化實作邏輯
- 保持類型安全

### 3. 環境變數配置

新增環境變數文件：

- `.env` - 基礎配置
- `.env.development` - 開發環境
- `.env.production` - 生產環境

**主要變數**:
```bash
VITE_API_URL=http://localhost:8787  # API 基礎 URL
VITE_APP_TITLE=Multi-Channel Support MVP
VITE_DEBUG=true                     # 調試模式
```

### 4. 依賴管理

**移除的依賴**:
- `axios` - 不再需要 HTTP 客戶端庫

**保留的依賴**:
- 所有 Vue 3 相關依賴
- TypeScript 支援
- 開發工具

## 技術優勢

### 1. 更小的打包體積
- 移除 axios 依賴減少了約 13KB 的打包大小
- 使用原生 fetch API，無額外依賴

### 2. 更好的類型安全
- 統一的 `ApiResponse<T>` 類型
- 完整的 TypeScript 支援
- 編譯時錯誤檢查

### 3. 統一的錯誤處理
- 集中式錯誤處理邏輯
- 自動 401 重定向
- 一致的錯誤回應格式

### 4. 環境配置靈活性
- 支援多環境配置
- 運行時環境變數
- 開發/生產環境分離

## 向後兼容性

✅ **完全向後兼容**
- 所有現有的 API 方法保持不變
- Store 和組件無需修改
- 相同的公開介面

## 使用範例

### 基本使用
```typescript
import { apiClient } from '@/api/base'

// GET 請求
const response = await apiClient.get<User[]>('/users')

// POST 請求
const result = await apiClient.post<User>('/users', userData)
```

### 認證設定
```typescript
import { authApi } from '@/api/auth'

// 設定認證標頭
authApi.setAuthHeader(token)

// 移除認證標頭
authApi.removeAuthHeader()
```

## 測試狀態

- ✅ 開發服務器啟動正常
- ✅ 類型檢查通過
- ✅ 所有 API 方法保持兼容
- ✅ 環境變數配置正確

## 後續建議

1. **API 端點測試**: 確保後端 API 端點與前端期望一致
2. **錯誤處理測試**: 測試各種錯誤情況的處理
3. **認證流程測試**: 驗證登入/登出流程
4. **生產環境配置**: 更新生產環境的 API URL

新的 API 客戶端架構已經完全整合並準備就緒！