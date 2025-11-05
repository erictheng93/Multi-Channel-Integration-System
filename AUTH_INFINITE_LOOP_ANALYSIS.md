# 🔍 Auth 無限刷新問題分析報告

## 問題描述
打開 `http://localhost:3000/login` 後，頁面不停地刷新，無法正常顯示登入頁面。

## 根本原因分析

### 1️⃣ **核心問題：路由守衛的認證檢查邏輯錯誤**

#### 當前路由守衛代碼 (`frontend/src/middleware/authGuard.ts:64-97`)

```typescript
export async function combinedAuthGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  // 檢查 token 是否存在
  const hasToken = !!authStore.token || !!localStorage.getItem('token')

  // 1. 如果不需要認證，直接通過
  if (!to.meta.requiresAuth) {
    next()  // ❌ 問題：沒有檢查 guestOnly
    return
  }

  // 2. 需要認證 - 檢查 token 是否存在
  if (!hasToken) {
    next('/login')
    return
  }

  // 3. 有 token，允許訪問
  next()
}
```

**問題點：**
- ❌ 只檢查 `hasToken`（token 是否存在），**沒有檢查 token 是否有效**
- ❌ 沒有檢查 `guestOnly` meta 屬性（登入頁設置了 `guestOnly: true`）
- ❌ 已登入用戶訪問 `/login` 時，守衛直接放行，沒有重定向到 dashboard

---

### 2️⃣ **次要問題：Auth Store 初始化時的 Token 有效性檢查**

#### Auth Store 初始化代碼 (`frontend/src/stores/auth.ts:72-97`)

```typescript
// Store 初始化時從 localStorage 恢復數據
if (typeof window !== 'undefined' && window.localStorage) {
  const storedToken = localStorage.getItem('token');
  const expiry = localStorage.getItem('sessionExpiry');

  // 檢查 session 是否有效
  const isSessionValid = expiry && Date.now() <= parseInt(expiry, 10);

  if (isSessionValid && storedToken) {
    token.value = storedToken;  // ✅ 恢復 token
    refreshToken.value = localStorage.getItem('refreshToken');
    sessionExpiry.value = parseInt(expiry || '0', 10);

    // 恢復 agent 數據
    const storedAgent = localStorage.getItem('currentAgent');
    if (storedAgent) {
      try {
        currentAgent.value = JSON.parse(storedAgent);
      } catch {
        clearAuthStorage();  // ⚠️  解析失敗時清除
      }
    }
  } else {
    clearAuthStorage();  // ⚠️  session 過期時清除
  }
}
```

**潛在問題：**
- ⚠️  只檢查 `sessionExpiry`（前端設置的 7 天過期時間）
- ⚠️  沒有檢查 JWT token 本身的 `exp` 字段（後端設置的過期時間）
- ⚠️  如果 JWT token 已過期但 sessionExpiry 還沒過期，會導致：
  - `token.value` 存在（從 localStorage 恢復）
  - `isAuthenticated` 為 false（因為 `validateSession()` → `isTokenValid()` 檢查 JWT exp 失敗）
  - 路由守衛檢查 `hasToken` 為 true，但實際上用戶未認證

---

### 3️⃣ **衝突問題：Login.vue 的 watch 與路由守衛衝突**

#### Login.vue 的 watch 代碼 (`frontend/src/views/Login.vue:313-321`)

```typescript
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && router.currentRoute.value.path === '/login') {
    router.push('/dashboard').catch(() => {
      window.location.href = '/dashboard';  // ❌ 強制刷新
    });
  }
}, { immediate: true })  // ❌ 組件掛載時立即執行
```

**問題點：**
- ❌ 使用 `immediate: true`，組件掛載時立即執行
- ❌ 如果 `isAuthenticated` 為 true，會嘗試導航到 dashboard
- ❌ 導航失敗時使用 `window.location.href` 強制刷新頁面

---

## 無限循環的完整流程

### 場景 1：JWT Token 已過期，但 sessionExpiry 未過期

```
1. 頁面加載
   └─> Auth Store 初始化
       ├─> 從 localStorage 恢復 token（JWT 已過期）
       ├─> 從 localStorage 恢復 sessionExpiry（7天，未過期）
       ├─> token.value = "expired-jwt-token" ✅
       └─> currentAgent.value = { ... } ✅

2. 計算 isAuthenticated
   └─> !!token.value ✅ (true)
   └─> validateSession() ❌ (false，因為 isTokenValid() 檢查 JWT exp 失敗)
   └─> !!currentAgent.value ✅ (true)
   └─> 結果: isAuthenticated = false

3. 用戶訪問 /login
   └─> combinedAuthGuard 執行
       ├─> hasToken = !!authStore.token || !!localStorage.getItem('token')
       │   └─> true (localStorage 中有 token)
       ├─> to.meta.requiresAuth = false
       └─> 直接放行 next() ✅

4. Login.vue 組件掛載
   └─> watch 執行 (immediate: true)
       ├─> isAuthenticated = false (JWT 已過期)
       └─> 條件不滿足，不觸發導航

5. 用戶無法登入（因為 token 已過期但還在 localStorage）
```

### 場景 2：已登入用戶（Token 有效）訪問 /login

```
1. 頁面加載
   └─> Auth Store 初始化
       ├─> 從 localStorage 恢復 token（有效）
       ├─> token.value = "valid-jwt-token" ✅
       └─> currentAgent.value = { ... } ✅

2. 計算 isAuthenticated
   └─> !!token.value ✅
   └─> validateSession() ✅ (token 有效)
   └─> !!currentAgent.value ✅
   └─> 結果: isAuthenticated = true ✅

3. 用戶訪問 /login
   └─> combinedAuthGuard 執行
       ├─> hasToken = true ✅
       ├─> to.meta.requiresAuth = false
       └─> 直接放行 next() ❌ (應該重定向到 dashboard)

4. Login.vue 組件掛載
   └─> watch 執行 (immediate: true)
       ├─> isAuthenticated = true ✅
       ├─> currentRoute.value.path === '/login' ✅
       └─> router.push('/dashboard') 🔄

5. 導航到 /dashboard
   └─> combinedAuthGuard 執行
       ├─> to.meta.requiresAuth = true
       ├─> hasToken = true ✅
       └─> next() ✅ (允許訪問)

6. Dashboard 組件掛載 ✅

⚠️  但如果 router.push 失敗：
   └─> catch 區塊執行
       └─> window.location.href = '/dashboard' 🔄 (強制刷新)
           └─> 整個頁面重新加載
               └─> 回到步驟 1... 無限循環！
```

---

## 解決方案

### 方案 1：修復路由守衛（推薦）✅

**修改 `frontend/src/middleware/authGuard.ts`**

```typescript
export async function combinedAuthGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  console.log('🛡️ Auth Guard:', to.path)

  // ✅ 使用 isAuthenticated 而不是 hasToken
  const isAuthenticated = authStore.isAuthenticated

  // 1. 處理 guestOnly 頁面（如登入頁）
  if (to.meta.guestOnly) {
    if (isAuthenticated) {
      // 已登入用戶訪問登入頁，重定向到 dashboard
      console.log('🔀 Already authenticated, redirecting to dashboard')
      next('/dashboard')
      return
    }
    // 未登入用戶，允許訪問登入頁
    console.log('✅ Guest page, allowing access')
    next()
    return
  }

  // 2. 處理需要認證的頁面
  if (to.meta.requiresAuth) {
    if (!isAuthenticated) {
      // 未認證，重定向到登入頁
      console.log('🔒 Not authenticated, redirecting to login')
      next('/login')
      return
    }
    // 已認證，允許訪問
    console.log('✅ Authenticated, allowing access')
    next()
    return
  }

  // 3. 其他頁面，直接通過
  console.log('✅ Public page, allowing access')
  next()
}
```

**關鍵改進：**
- ✅ 使用 `authStore.isAuthenticated` 而不是 `hasToken`
- ✅ 添加 `guestOnly` 檢查，已登入用戶訪問登入頁時重定向
- ✅ 完整的三種情況處理（guestOnly、requiresAuth、public）

---

### 方案 2：修復 Auth Store 初始化（可選）⚠️

**修改 `frontend/src/stores/auth.ts:72-97`**

```typescript
// Store 初始化時從 localStorage 恢復數據
if (typeof window !== 'undefined' && window.localStorage) {
  const storedToken = localStorage.getItem('token');
  const expiry = localStorage.getItem('sessionExpiry');

  // 檢查 session 是否有效
  const isSessionValid = expiry && Date.now() <= parseInt(expiry, 10);

  if (isSessionValid && storedToken) {
    // ✅ 先驗證 JWT token 是否有效
    let isJwtValid = false;
    try {
      const parts = storedToken.split('.');
      if (parts.length === 3 && parts[1]) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp) {
          const currentTime = Math.floor(Date.now() / 1000);
          isJwtValid = payload.exp > currentTime;
        } else {
          isJwtValid = true; // 沒有 exp 字段，假設有效
        }
      }
    } catch (e) {
      isJwtValid = false;
    }

    // ✅ 只有 JWT 有效時才恢復 token
    if (isJwtValid) {
      token.value = storedToken;
      refreshToken.value = localStorage.getItem('refreshToken');
      sessionExpiry.value = parseInt(expiry || '0', 10);

      const storedAgent = localStorage.getItem('currentAgent');
      if (storedAgent) {
        try {
          currentAgent.value = JSON.parse(storedAgent);
        } catch {
          clearAuthStorage();
        }
      }
    } else {
      // JWT 已過期，清除所有數據
      console.warn('[Auth] JWT token expired, clearing storage');
      clearAuthStorage();
    }
  } else {
    clearAuthStorage();
  }
}
```

**改進：**
- ✅ 初始化時檢查 JWT token 的 exp 字段
- ✅ JWT 過期時自動清除 localStorage
- ✅ 避免恢復無效的 token

---

### 方案 3：移除 Login.vue 的 watch（推薦）✅

**修改 `frontend/src/views/Login.vue:313-321`**

```typescript
// ✅ 移除整個 watch，讓路由守衛處理重定向
const authStore = useAuthStore()
```

**理由：**
- ✅ 路由守衛已經處理了已登入用戶訪問登入頁的重定向
- ✅ 避免組件內部的 watch 與路由守衛衝突
- ✅ 簡化代碼邏輯

---

## 推薦實施順序

1. **先修復路由守衛**（方案 1）- 必須 ✅
2. **移除 Login.vue 的 watch**（方案 3）- 推薦 ✅
3. **優化 Auth Store 初始化**（方案 2）- 可選 ⚠️

---

## 測試驗證步驟

修復後，請按以下步驟測試：

### 1. 清除瀏覽器數據
```javascript
// 在瀏覽器控制台執行
localStorage.clear();
location.reload();
```

### 2. 測試未登入狀態
- 訪問 `/login` → 應該顯示登入頁面 ✅
- 訪問 `/dashboard` → 應該重定向到 `/login` ✅

### 3. 測試登入流程
- 在登入頁輸入正確的帳號密碼
- 點擊登入按鈕
- 應該成功登入並導航到 `/dashboard` ✅

### 4. 測試已登入狀態
- 登入成功後，訪問 `/login` → 應該自動重定向到 `/dashboard` ✅
- 刷新頁面 → 應該保持在 dashboard，不會跳轉到登入頁 ✅

### 5. 測試 Token 過期
```javascript
// 在瀏覽器控制台執行（模擬過期 token）
const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxfQ.test';
localStorage.setItem('token', expiredToken);
localStorage.setItem('sessionExpiry', (Date.now() + 86400000).toString());
location.reload();
```
- 應該自動清除過期 token，導航到登入頁 ✅

---

## 診斷工具使用

已創建診斷腳本 `frontend/auth-diagnostic.js`，使用方法：

```bash
# 在瀏覽器控制台執行
fetch('/auth-diagnostic.js').then(r => r.text()).then(eval);
```

或者直接複製腳本內容到控制台執行。

診斷腳本會檢查：
- ✅ localStorage 中的數據
- ✅ Session expiry 是否過期
- ✅ JWT token 是否有效
- ✅ isAuthenticated 計算結果
- ✅ 問題分析和建議

---

## 結論

**您的推斷是正確的！** 🎯

問題的根本原因確實在於：
1. **路由守衛的認證檢查邏輯錯誤**（只檢查 hasToken，不檢查 isAuthenticated）
2. **Auth Store 可能恢復了過期的 token**（JWT exp 已過期但 sessionExpiry 未過期）
3. **Login.vue 的 watch 與路由守衛衝突**（重複處理重定向邏輯）

必須修復的是**路由守衛**，其他優化是可選的。
