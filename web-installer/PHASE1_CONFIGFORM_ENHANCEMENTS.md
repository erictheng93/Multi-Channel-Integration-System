# Phase 1: ConfigForm.vue 表單欄位增強指南

## 📋 概述

本文檔提供 `web-installer/frontend/src/views/ConfigForm.vue` 需要添加的新表單欄位。這些欄位對應 Phase 1 核心配置收集功能。

## ✅ 後端已完成的更改

- ✅ `DeploymentConfig` 類型已更新 (backend/src/types/deployment.ts)
- ✅ `ConfigGenerator` 已增強 (backend/src/services/ConfigGenerator.ts)
- ✅ `DeploymentOrchestrator` 已更新 (backend/src/durable-objects/DeploymentOrchestrator.ts)
- ✅ Frontend types 已更新 (frontend/src/types/index.ts)
- ✅ formData 狀態已更新 (frontend/src/views/ConfigForm.vue:344-365)
- ✅ handleSubmit 邏輯已更新 (frontend/src/views/ConfigForm.vue:500-522)

## 📝 需要添加的表單欄位 (模板部分)

### 方案 A: 完整實施 (推薦)

在 `ConfigForm.vue` 模板中添加以下欄位：

#### 1. Step 1: 基礎配置 - 添加 R2 Public URL 欄位

**插入位置**: 在 `customDomain` 欄位之後 (約第 108 行後)

```vue
<!-- 🆕 Phase 1: R2 Custom Domain -->
<div class="form-group">
  <label for="r2PublicUrl" class="form-label">
    R2 Public URL (Optional)
    <span class="form-hint">Custom domain for file access</span>
  </label>
  <input
    id="r2PublicUrl"
    v-model="formData.r2PublicUrl"
    type="text"
    class="form-input"
    :class="{ error: errors.r2PublicUrl }"
    placeholder="https://files.yourdomain.com"
    @input="clearError('r2PublicUrl')"
  />
  <div v-if="errors.r2PublicUrl" class="form-error">
    {{ errors.r2PublicUrl }}
  </div>
  <div class="form-hint">
    Leave empty to use Cloudflare's default R2 public URL
  </div>
</div>
```

#### 2. Step 2: LINE OA 配置 - 添加 LINE Bot ID 和 LIFF ID 欄位

**插入位置**: 在現有 LINE 欄位之前 (約第 127 行前)

```vue
<!-- 🆕 Phase 1: LINE Bot ID -->
<div class="form-group">
  <label for="lineBotId" class="form-label">
    LINE Bot ID (Basic ID) {{ formData.enableLineIntegration ? '*' : '' }}
    <span class="form-hint">Format: @xxxxxxxxx</span>
  </label>
  <input
    id="lineBotId"
    v-model="formData.lineBotId"
    type="text"
    class="form-input"
    :class="{ error: errors.lineBotId }"
    placeholder="@110xsqef"
    pattern="^@[a-z0-9]+$"
    :required="formData.enableLineIntegration && !skipLineConfig"
    @input="clearError('lineBotId')"
  />
  <div v-if="errors.lineBotId" class="form-error">
    {{ errors.lineBotId }}
  </div>
  <div class="form-hint">
    Required for QR Code generation. Find it in LINE Developers Console → Channel Settings → Basic settings
  </div>
</div>

<!-- 🆕 Phase 1: LINE LIFF ID -->
<div class="form-group">
  <label for="lineLiffId" class="form-label">
    LINE LIFF ID (Optional)
    <span class="form-hint">Required for team binding feature</span>
  </label>
  <input
    id="lineLiffId"
    v-model="formData.lineLiffId"
    type="text"
    class="form-input"
    :class="{ error: errors.lineLiffId }"
    placeholder="2008756115-vWtFyDMA"
    @input="clearError('lineLiffId')"
  />
  <div v-if="errors.lineLiffId" class="form-error">
    {{ errors.lineLiffId }}
  </div>
  <div class="form-hint">
    Create a LIFF app in LINE Developers Console → LIFF tab
  </div>
</div>
```

#### 3. 更新 handleSkipLineChange 函數

**位置**: Script 部分 (約第 398 行)

```typescript
function handleSkipLineChange(): void {
  if (skipLineConfig.value) {
    formData.value.enableLineIntegration = false;
    formData.value.lineChannelAccessToken = '';
    formData.value.lineChannelSecret = '';
    // Phase 1: Clear new fields
    formData.value.lineBotId = '';
    formData.value.lineLiffId = '';
    clearError('lineChannelAccessToken');
    clearError('lineChannelSecret');
    clearError('lineBotId');
    clearError('lineLiffId');
  } else {
    formData.value.enableLineIntegration = true;
  }
}
```

#### 4. 更新 Step 1 驗證邏輯 (可選但推薦)

**位置**: validateStep 函數內 (約第 414 行)

```typescript
if (step === 0) {
  // ... existing validation ...

  // Phase 1: Validate R2 Public URL format if provided
  if (formData.value.r2PublicUrl) {
    const urlRegex = /^https?:\/\/.+/i;
    if (!urlRegex.test(formData.value.r2PublicUrl)) {
      errors.value.r2PublicUrl = 'Please enter a valid URL (must start with http:// or https://)';
      isValid = false;
    }
  }
}
```

#### 5. 更新 Step 2 驗證邏輯

**位置**: validateStep 函數內 (約第 447 行)

```typescript
if (step === 1 && !skipLineConfig.value) {
  // ... existing LINE validation ...

  // Phase 1: Validate LINE Bot ID
  if (!formData.value.lineBotId) {
    errors.value.lineBotId = 'LINE Bot ID is required';
    isValid = false;
  } else if (!/^@[a-z0-9]+$/.test(formData.value.lineBotId)) {
    errors.value.lineBotId = 'LINE Bot ID must start with @ and contain only lowercase letters and numbers';
    isValid = false;
  }

  // LIFF ID is optional, but validate format if provided
  if (formData.value.lineLiffId && formData.value.lineLiffId.length < 10) {
    errors.value.lineLiffId = 'LIFF ID format appears invalid';
    isValid = false;
  }
}
```

### 方案 B: 最小化實施 (快速驗證)

如果想快速測試，只需添加 **最關鍵的兩個欄位**：

1. **LINE Bot ID** (必需 - 用於 QR Code)
2. **R2 Public URL** (可選但重要)

其他欄位 (LINE LIFF ID, logLevel) 可以使用默認值或稍後添加。

## 🧪 測試步驟

完成添加後，執行以下測試：

```bash
# 1. 後端測試
cd web-installer/backend
npm install
npm test  # 應該通過所有測試

# 2. 前端開發
cd web-installer/frontend
npm install
npm run dev  # 啟動開發服務器

# 3. 瀏覽器測試
# - 訪問 http://localhost:5173 (或顯示的端口)
# - 測試配置表單：
#   - 填寫基本信息
#   - 測試 LINE Bot ID 驗證 (格式: @xxxxxx)
#   - 測試 R2 URL 驗證 (格式: https://...)
#   - 測試跳過 LINE 配置功能
#   - 檢查所有欄位是否正確提交
```

## 📌 注意事項

1. **URL 自動推導**: 如果用戶提供了 `customDomain`，`frontendUrl` 和 `backendUrl` 可以自動推導，因此這些欄位可以標記為 "Optional (auto-generated)"

2. **LINE 配置可選性**: LINE Bot ID 和 LIFF ID 應該：
   - 如果用戶勾選 "Skip LINE configuration"，則不驗證
   - 如果用戶要配置 LINE，則 Bot ID 必填，LIFF ID 可選

3. **字段提示**: 每個欄位都應該有清晰的幫助文本，說明：
   - 如何獲取該值
   - 值的格式示例
   - 是否為可選欄位

4. **錯誤處理**: 確保所有欄位都有適當的錯誤提示和驗證

## 🎯 完成標誌

Phase 1 配置收集功能完成後，應該能夠：

- ✅ 收集完整的 URL 配置 (Backend, Frontend, R2)
- ✅ 收集 LINE Bot ID 和 LIFF ID
- ✅ 生成包含所有用戶配置的 wrangler.toml
- ✅ 生成完整的前端環境變量文件
- ✅ 第三方部署後不會指向 `imfinethankyouandyou.com`

## 📖 相關文件

- Backend types: `web-installer/backend/src/types/deployment.ts`
- Frontend types: `web-installer/frontend/src/types/index.ts`
- Config Generator: `web-installer/backend/src/services/ConfigGenerator.ts`
- Deployment Orchestrator: `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts`
- Config Form: `web-installer/frontend/src/views/ConfigForm.vue`

---

**最後更新**: 2026-01-05
**Phase**: Phase 1 - 核心配置收集
**狀態**: Backend 完成 ✅ | Frontend 待完成 (僅需模板更新)
