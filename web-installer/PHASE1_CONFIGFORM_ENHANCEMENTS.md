# Phase 1: ConfigForm.vue 表單欄�?增強?��?

## ?? 概述

?��?檔�?�?`web-installer/frontend/src/views/ConfigForm.vue` ?�要添?��??�表?��?位。這�?欄�?對�? Phase 1 ?��??�置?��??�能??

## ??後端已�??��??�改

- ??`DeploymentConfig` 類�?已更??(backend/src/types/deployment.ts)
- ??`ConfigGenerator` 已�?�?(backend/src/services/ConfigGenerator.ts)
- ??`DeploymentOrchestrator` 已更??(backend/src/durable-objects/DeploymentOrchestrator.ts)
- ??Frontend types 已更??(frontend/src/types/index.ts)
- ??formData ?�?�已?�新 (frontend/src/views/ConfigForm.vue:344-365)
- ??handleSubmit ?�輯已更??(frontend/src/views/ConfigForm.vue:500-522)

## ?? ?�要添?��?表單欄�? (模板?��?)

### ?��? A: 完整實施 (?�薦)

??`ConfigForm.vue` 模板中添?�以下�?位�?

#### 1. Step 1: ?��??�置 - 添�? R2 Public URL 欄�?

**?�入位置**: ??`customDomain` 欄�?之�? (約第 108 行�?)

```vue
<!-- ?? Phase 1: R2 Custom Domain -->
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

#### 2. Step 2: LINE OA ?�置 - 添�? LINE Bot ID ??LIFF ID 欄�?

**?�入位置**: ?�現??LINE 欄�?之�? (約第 127 行�?)

```vue
<!-- ?? Phase 1: LINE Bot ID -->
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
    Required for QR Code generation. Find it in LINE Developers Console ??Channel Settings ??Basic settings
  </div>
</div>

<!-- ?? Phase 1: LINE LIFF ID -->
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
    Create a LIFF app in LINE Developers Console ??LIFF tab
  </div>
</div>
```

#### 3. ?�新 handleSkipLineChange ?�數

**位置**: Script ?��? (約第 398 �?

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

#### 4. ?�新 Step 1 驗�??�輯 (?�選但推??

**位置**: validateStep ?�數??(約第 414 �?

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

#### 5. ?�新 Step 2 驗�??�輯

**位置**: validateStep ?�數??(約第 447 �?

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

### ?��? B: ?�小�?實施 (快速�?�?

如�??�快?�測試�??��?添�? **?�?�鍵?�兩?��?�?*�?

1. **LINE Bot ID** (必�? - ?�於 QR Code)
2. **R2 Public URL** (?�選但�?�?

?��?欄�? (LINE LIFF ID, logLevel) ?�以使用默�??��?稍�?添�???

## ?�� 測試步�?

完�?添�?後�??��?以�?測試�?

```bash
# 1. 後端測試
cd web-installer/backend
npm install
npm test  # ?�該?��??�?�測�?

# 2. ?�端?�發
cd web-installer/frontend
npm install
npm run dev  # ?��??�發?��???

# 3. ?�覽?�測�?
# - 訪�? http://localhost:5173 (?�顯示�?端口)
# - 測試?�置表單�?
# - 填寫?�本信息
# - 測試 LINE Bot ID 驗�? (?��?: @xxxxxx)
# - 測試 R2 URL 驗�? (?��?: https://...)
# - 測試跳�? LINE ?�置?�能
# - 檢查?�?��?位是?�正確�?�?
```

## ?? 注�?事�?

1. **URL ?��??��?**: 如�??�戶?��?�?`customDomain`，`frontendUrl` ??`backendUrl` ?�以?��??��?，�?此這�?欄�??�以標�???"Optional (auto-generated)"

2. **LINE ?�置?�選??*: LINE Bot ID ??LIFF ID ?�該�?
   - 如�??�戶?�選 "Skip LINE configuration"，�?不�?�?
   - 如�??�戶要�?�?LINE，�? Bot ID 必填，LIFF ID ?�選

3. **字段?�示**: 每個�?位都?�該?��??��?幫助?�本，說?��?
   - 如�??��?該�?
   - ?��??��?示�?
   - ?�否?�可?��?�?

4. **?�誤?��?**: 確�??�?��?位都?�適?��??�誤?�示?��?�?

## ?�� 完�?標�?

Phase 1 ?�置?��??�能完�?後�??�該?��?�?

- ???��?完整??URL ?�置 (Backend, Frontend, R2)
- ???��? LINE Bot ID ??LIFF ID
- ???��??�含?�?�用?��?置�? wrangler.toml
- ???��?完整?��?端環境�??��?�?
- ??第�??�部署�?不�??��? `example.com`

## ?? ?��??�件

- Backend types: `web-installer/backend/src/types/deployment.ts`
- Frontend types: `web-installer/frontend/src/types/index.ts`
- Config Generator: `web-installer/backend/src/services/ConfigGenerator.ts`
- Deployment Orchestrator: `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts`
- Config Form: `web-installer/frontend/src/views/ConfigForm.vue`

---

**?�後更??*: 2026-01-05
**Phase**: Phase 1 - ?��??�置?��?
**?�??*: Backend 完�? ??| Frontend 待�???(?��?模板?�新)
