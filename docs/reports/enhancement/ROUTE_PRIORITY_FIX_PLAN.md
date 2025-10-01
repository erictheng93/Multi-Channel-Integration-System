# 訊息模組路由優先級修復計劃

## 問題診斷

### 測試結果
- ✅ `/health` - 200 OK
- ✅ `/info` - 200 OK
- ❌ `/` POST (create) - 404
- ❌ `/search` GET - 404
- ❌ `/stats` GET - 404
- ❌ `/tags` GET - 404
- ❌ `/export` GET - 404
- ✅ `/:id` GET - 404 (正確，資源不存在)
- ✅ 其他動態路由 - 正常工作

### 根本原因
**路由優先級衝突**: 動態路由 `/:id` (行189) 在靜態路由之前註冊，導致所有靜態路由被攔截。

**當前註冊順序**:
```
1. app.get('/health')       ← 靜態 ✅
2. app.get('/info')          ← 靜態 ✅
3. app.post('/')             ← 根路由 POST
4. app.get('/:id')           ← 動態 (攔截所有GET)
5. app.put('/:id')           ← 動態
6. app.delete('/:id')        ← 動態
7. app.get('/conversation/:conversationId')  ← 特定動態
8. app.get('/search')        ← 被 /:id 攔截 ❌
9. app.get('/stats')         ← 被 /:id 攔截 ❌
10. app.post('/bulk-create') ← POST 不受影響 ✅
11. app.post('/bulk-delete') ← POST 不受影響 ✅
12. app.get('/:id/attachments')     ← 更特定 ✅
13. app.post('/:id/attachments')    ← 更特定 ✅
14. app.post('/:id/forward')        ← 更特定 ✅
15. app.put('/:id/tags')            ← 更特定 ✅
16. app.get('/tags')         ← 被 /:id 攔截 ❌
17. app.get('/export')       ← 被 /:id 攔截 ❌
```

## 修復方案

### 正確的路由註冊順序

**原則**: 靜態路由 → 動態路由 → 通配符路由

**建議順序**:
```typescript
// 1. 健康檢查和資訊端點 (無認證)
app.get('/health', ...)
app.get('/info', ...)

// 2. 根路由 CRUD
app.post('/', jwtAuth, ...)           // 創建訊息

// 3. 靜態查詢端點 (必須在 /:id 之前)
app.get('/search', jwtAuth, ...)      // 搜索
app.get('/stats', jwtAuth, ...)       // 統計
app.get('/tags', jwtAuth, ...)        // 標籤列表
app.get('/export', jwtAuth, ...)      // 導出

// 4. 批量操作端點
app.post('/bulk-create', jwtAuth, ...)
app.post('/bulk-delete', jwtAuth, ...)

// 5. 特定對話端點
app.get('/conversation/:conversationId', jwtAuth, ...)

// 6. 動態ID端點 (放在最後)
app.get('/:id', jwtAuth, ...)         // 獲取訊息
app.put('/:id', jwtAuth, ...)         // 更新訊息
app.delete('/:id', jwtAuth, ...)      // 刪除訊息

// 7. 子資源端點 (ID的子路徑)
app.get('/:id/attachments', jwtAuth, ...)
app.post('/:id/attachments', jwtAuth, ...)
app.post('/:id/forward', jwtAuth, ...)
app.put('/:id/tags', jwtAuth, ...)
```

### 實施步驟

1. **備份當前文件**
   ```bash
   cp src/handlers/messaging-main.ts src/handlers/messaging-main.ts.backup
   ```

2. **重排路由**
   - 將行735-748 (`/search`) 移到行77之後
   - 將行801-846 (`/stats`) 移到 `/search` 之後
   - 將行1696-1748 (`/tags`) 移到 `/stats` 之後
   - 將行1756-1887 (`/export`) 移到 `/tags` 之後

3. **驗證修改**
   ```bash
   npm run lint:check
   npm run build
   ```

4. **測試**
   ```bash
   # 本地測試
   npm run dev
   curl http://localhost:8787/api/messages/search?q=test

   # 部署並測試
   npm run deploy
   npx tsx test-messaging-dual.ts <JWT_TOKEN>
   ```

### 預期結果

修復後，所有端點應該返回正確的狀態碼：
- ✅ POST `/` → 201 Created (或400 Bad Request，取決於數據)
- ✅ GET `/search` → 200 OK
- ✅ GET `/stats` → 200 OK
- ✅ GET `/tags` → 200 OK
- ✅ GET `/export` → 200 OK
- ✅ GET `/:id` → 200 OK 或 404 Not Found (取決於ID是否存在)

測試通過率應從 71% 提升到接近 100%（除了需要真實數據的端點）。

## 技術說明

### 為什麼會發生這個問題？

Hono (和大多數路由框架) 按**註冊順序**匹配路由：
1. 框架逐個檢查註冊的路由
2. 找到第一個匹配的路由就停止
3. `/:id` 會匹配任何路徑，包括 `/search`、`/stats` 等

### 正確的路由設計原則

1. **特定性遞減**: 最特定的路由在前
2. **靜態優先**: 靜態路由在動態路由之前
3. **避免歧義**: 確保路徑不會被錯誤攔截

### 常見錯誤模式

```typescript
// ❌ 錯誤 - 動態路由在前
app.get('/:id', handler)
app.get('/special', handler)  // 永遠不會被觸發

// ✅ 正確 - 靜態路由在前
app.get('/special', handler)
app.get('/:id', handler)
```

## 相關文件

- `src/handlers/messaging-main.ts` - 訊息處理器 (需要修改)
- `src/index.ts:186` - 路由註冊 (已正確)
- `test-messaging-dual.ts` - 測試腳本 (用於驗證)

## 檢查清單

- [ ] 備份原文件
- [ ] 重排路由順序
- [ ] 本地測試所有端點
- [ ] 部署到生產環境
- [ ] 執行完整測試套件
- [ ] 驗證所有端點返回正確狀態碼
- [ ] 更新文檔（如需要）

## 風險評估

**風險**: 低
- 只是改變路由註冊順序，不改變邏輯
- 所有端點代碼保持不變
- 可以快速回滾（使用備份文件）

**影響範圍**: 訊息模組的GET端點
- `/search`、`/stats`、`/tags`、`/export` 將開始正常工作
- 其他端點不受影響

**回滾計劃**:
```bash
cp src/handlers/messaging-main.ts.backup src/handlers/messaging-main.ts
npm run deploy
```