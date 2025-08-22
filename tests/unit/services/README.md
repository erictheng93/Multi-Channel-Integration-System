# Services Unit Tests / 服務單元測試

This directory contains comprehensive unit tests for the service layer of the application.

## Test Structure / 測試結構

### Permission Service Tests / 權限服務測試

- **`permission.test.ts`**: Core permission checking functionality / 核心權限檢查功能
- **`permission-edge-cases.test.ts`**: Edge cases and error handling / 邊界情況和錯誤處理
- **`permission-performance.test.ts`**: Performance and scalability tests / 性能和可擴展性測試
- **`permission-integration.test.ts`**: Integration scenarios and workflows / 整合場景和工作流程

## Test Coverage / 測試覆蓋率

### Permission Service / 權限服務

#### Core Functionality / 核心功能
- ✅ Admin role permissions (wildcard access) / 管理員角色權限（萬用存取）
- ✅ Manager role permissions with team scope / 主管角色權限與團隊範圍
- ✅ Agent role permissions with assignment restrictions / 客服角色權限與指派限制
- ✅ Permission condition checking / 權限條件檢查
- ✅ Role-based access control / 基於角色的存取控制

#### Edge Cases / 邊界情況
- ✅ Invalid user handling / 無效用戶處理
- ✅ Invalid role handling / 無效角色處理
- ✅ Database connection failures / 資料庫連接失敗
- ✅ Malformed input handling / 格式錯誤輸入處理
- ✅ Missing context scenarios / 缺少上下文場景
- ✅ Complex condition combinations / 複雜條件組合

#### Performance / 性能
- ✅ Response time benchmarks / 回應時間基準
- ✅ Bulk permission checks / 批量權限檢查
- ✅ Memory usage optimization / 記憶體使用優化
- ✅ Database query optimization / 資料庫查詢優化
- ✅ Scalability testing / 可擴展性測試
- ✅ Concurrent access handling / 並發存取處理

#### Integration / 整合
- ✅ Real-world workflow scenarios / 真實世界工作流程場景
- ✅ Cross-team permission management / 跨團隊權限管理
- ✅ Role transition scenarios / 角色轉換場景
- ✅ Complex permission combinations / 複雜權限組合
- ✅ Multi-user concurrent operations / 多用戶並發操作

## Running Tests / 執行測試

### Individual Test Files / 個別測試檔案
```bash
# Core permission tests / 核心權限測試
npm run test:services:core

# Edge cases / 邊界情況
npm run test:services:edge

# Performance tests / 性能測試
npm run test:services:performance

# Integration tests / 整合測試
npm run test:services:integration
```

### All Service Tests / 所有服務測試
```bash
# Run all service tests with detailed reporting / 執行所有服務測試並提供詳細報告
npm run test:services

# Run with coverage / 執行並生成覆蓋率報告
npm run test:services:coverage

# Run in watch mode / 監視模式執行
npm run test:services:watch
```

## Test Patterns / 測試模式

### Mocking Strategy / 模擬策略
- Database calls are mocked using Vitest / 使用 Vitest 模擬資料庫調用
- User data is simulated with different roles and teams / 使用不同角色和團隊模擬用戶資料
- Error scenarios are simulated for robustness testing / 模擬錯誤場景進行健壯性測試

### Test Data / 測試資料
```typescript
// Standard test users / 標準測試用戶
const testUsers = {
  admin: { id: 1, role: 'admin', team_id: 1 },
  manager: { id: 2, role: 'manager', team_id: 1 },
  agent: { id: 3, role: 'agent', team_id: 1 }
};
```

### Assertion Patterns / 斷言模式
- Permission checks return boolean values / 權限檢查返回布林值
- Performance tests measure execution time / 性能測試測量執行時間
- Integration tests verify complete workflows / 整合測試驗證完整工作流程

## Key Test Scenarios / 關鍵測試場景

### Role-Based Permissions / 基於角色的權限
1. **Admin**: Full access to all resources / 對所有資源的完全存取
2. **Manager**: Team-scoped permissions / 團隊範圍權限
3. **Agent**: Assignment-based restrictions / 基於指派的限制

### Condition Checking / 條件檢查
- `teamScope`: User must be in the same team / 用戶必須在同一團隊
- `assigned`: Resource must be assigned to user / 資源必須指派給用戶
- `own`: User must own the resource / 用戶必須擁有資源
- `ownTeam`: User must manage their own team / 用戶必須管理自己的團隊

### Error Handling / 錯誤處理
- Database connection failures / 資料庫連接失敗
- Invalid user data / 無效用戶資料
- Malformed permissions / 格式錯誤的權限
- Network timeouts / 網路超時

## Performance Benchmarks / 性能基準

- Single permission check: < 50ms / 單次權限檢查：< 50毫秒
- 100 concurrent checks: < 1000ms / 100次並發檢查：< 1000毫秒
- Memory usage: < 10MB increase for 1000 operations / 記憶體使用：1000次操作增加 < 10MB

## Migration Status / 遷移狀態

✅ **COMPLETED**: Jest → Vitest migration  
✅ **COMPLETED**: All 77 tests migrated and passing  
✅ **COMPLETED**: Performance benchmarks implemented  
✅ **COMPLETED**: PowerShell test runner created  

## Future Enhancements / 未來增強

- [ ] Permission caching implementation / 權限快取實作
- [ ] Database integration tests / 資料庫整合測試
- [ ] Real-time permission updates / 即時權限更新
- [ ] Audit logging for permission checks / 權限檢查的審計日誌
- [ ] Permission inheritance testing / 權限繼承測試
- [ ] Coverage reporting setup / 覆蓋率報告設定