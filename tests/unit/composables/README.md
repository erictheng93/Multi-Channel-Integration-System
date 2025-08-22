# Composables Unit Tests / 組合式函數單元測試

This directory contains comprehensive unit tests for Vue 3 composables and Pinia stores used in the frontend application.

## Test Structure / 測試結構

### Core Composables / 核心組合式函數

- **`useError.test.ts`**: Error handling composable tests / 錯誤處理組合式函數測試
- **`useAuthStore.test.ts`**: Authentication store tests / 認證狀態管理測試
- **`useConversationsStore.test.ts`**: Conversations store tests / 對話狀態管理測試

### Advanced Test Suites / 進階測試套件

- **`composables-edge-cases.test.ts`**: Edge cases and error scenarios / 邊界情況和錯誤場景
- **`composables-performance.test.ts`**: Performance and scalability tests / 性能和可擴展性測試
- **`composables-integration.test.ts`**: Integration workflows and cross-composable interactions / 整合工作流程和跨組合式函數互動

## Test Coverage / 測試覆蓋率

### useError Composable / useError 組合式函數
- ✅ Initial state management / 初始狀態管理
- ✅ Error handling from different sources / 不同來源的錯誤處理
- ✅ Loading state management / 載入狀態管理
- ✅ Async operation wrapping / 異步操作包裝
- ✅ Error clearing functionality / 錯誤清除功能
- ✅ Reactive behavior / 響應式行為
- ✅ Edge cases (circular references, large objects) / 邊界情況

### useAuthStore (Pinia Store) / useAuthStore (Pinia 狀態管理)
- ✅ Initial state and localStorage integration / 初始狀態和本地存儲整合
- ✅ Login/logout functionality / 登入/登出功能
- ✅ Token management / 令牌管理
- ✅ User profile fetching / 用戶資料獲取
- ✅ Computed properties (isAuthenticated, isAdmin) / 計算屬性
- ✅ Error handling and network failures / 錯誤處理和網路故障
- ✅ Router integration / 路由整合
- ✅ Concurrent operations / 並發操作

### useConversationsStore (Pinia Store) / useConversationsStore (Pinia 狀態管理)
- ✅ Conversation fetching and filtering / 對話獲取和篩選
- ✅ Message management / 訊息管理
- ✅ Conversation assignment / 對話指派
- ✅ Mock data fallback in development / 開發環境模擬資料回退
- ✅ Loading state management / 載入狀態管理
- ✅ Error handling and recovery / 錯誤處理和恢復
- ✅ Large dataset handling / 大型資料集處理

## Running Tests / 執行測試

### Individual Test Files / 個別測試檔案
```bash
# Core useError tests / 核心 useError 測試
npm test tests/unit/composables/useError.test.ts

# Auth store tests / 認證狀態管理測試
npm test tests/unit/composables/useAuthStore.test.ts

# Conversations store tests / 對話狀態管理測試
npm test tests/unit/composables/useConversationsStore.test.ts

# Edge cases / 邊界情況
npm test tests/unit/composables/composables-edge-cases.test.ts

# Performance tests / 性能測試
npm test tests/unit/composables/composables-performance.test.ts

# Integration tests / 整合測試
npm test tests/unit/composables/composables-integration.test.ts
```

### All Composable Tests / 所有組合式函數測試
```bash
npm test tests/unit/composables/
```

## Test Patterns / 測試模式

### Mocking Strategy / 模擬策略
- **API Mocking**: All API calls are mocked using Vitest / 所有 API 調用使用 Vitest 模擬
- **Router Mocking**: Vue Router is mocked for navigation testing / Vue Router 被模擬用於導航測試
- **LocalStorage Mocking**: Browser localStorage is mocked / 瀏覽器本地存儲被模擬
- **Pinia Integration**: Fresh Pinia instances for each test / 每個測試使用新的 Pinia 實例

### Test Data Patterns / 測試資料模式
```typescript
// Standard test user / 標準測試用戶
const mockAgent = {
  id: 1,
  username: 'testuser',
  role: 'agent',
  name: '測試用戶',
  email: 'test@example.com',
  team_id: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

// Standard conversation / 標準對話
const mockConversation = {
  id: '1',
  customer_id: '1',
  platform: 'line' as const,
  status: 'pending' as const,
  assigned_agent_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  last_message_at: '2024-01-01T00:00:00Z'
}
```

### Assertion Patterns / 斷言模式
- **State Verification**: Check reactive state changes / 檢查響應式狀態變化
- **API Call Verification**: Verify correct API calls with parameters / 驗證正確的 API 調用和參數
- **Error State Testing**: Validate error handling and recovery / 驗證錯誤處理和恢復
- **Performance Benchmarks**: Measure execution time for operations / 測量操作執行時間

## Key Test Scenarios / 關鍵測試場景

### Authentication Workflows / 認證工作流程
1. **Successful Login**: Token storage, user data, API header setup / 成功登入：令牌存儲、用戶資料、API 標頭設置
2. **Login Failure**: Error handling, state cleanup / 登入失敗：錯誤處理、狀態清理
3. **Token Expiration**: Automatic logout, redirect to login / 令牌過期：自動登出、重定向到登入頁
4. **Logout Process**: State cleanup, localStorage clearing / 登出過程：狀態清理、本地存儲清除

### Conversation Management / 對話管理
1. **Data Fetching**: API calls, loading states, error handling / 資料獲取：API 調用、載入狀態、錯誤處理
2. **Filtering**: Status and platform-based filtering / 篩選：基於狀態和平台的篩選
3. **Message Operations**: Sending, receiving, state updates / 訊息操作：發送、接收、狀態更新
4. **Assignment**: Conversation assignment to agents / 指派：對話指派給客服

### Error Handling / 錯誤處理
1. **Network Errors**: Connection failures, timeouts / 網路錯誤：連接失敗、超時
2. **API Errors**: Server errors, validation failures / API 錯誤：伺服器錯誤、驗證失敗
3. **State Recovery**: Error clearing, retry mechanisms / 狀態恢復：錯誤清除、重試機制
4. **User Feedback**: Error message display / 用戶反饋：錯誤訊息顯示

## Performance Benchmarks / 性能基準

- **Single Operation**: < 50ms for basic operations / 單次操作：基本操作 < 50毫秒
- **Bulk Operations**: < 2000ms for 100 concurrent operations / 批量操作：100次並發操作 < 2000毫秒
- **Large Datasets**: Handle 10,000+ items efficiently / 大型資料集：高效處理 10,000+ 項目
- **Memory Usage**: Minimal memory leaks in repeated operations / 記憶體使用：重複操作中最小記憶體洩漏

## Edge Cases Covered / 涵蓋的邊界情況

### Data Integrity / 資料完整性
- Malformed API responses / 格式錯誤的 API 回應
- Null/undefined values / 空值/未定義值
- Type mismatches / 型別不匹配
- Circular references / 循環引用

### Concurrency / 並發性
- Simultaneous operations / 同時操作
- Race conditions / 競爭條件
- State consistency / 狀態一致性
- Resource conflicts / 資源衝突

### Browser Environment / 瀏覽器環境
- localStorage quota exceeded / localStorage 配額超出
- Network interruptions / 網路中斷
- Tab switching / 標籤切換
- Memory pressure / 記憶體壓力

## Integration Scenarios / 整合場景

### Cross-Store Communication / 跨狀態管理通信
- Auth state affecting conversation access / 認證狀態影響對話存取
- Error propagation between stores / 狀態管理間的錯誤傳播
- Shared loading states / 共享載入狀態

### Real-world Workflows / 真實世界工作流程
- Complete user session lifecycle / 完整用戶會話生命週期
- Multi-step operations with error recovery / 帶錯誤恢復的多步驟操作
- Role-based access control / 基於角色的存取控制

## Future Enhancements / 未來增強

- [ ] WebSocket integration testing / WebSocket 整合測試
- [ ] Offline mode testing / 離線模式測試
- [ ] Real-time updates testing / 即時更新測試
- [ ] Component integration testing / 元件整合測試
- [ ] E2E workflow testing / 端到端工作流程測試