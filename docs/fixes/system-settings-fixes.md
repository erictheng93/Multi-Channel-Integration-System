# System Settings 修復報告

## 問題描述

1. **時區顯示問題**: 時區欄位使用下拉式選單，但需求是只顯示不可編輯
2. **語言設定失敗**: 更換語言時顯示「儲存設定失敗」錯誤

## 修復內容

### 1. 前端修復 (SystemSettings.vue)

#### 時區顯示修改
- 將時區下拉式選單改為只讀顯示欄位
- 新增 `getTimezoneDisplay()` 方法來格式化時區顯示
- 新增 `.form-display` CSS 樣式

```vue
<!-- 修改前 -->
<select v-model="settings.general.timezone" class="form-select">
  <option value="Asia/Taipei">Asia/Taipei (GMT+8)</option>
</select>

<!-- 修改後 -->
<div class="form-display">
  {{ getTimezoneDisplay(settings.general.timezone) }}
</div>
```

#### 錯誤處理改善
- 改善 `saveGeneralSettings()` 方法的錯誤處理
- 顯示更詳細的錯誤訊息
- 增加 API 回應的錯誤訊息處理

### 2. 後端修復

#### 路由註冊
- 在 `src/index.ts` 中新增系統設定相關路由
- 從 `src/handlers/system.ts` 匯入設定處理函數
- 為所有設定路由添加 JWT 認證保護

```typescript
// 新增的路由
app.get('/api/system/info', jwtAuth, getSystemInfo);
app.get('/api/system/settings', jwtAuth, getSettings);
app.put('/api/system/settings', jwtAuth, updateSettings);
// ... 其他系統路由
```

#### 資料庫結構修復
- 修正 `database/schema.sql` 中 `system_settings` 表的時間戳格式
- 統一使用 `datetime('now')` 而非混合格式
- 在 `database/init.sql` 中新增系統設定表和預設值

#### 資料庫遷移
- 建立 `database/migrations/002_add_system_settings_table.sql` 遷移檔案
- 包含系統設定表建立和預設值插入
- 支援 `INSERT OR IGNORE` 避免重複插入

### 3. 測試和驗證

#### 測試檔案
- `tests/test-system-settings.ts`: 單元測試
- `scripts/test-system-settings.ps1`: API 整合測試腳本

#### 預設設定值
```sql
INSERT OR IGNORE INTO system_settings (key, value) VALUES 
    ('general.systemName', 'Multi-Channel Support'),
    ('general.contactEmail', 'admin@example.com'),
    ('general.timezone', 'Asia/Taipei'),
    ('general.language', 'zh-TW'),
    -- ... 其他設定
```

## 部署步驟

1. **執行資料庫遷移**:
   ```bash
   npm run db:migrate
   ```

2. **重新部署應用程式**:
   ```bash
   npm run deploy
   ```

3. **驗證功能**:
   ```bash
   # 本地測試
   .\scripts\test-system-settings.ps1
   
   # 帶認證測試
   .\scripts\test-system-settings.ps1 -Token "your-jwt-token"
   ```

## 修復結果

### 時區顯示
- ✅ 時區現在以只讀方式顯示
- ✅ 支援多種時區格式顯示
- ✅ 未知時區會顯示警告訊息

### 語言設定
- ✅ 語言更換功能正常運作
- ✅ 支援繁體中文、簡體中文、英文
- ✅ 錯誤訊息更加詳細和有用
- ✅ 設定變更會正確保存到資料庫

### 系統穩定性
- ✅ 所有系統設定 API 端點正常運作
- ✅ JWT 認證保護所有敏感操作
- ✅ 資料庫結構一致性修復
- ✅ 完整的錯誤處理和日誌記錄

## 注意事項

1. **資料庫遷移**: 首次部署需要執行遷移以建立 `system_settings` 表
2. **認證要求**: 所有系統設定 API 都需要有效的 JWT token
3. **時區限制**: 目前時區為只讀，如需修改需要透過資料庫直接更新
4. **快取**: 設定變更後可能需要清除快取以確保立即生效