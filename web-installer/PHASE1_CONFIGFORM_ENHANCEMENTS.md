# Phase 1: ConfigForm.vue è¡¨å–®æ¬„ä?å¢å¼·?‡å?

## ?? æ¦‚è¿°

?¬æ?æª”æ?ä¾?`web-installer/frontend/src/views/ConfigForm.vue` ?€è¦æ·»? ç??°è¡¨?®æ?ä½ã€‚é€™ä?æ¬„ä?å°æ? Phase 1 ?¸å??ç½®?¶é??Ÿèƒ½??

## ??å¾Œç«¯å·²å??ç??´æ”¹

- ??`DeploymentConfig` é¡å?å·²æ›´??(backend/src/types/deployment.ts)
- ??`ConfigGenerator` å·²å?å¼?(backend/src/services/ConfigGenerator.ts)
- ??`DeploymentOrchestrator` å·²æ›´??(backend/src/durable-objects/DeploymentOrchestrator.ts)
- ??Frontend types å·²æ›´??(frontend/src/types/index.ts)
- ??formData ?€?‹å·²?´æ–° (frontend/src/views/ConfigForm.vue:344-365)
- ??handleSubmit ?è¼¯å·²æ›´??(frontend/src/views/ConfigForm.vue:500-522)

## ?? ?€è¦æ·»? ç?è¡¨å–®æ¬„ä? (æ¨¡æ¿?¨å?)

### ?¹æ? A: å®Œæ•´å¯¦æ–½ (?¨è–¦)

??`ConfigForm.vue` æ¨¡æ¿ä¸­æ·»? ä»¥ä¸‹æ?ä½ï?

#### 1. Step 1: ?ºç??ç½® - æ·»å? R2 Public URL æ¬„ä?

**?’å…¥ä½ç½®**: ??`customDomain` æ¬„ä?ä¹‹å? (ç´„ç¬¬ 108 è¡Œå?)

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

#### 2. Step 2: LINE OA ?ç½® - æ·»å? LINE Bot ID ??LIFF ID æ¬„ä?

**?’å…¥ä½ç½®**: ?¨ç¾??LINE æ¬„ä?ä¹‹å? (ç´„ç¬¬ 127 è¡Œå?)

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

#### 3. ?´æ–° handleSkipLineChange ?½æ•¸

**ä½ç½®**: Script ?¨å? (ç´„ç¬¬ 398 è¡?

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

#### 4. ?´æ–° Step 1 é©—è??è¼¯ (?¯é¸ä½†æ¨??

**ä½ç½®**: validateStep ?½æ•¸??(ç´„ç¬¬ 414 è¡?

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

#### 5. ?´æ–° Step 2 é©—è??è¼¯

**ä½ç½®**: validateStep ?½æ•¸??(ç´„ç¬¬ 447 è¡?

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

### ?¹æ? B: ?€å°å?å¯¦æ–½ (å¿«é€Ÿé?è­?

å¦‚æ??³å¿«?Ÿæ¸¬è©¦ï??ªé?æ·»å? **?€?œéµ?„å…©?‹æ?ä½?*ï¼?

1. **LINE Bot ID** (å¿…é? - ?¨æ–¼ QR Code)
2. **R2 Public URL** (?¯é¸ä½†é?è¦?

?¶ä?æ¬„ä? (LINE LIFF ID, logLevel) ?¯ä»¥ä½¿ç”¨é»˜è??¼æ?ç¨å?æ·»å???

## ?§ª æ¸¬è©¦æ­¥é?

å®Œæ?æ·»å?å¾Œï??·è?ä»¥ä?æ¸¬è©¦ï¼?

```bash
# 1. å¾Œç«¯æ¸¬è©¦
cd web-installer/backend
npm install
npm test  # ?‰è©²?šé??€?‰æ¸¬è©?

# 2. ?ç«¯?‹ç™¼
cd web-installer/frontend
npm install
npm run dev  # ?Ÿå??‹ç™¼?å???

# 3. ?è¦½?¨æ¸¬è©?
# - è¨ªå? http://localhost:5173 (?–é¡¯ç¤ºç?ç«¯å£)
# - æ¸¬è©¦?ç½®è¡¨å–®ï¼?
#   - å¡«å¯«?ºæœ¬ä¿¡æ¯
#   - æ¸¬è©¦ LINE Bot ID é©—è? (?¼å?: @xxxxxx)
#   - æ¸¬è©¦ R2 URL é©—è? (?¼å?: https://...)
#   - æ¸¬è©¦è·³é? LINE ?ç½®?Ÿèƒ½
#   - æª¢æŸ¥?€?‰æ?ä½æ˜¯?¦æ­£ç¢ºæ?äº?
```

## ?? æ³¨æ?äº‹é?

1. **URL ?ªå??¨å?**: å¦‚æ??¨æˆ¶?ä?äº?`customDomain`ï¼Œ`frontendUrl` ??`backendUrl` ?¯ä»¥?ªå??¨å?ï¼Œå?æ­¤é€™ä?æ¬„ä??¯ä»¥æ¨™è???"Optional (auto-generated)"

2. **LINE ?ç½®?¯é¸??*: LINE Bot ID ??LIFF ID ?‰è©²ï¼?
   - å¦‚æ??¨æˆ¶?¾é¸ "Skip LINE configuration"ï¼Œå?ä¸é?è­?
   - å¦‚æ??¨æˆ¶è¦é?ç½?LINEï¼Œå? Bot ID å¿…å¡«ï¼ŒLIFF ID ?¯é¸

3. **å­—æ®µ?ç¤º**: æ¯å€‹æ?ä½éƒ½?‰è©²?‰æ??°ç?å¹«åŠ©?‡æœ¬ï¼Œèªª?ï?
   - å¦‚ä??²å?è©²å€?
   - ?¼ç??¼å?ç¤ºä?
   - ?¯å¦?ºå¯?¸æ?ä½?

4. **?¯èª¤?•ç?**: ç¢ºä??€?‰æ?ä½éƒ½?‰é©?¶ç??¯èª¤?ç¤º?Œé?è­?

## ?¯ å®Œæ?æ¨™è?

Phase 1 ?ç½®?¶é??Ÿèƒ½å®Œæ?å¾Œï??‰è©²?½å?ï¼?

- ???¶é?å®Œæ•´??URL ?ç½® (Backend, Frontend, R2)
- ???¶é? LINE Bot ID ??LIFF ID
- ???Ÿæ??…å«?€?‰ç”¨?¶é?ç½®ç? wrangler.toml
- ???Ÿæ?å®Œæ•´?„å?ç«¯ç’°å¢ƒè??æ?ä»?
- ??ç¬¬ä??¹éƒ¨ç½²å?ä¸æ??‡å? `example.com`

## ?? ?¸é??‡ä»¶

- Backend types: `web-installer/backend/src/types/deployment.ts`
- Frontend types: `web-installer/frontend/src/types/index.ts`
- Config Generator: `web-installer/backend/src/services/ConfigGenerator.ts`
- Deployment Orchestrator: `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts`
- Config Form: `web-installer/frontend/src/views/ConfigForm.vue`

---

**?€å¾Œæ›´??*: 2026-01-05
**Phase**: Phase 1 - ?¸å??ç½®?¶é?
**?€??*: Backend å®Œæ? ??| Frontend å¾…å???(?…é?æ¨¡æ¿?´æ–°)
