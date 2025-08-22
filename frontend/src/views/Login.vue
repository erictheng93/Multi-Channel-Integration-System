<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo Section -->
      <div class="logo-section">
        <div class="logo-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h1 class="logo-text">
          {{ t('login.title') }}
        </h1>
      </div>

      <!-- Login Form -->
      <div class="form-section">
        <div class="form-header">
          <h2>{{ t('login.subtitle') }}</h2>
          <p>請登入您的帳戶</p>
        </div>

        <form
          class="login-form"
          @submit.prevent="handleLogin"
          @keydown.enter.prevent="handleLoginFromEnter"
        >
          <div class="input-group">
            <input
              id="email"
              v-model="formData.email"
              type="email"
              class="form-input"
              :class="{ 'error': errors.email }"
              :placeholder="t('login.emailPlaceholder')"
              required
              :disabled="loading"
            >
            <div
              v-if="errors.email"
              class="error-message"
            >
              {{ errors.email }}
            </div>
          </div>

          <div class="input-group">
            <div class="password-wrapper">
              <input
                id="password"
                v-model="formData.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                :class="{ 'error': errors.password }"
                :placeholder="t('login.passwordPlaceholder')"
                required
                :disabled="loading"
              >
              <button
                type="button"
                class="password-toggle"
                :disabled="loading"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="!showPassword"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                </svg>
                <svg
                  v-else
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <line
                    x1="1"
                    y1="1"
                    x2="23"
                    y2="23"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                </svg>
              </button>
            </div>
            <div
              v-if="errors.password"
              class="error-message"
            >
              {{ errors.password }}
            </div>
          </div>

          <div class="form-options">
            <label class="remember-me">
              <input
                v-model="formData.rememberMe"
                type="checkbox"
                class="checkbox"
              >
              <span>記住我</span>
            </label>
          </div>

          <button
            type="button"
            class="submit-btn"
            :disabled="loading || !isValid"
            @click="handleLogin"
          >
            <span
              v-if="loading"
              class="loading-spinner"
            />
            <span v-else>{{ t('login.loginButton') }}</span>
          </button>

          <!-- Debug: Show error state -->
          <div style="background: #f0f0f0; padding: 8px; margin: 8px 0; font-size: 12px; border-radius: 4px;">
            <strong>DEBUG INFO:</strong><br>
            error value: {{ error }}<br>
            error type: {{ typeof error }}<br>
            error truthiness: {{ !!error }}<br>
            loading: {{ loading }}
          </div>

          <!-- Test Button -->
          <button 
            type="button" 
            style="background: orange; color: white; padding: 4px 8px; margin: 4px 0; border: none; border-radius: 4px; font-size: 12px;" 
            @click="testError"
          >
            Test Error Display
          </button>

          <div
            v-if="error"
            class="error-alert"
          >
            <div class="error-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <line
                  x1="15"
                  y1="9"
                  x2="9"
                  y2="15"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <line
                  x1="9"
                  y1="9"
                  x2="15"
                  y2="15"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="error-content">
              <div class="error-title">
                {{ t('login.loginFailed') }}
              </div>
              <div class="error-description">
                {{ getErrorMessage(error) }}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- 強制密碼更改模態框 -->
    <ForcedPasswordChange
      v-if="showForcedPasswordChange"
      :temp-token="forcedPasswordChangeData.tempToken"
      :agent="forcedPasswordChangeData.agent"
      @success="onPasswordChangeSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/composables/useI18n'
import { useModernForm } from '@/composables/useModernVue'
import ForcedPasswordChange from '@/components/auth/ForcedPasswordChange.vue'

// Local WindowWithDebug interface
interface WindowWithDebug extends Window {
  _loginFailureTimestamp?: number
  _blockNavigation?: boolean
  _loginInProgress?: boolean
}

const { login, loading, error, clearError } = useAuth()
const { t } = useI18n()
const router = useRouter()

const { formData, errors, isValid, setValidator, validateForm } = useModernForm({
  email: '',
  password: '',
  rememberMe: false
})

const showPassword = ref(false)
const showForcedPasswordChange = ref(false)
const forcedPasswordChangeData = reactive({
  tempToken: '',
  agent: {
    id: '',
    email: '',
    name: '',
    role: 'agent' as 'admin' | 'team' | 'agent'
  }
})

// 🔍 SUPER ULTRA DEBUG: 監控所有可能影響頁面的狀態變化
watch(error, (newError, oldError) => {
  console.log('🎬 SUPER ULTRA DEBUG: Error state change:')
  console.log('  - oldError:', oldError)
  console.log('  - newError:', newError)
  console.log('  - Should show error alert:', !!newError)
  console.log('  - Current URL:', window.location.href)
  console.log('  - Current router path:', router.currentRoute.value.path)
  console.log('  - Timestamp:', Date.now())
  console.log('  - Stack trace:', new Error().stack)
  
  // 如果錯誤狀態從有變無，這可能導致不當導航
  if (oldError && !newError) {
    console.log('⚠️ CRITICAL: Error state cleared! This might trigger navigation!')
  }
}, { immediate: true })

// 監控 loading 狀態變化
watch(loading, (newLoading, oldLoading) => {
  console.log('⏳ SUPER ULTRA DEBUG: Loading state change:')
  console.log('  - oldLoading:', oldLoading)
  console.log('  - newLoading:', newLoading)
  console.log('  - Current URL:', window.location.href)
  console.log('  - Error state:', error.value)
  console.log('  - Timestamp:', Date.now())
}, { immediate: true })

// 🔧 認證狀態監控 - 當用戶已認證時自動導航到 dashboard
const authStore = useAuthStore()
watch(() => authStore.isAuthenticated, (newAuth, oldAuth) => {
  console.log('🔐 AUTH STATE CHANGE:', {
    from: oldAuth,
    to: newAuth,
    sessionStatus: authStore.sessionStatus,
    hasToken: !!authStore.token,
    hasCurrentAgent: !!authStore.currentAgent,
    currentPath: router.currentRoute.value.path
  });
  
  // 如果用戶已認證且在登入頁面，導航到 dashboard
  if (newAuth && router.currentRoute.value.path === '/login') {
    console.log('🔄 User authenticated, redirecting to dashboard');
    router.push('/dashboard').catch(err => {
      console.warn('Navigation failed, using window.location:', err);
      window.location.href = '/dashboard';
    });
  }
}, { immediate: true })

// 🔧 SIMPLIFIED: 簡化其他狀態監控
watch(() => authStore.currentAgent, (newAgent, oldAgent) => {
  console.log('👤 CURRENT AGENT CHANGE:', { 
    hasOld: !!oldAgent, 
    hasNew: !!newAgent,
    sessionStatus: authStore.sessionStatus
  });
}, { immediate: true })

watch(() => authStore.token, (newToken, oldToken) => {
  console.log('🎫 TOKEN CHANGE:', { 
    hasOld: !!oldToken, 
    hasNew: !!newToken,
    sessionStatus: authStore.sessionStatus
  });
}, { immediate: true })

// 🔍 SUPER ULTRA DEBUG: 監控所有可能的導航和狀態變化
onMounted(() => {
  console.log('🏁 Login.vue MOUNTED at:', window.location.href)
  
  // 🚨 CRITICAL DEBUG: 凍結所有可能的導航機制用於診斷
  const originalPush = router.push
  const originalReplace = router.replace
  const originalGo = router.go
  const originalBack = router.back
  const originalForward = router.forward
  
  // 攔截所有 router 方法
  router.push = (...args) => {
    console.log('🚨 INTERCEPTED: router.push called with:', args)
    console.log('  - Call stack:', new Error().stack)
    console.log('  - Current error state:', error.value)
    console.log('  - Current loading state:', loading.value)
    console.log('  - Navigation blocking:', !!(window as WindowWithDebug)._blockNavigation)
    console.log('  - Timestamp:', Date.now())
    
    // 移除阻止導航的條件 - 允許正常導航
    console.log('✅ Navigation allowed, proceeding...')
    
    return originalPush.apply(router, args)
  }
  
  router.replace = (...args) => {
    console.log('🚨 INTERCEPTED: router.replace called with:', args)
    console.log('  - Call stack:', new Error().stack)
    console.log('  - Current error state:', error.value)
    console.log('  - Navigation blocking:', !!(window as WindowWithDebug)._blockNavigation)
    console.log('  - Timestamp:', Date.now())
    
    // 移除阻止導航的條件 - 允許正常導航
    console.log('✅ Replace navigation allowed, proceeding...')
    
    return originalReplace.apply(router, args)
  }
  
  // 攔截 window.location 變更
  let originalLocation = window.location.href
  const locationWatcher = setInterval(() => {
    if (window.location.href !== originalLocation) {
      console.log('🚨 LOCATION CHANGE DETECTED!')
      console.log('  - Old:', originalLocation)
      console.log('  - New:', window.location.href)
      console.log('  - Error state:', error.value)
      console.log('  - Loading state:', loading.value)
      console.log('  - IsAuthenticated:', authStore.isAuthenticated)
      console.log('  - Call stack:', new Error().stack)
      console.log('  - Timestamp:', Date.now())
      originalLocation = window.location.href
    }
  }, 50) // 更頻繁檢查
  
  // 🚨 CRITICAL: 監控頁面刷新或重載嘗試 (window.location.reload 是只讀的，無法覆蓋)
  // 改用事件監聽器來監控刷新嘗試
  const handleBeforeUnload = (event: BeforeUnloadEvent): string | undefined => {
    console.log('🚨 BEFORE UNLOAD DETECTED!')
    console.log('  - Event:', event)
    console.log('  - Current URL:', window.location.href)
    console.log('  - Error state:', error.value)
    console.log('  - Loading state:', loading.value)
    console.log('  - Call stack:', new Error().stack)
    console.log('  - Timestamp:', Date.now())
    
    if (error.value) {
      console.log('🛑 PREVENTING page unload due to error state!')
      event.preventDefault()
      event.returnValue = '頁面仍在處理錯誤狀態，確定要離開嗎？'
      return '頁面仍在處理錯誤狀態，確定要離開嗎？'
    }
    
    return undefined
  }
  
  window.addEventListener('beforeunload', handleBeforeUnload)
  
  // 🚨 攔截 history API
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState
  
  history.pushState = (state, title, url) => {
    console.log('🚨 HISTORY.PUSHSTATE INTERCEPTED!')
    console.log('  - URL:', url)
    console.log('  - State:', state)
    console.log('  - Error state:', error.value)
    console.log('  - Call stack:', new Error().stack)
    
    if (error.value && url && url.toString().includes('dashboard')) {
      console.log('🛑 BLOCKING history.pushState to dashboard due to error state!')
      return
    }
    
    return originalPushState.call(history, state, title, url)
  }
  
  history.replaceState = (state, title, url) => {
    console.log('🚨 HISTORY.REPLACESTATE INTERCEPTED!')
    console.log('  - URL:', url)
    console.log('  - State:', state)
    console.log('  - Error state:', error.value)
    console.log('  - Call stack:', new Error().stack)
    
    if (error.value && url && url.toString().includes('dashboard')) {
      console.log('🛑 BLOCKING history.replaceState to dashboard due to error state!')
      return
    }
    
    return originalReplaceState.call(history, state, title, url)
  }
  
  // 監控所有可能的導航事件
  
  const handleUnload = (event: Event) => {
    console.log('🚪 SUPER ULTRA DEBUG: Page is unloading!')
    console.log('  - Event:', event)
    console.log('  - Current URL:', window.location.href)
  }
  
  const handlePopState = (event: PopStateEvent) => {
    console.log('🔙 SUPER ULTRA DEBUG: PopState event!')
    console.log('  - Event:', event)
    console.log('  - State:', event.state)
    console.log('  - Current URL:', window.location.href)
    console.log('  - Error state:', error.value)
  }
  
  const handleHashChange = (event: HashChangeEvent) => {
    console.log('# SUPER ULTRA DEBUG: Hash change event!')
    console.log('  - Old URL:', event.oldURL)
    console.log('  - New URL:', event.newURL)
    console.log('  - Error state:', error.value)
  }
  
  // 監控 visibilitychange (頁面可見性變化)
  const handleVisibilityChange = () => {
    console.log('👁️ SUPER ULTRA DEBUG: Visibility change!')
    console.log('  - Hidden:', document.hidden)
    console.log('  - Visibility state:', document.visibilityState)
    console.log('  - Error state:', error.value)
  }
  
  // 監控 focus/blur 事件
  const handleWindowBlur = () => {
    console.log('😵 SUPER ULTRA DEBUG: Window lost focus!')
    console.log('  - Error state:', error.value)
    console.log('  - Current URL:', window.location.href)
  }
  
  const handleWindowFocus = () => {
    console.log('👀 SUPER ULTRA DEBUG: Window gained focus!')
    console.log('  - Error state:', error.value)
    console.log('  - Current URL:', window.location.href)
  }
  
  window.addEventListener('unload', handleUnload)
  window.addEventListener('popstate', handlePopState)
  window.addEventListener('hashchange', handleHashChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('focus', handleWindowFocus)
  
  // 🚨 CRITICAL: 攔截所有異步操作
  const originalSetTimeout = window.setTimeout
  const originalSetInterval = window.setInterval
  const originalRequestAnimationFrame = window.requestAnimationFrame
  
  window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    console.log('⏰ INTERCEPTED: setTimeout called with delay:', delay)
    console.log('  - Call stack:', new Error().stack)
    const wrappedCallback = (...cbArgs: unknown[]) => {
      console.log('⏰ setTimeout callback executing, delay was:', delay)
      console.log('  - Error state:', error.value)
      console.log('  - URL before callback:', window.location.href)
      const result = typeof callback === 'function' ? callback(...cbArgs) : callback
      console.log('  - URL after callback:', window.location.href)
      return result
    }
    return originalSetTimeout(wrappedCallback, delay, ...args)
  }) as typeof setTimeout
  
  window.requestAnimationFrame = (callback) => {
    console.log('🎨 INTERCEPTED: requestAnimationFrame called')
    const wrappedCallback = (timestamp: number) => {
      console.log('🎨 RAF callback executing')
      console.log('  - Error state:', error.value)
      console.log('  - URL:', window.location.href)
      return callback(timestamp)
    }
    return originalRequestAnimationFrame(wrappedCallback)
  }
  
  // 移除有問題的 Promise.resolve 攔截器 - 它會干擾 Vue Router
  
  // 清理函數
  onBeforeUnmount(() => {
    console.log('🧹 Login.vue UNMOUNTING - SUPER ULTRA DEBUG')
    
    // 恢復原始方法
    router.push = originalPush
    router.replace = originalReplace
    router.go = originalGo
    router.back = originalBack
    router.forward = originalForward
    
    // 恢復異步方法
    window.setTimeout = originalSetTimeout
    window.setInterval = originalSetInterval
    window.requestAnimationFrame = originalRequestAnimationFrame
    // Promise.resolve 不再需要恢復，因為沒有被攔截
    
    // 恢復 history 方法
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    
    clearInterval(locationWatcher)
    
    // 移除事件監聽器
    window.removeEventListener('beforeunload', handleBeforeUnload)
    window.removeEventListener('unload', handleUnload)
    window.removeEventListener('popstate', handlePopState)
    window.removeEventListener('hashchange', handleHashChange)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('blur', handleWindowBlur)
    window.removeEventListener('focus', handleWindowFocus)
  })
})

// 監控路由變化
watch(() => router.currentRoute.value.path, (newPath, oldPath) => {
  console.log('🛣️ ULTRA DEBUG: Route path changed!')
  console.log('  - Old path:', oldPath)
  console.log('  - New path:', newPath)
  console.log('  - Full route:', router.currentRoute.value)
}, { immediate: true })

setValidator('email', (value: string) => {
  if (!value.trim()) {
    return 'Email is required'
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return 'Please enter a valid email'
  }
  return null
})

setValidator('password', (value: string) => {
  if (!value.trim()) {
    return 'Password is required'
  }
  if (value.length < 6) {
    return 'Password must be at least 6 characters'
  }
  return null
})

// 錯誤訊息映射
const getErrorMessage = (errorMsg: string) => {
  const errorMap: Record<string, string> = {
    // 認證相關錯誤
    '登入失敗': '帳號或密碼錯誤，請檢查後重試',
    'Invalid credentials': '帳號或密碼錯誤，請檢查後重試',
    'Invalid email/username or password': '帳號或密碼錯誤，請檢查後重試',
    'Authentication failed': '認證失敗，請確認帳號密碼是否正確',
    'Login failed': '帳號或密碼錯誤，請檢查後重試',
    'Wrong password': '密碼錯誤，請重新輸入正確密碼',
    'Incorrect password': '密碼錯誤，請重新輸入正確密碼',
    
    // 用戶狀態相關錯誤
    'User not found': '找不到此帳號，請確認電子郵件地址是否正確',
    'Email not found': '找不到此電子郵件帳號，請確認地址是否正確',
    'Agent not found': '找不到此客服帳號，請聯繫管理員確認帳號狀態',
    'Invalid password': '密碼錯誤，請重新輸入',
    'Account locked': '帳號已被鎖定，請聯繫管理員解鎖',
    'Account disabled': '帳號已被停用，請聯繫管理員啟用',
    'Account inactive': '帳號未啟用，請聯繫管理員確認帳號狀態',
    'Account suspended': '帳號已被暫停，請聯繫管理員了解詳情',
    'Account pending': '帳號等待審核中，請聯繫管理員確認狀態',
    
    // 密碼相關錯誤
    'Password expired': '密碼已過期，請聯繫管理員重設密碼',
    'Password must be changed': '必須變更密碼才能登入，請聯繫管理員',
    'Weak password': '密碼強度不足，請使用更強的密碼',
    
    // 多次嘗試錯誤
    'Too many login attempts': '登入嘗試次數過多，請30分鐘後再試',
    'Too many attempts': '登入嘗試次數過多，請稍後再試',
    'Rate limit exceeded': '請求過於頻繁，請稍後再試',
    'Temporarily locked': '因多次錯誤嘗試，帳號暫時鎖定，請稍後再試',
    
    // 網路和伺服器錯誤
    '網路錯誤，請稍後再試': '網路連線異常，請檢查網路狀態後重試',
    'Network Error': '網路連線異常，請檢查網路狀態後重試',
    'Server error': '伺服器錯誤，請稍後再試或聯繫技術支援',
    'Service Unavailable': '服務暫時無法使用，請稍後再試',
    'Database error': '資料庫連線異常，請稍後再試',
    'Service timeout': '服務回應超時，請稍後再試',
    
    // 權限相關錯誤
    'Unauthorized': '未經授權的存取，請重新登入',
    'Forbidden': '權限不足，請聯繫管理員',
    'Access denied': '存取被拒絕，請確認帳號權限',
    'Insufficient privileges': '權限不足，無法存取此系統',
    
    // JWT 相關錯誤
    'Token expired': 'Session 已過期，請重新登入',
    'Invalid token': '認證資訊無效，請重新登入',
    'Token malformed': '認證格式錯誤，請重新登入',
    
    // 網路連接問題
    '網路連接錯誤，請檢查您的網路連接': '網路連線異常，請檢查網路狀態後重試',
    'Failed to fetch': '無法連接到伺服器，請檢查網路狀態',
    'Connection timeout': '連線超時，請檢查網路連線後重試',
    'Connection refused': '伺服器拒絕連線，請稍後再試',
    
    // 輸入驗證錯誤
    'Invalid email format': '電子郵件格式不正確，請輸入有效的電子郵件地址',
    'Email required': '請輸入電子郵件地址',
    'Password required': '請輸入密碼',
    'Invalid input': '輸入格式不正確，請檢查後重新輸入',
    
    // API 相關錯誤
    'Not Found': '請求的資源不存在，請稍後再試',
    'Bad Request': '請求格式錯誤，請重新嘗試',
    'Internal Server Error': '伺服器內部錯誤，請稍後再試',
    'Gateway Timeout': '網關超時，請稍後再試',
    'Bad Gateway': '網關錯誤，請稍後再試',
    
    // 維護相關錯誤
    'System maintenance': '系統維護中，請稍後再試',
    'Feature disabled': '此功能暫時停用，請聯繫管理員',
    'Upgrade required': '系統需要升級，請聯繫管理員'
  }

  // 提供更詳細的錯誤資訊
  const detailedErrorMsg = errorMap[errorMsg] || errorMsg
  
  // 如果是未知錯誤，提供基本的故障排除建議
  if (!errorMap[errorMsg] && errorMsg) {
    return `登入失敗：${errorMsg}\n\n請嘗試以下方法：\n• 檢查帳號密碼是否正確\n• 確認網路連線正常\n• 聯繫管理員確認帳號狀態`
  }
  
  return detailedErrorMsg || '登入過程中發生未知錯誤，請檢查帳號密碼後重試'
}

// Test function to manually set an error
const testError = () => {
  console.log('🧪 Testing error display...')
  // Try to directly set error in authStore
  const authStore = useAuthStore()
  authStore.error = 'Test Error Message'
  console.log('🧪 Set authStore.error to:', authStore.error)
  console.log('🧪 useAuth error value:', error.value)
}

// ULTRA DEBUG: Handle Enter key separately
const handleLoginFromEnter = (event: KeyboardEvent) => {
  console.log('⌨️ ULTRA DEBUG: Enter key pressed in form')
  console.log('  - Event:', event)
  console.log('  - Target:', event.target)
  event.preventDefault()
  event.stopPropagation()
  console.log('  - Prevented default for Enter key')
  
  // Call handleLogin without event parameter
  handleLogin()
}

// 處理強制密碼更改成功
const onPasswordChangeSuccess = () => {
  showForcedPasswordChange.value = false
  // 不需要額外處理，ForcedPasswordChange組件會自動處理重新登入
}

const handleLogin = async (event?: Event) => {
  const timestamp = Date.now()
  console.log(`🔐 SUPER ULTRA DEBUG: handleLogin called at ${timestamp}`)
  console.log('  - Form data:', formData.value)
  console.log('  - Current URL before login:', window.location.href)
  console.log('  - Current route before login:', router.currentRoute.value.path)
  console.log('  - Event object:', event)
  console.log('  - Call stack:', new Error().stack)
  
  // 🚨 CRITICAL DEBUG: 檢查是否有多重調用
  if ((window as WindowWithDebug)._loginInProgress) {
    console.log('🛑 SUPER ULTRA DEBUG: Login already in progress! Blocking duplicate call.')
    return
  }
  (window as WindowWithDebug)._loginInProgress = true
  
  // 確保阻止表單默認提交行為
  if (event) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    console.log('⚠️ SUPER ULTRA DEBUG: Prevented ALL default form behaviors')
    console.log('  - Event type:', event.type)
    console.log('  - Event target:', event.target)
    console.log('  - Event currentTarget:', event.currentTarget)
    console.log('  - Event bubbles:', event.bubbles)
    console.log('  - Event cancelable:', event.cancelable)
  }
  
  // 🚨 檢查是否有任何表單自動提交
  const forms = document.querySelectorAll('form')
  console.log('📋 SUPER ULTRA DEBUG: Found forms on page:', forms.length)
  forms.forEach((form, index) => {
    console.log(`  - Form ${index}:`, form)
    console.log(`    - Action:`, form.action)
    console.log(`    - Method:`, form.method)
    console.log(`    - Target:`, form.target)
  })

  // 防止重複提交
  if (loading.value) {
    console.log('⚠️ ULTRA DEBUG: Login already in progress, ignoring')
    return
  }

  console.log('🔒 ULTRA DEBUG: Setting up login process...')
  console.log('  - Current error state:', error.value)
  console.log('  - Current loading state:', loading.value)

  if (!validateForm()) {
    console.log('❌ ULTRA DEBUG: Form validation failed:', errors.value)
    return
  }

  try {
    console.log('✅ ULTRA DEBUG: Form validation passed, starting login...')
    console.log('🧹 ULTRA DEBUG: Clearing error before login...')
    clearError()
    console.log('📊 ULTRA DEBUG: Error state after clearError:', error.value)
    console.log('📍 ULTRA DEBUG: URL check point 1:', window.location.href)

    console.log('🚀 ULTRA DEBUG: About to call login API...')
    console.log('  - Email:', formData.value.email.trim())
    console.log('  - Password length:', formData.value.password.trim().length)
    
    const result = await login({
      email: formData.value.email.trim(),
      password: formData.value.password.trim()
    })

    console.log('📊 ULTRA DEBUG: Login API completed with result:', result)
    console.log('📊 ULTRA DEBUG: Error state after API call:', error.value)
    console.log('📊 ULTRA DEBUG: Loading state after API call:', loading.value)
    console.log('📍 ULTRA DEBUG: URL check point 2:', window.location.href)
    console.log('🛣️ ULTRA DEBUG: Route check point 2:', router.currentRoute.value.path)

    if (result.success) {
      console.log('✅ ULTRA DEBUG: Login SUCCESS branch')
      if (formData.value.rememberMe) {
        localStorage.setItem('rememberMe', 'true')
      }
      console.log('🚀 ULTRA DEBUG: Login successful, preparing to redirect...')
      console.log('  - Current location before redirect:', window.location.pathname)
      console.log('📍 ULTRA DEBUG: URL check point 3 (success):', window.location.href)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('🚀 ULTRA DEBUG: About to redirect to dashboard...')
      // 確保清除任何錯誤狀態，避免影響導航
      clearError()
      console.log('🧹 ULTRA DEBUG: Cleared error state before navigation, error is now:', error.value)
      
      await router.push('/dashboard')
      console.log('✅ ULTRA DEBUG: Router.push completed')
    } else if (result.mustChangePassword && result.tempToken && result.agent) {
      console.log('🔐 ULTRA DEBUG: Password change required branch')
      forcedPasswordChangeData.tempToken = result.tempToken
      forcedPasswordChangeData.agent = result.agent
      showForcedPasswordChange.value = true
      console.log('📍 ULTRA DEBUG: URL check point 3 (password change):', window.location.href)
    } else {
      // ❌ 登入失敗處理
      console.log('❌ ULTRA DEBUG: Login FAILED branch - CRITICAL SECTION')
      console.log('  - Result object:', result)
      console.log('  - Error state before processing:', error.value)
      console.log('  - Current URL:', window.location.href)
      console.log('  - Current route:', router.currentRoute.value.path)
      
      console.log('⏱️ ULTRA DEBUG: Waiting for error state to update...')
      await new Promise(resolve => setTimeout(resolve, 50))
      
      console.log('📊 ULTRA DEBUG: After wait - error state:', error.value)
      console.log('📊 ULTRA DEBUG: Should show error alert:', !!error.value)
      
      // 確保錯誤訊息顯示
      if (!error.value) {
        console.warn('⚠️ ULTRA DEBUG: No error message found, setting fallback')
        const authStore = useAuthStore()
        authStore.error = '登入失敗，請檢查帳號密碼'
        console.log('📊 ULTRA DEBUG: Fallback error set to:', authStore.error)
        
        // 再等一下讓響應式更新
        await new Promise(resolve => setTimeout(resolve, 10))
        console.log('📊 ULTRA DEBUG: Final error check:', error.value)
      }
      
      console.log('📍 ULTRA DEBUG: URL check point 3 (failure):', window.location.href)
      console.log('🛣️ ULTRA DEBUG: Route check point 3 (failure):', router.currentRoute.value.path)
      console.log('🏁 ULTRA DEBUG: Login failure processing completed - should stay on login page')
      
      // 🚨 CRITICAL TIMING WINDOW: 監控登入失敗後的關鍵時間窗口
      ;(window as WindowWithDebug)._loginFailureTimestamp = Date.now()
      console.log('🕐 CRITICAL WINDOW STARTED: Monitoring post-failure period')
      
      // 密集監控接下來 5 秒的所有變化
      const criticalMonitorInterval = setInterval(() => {
        const now = Date.now()
        const elapsed = now - ((window as WindowWithDebug)._loginFailureTimestamp || 0)
        
        if (elapsed > 5000) {
          clearInterval(criticalMonitorInterval)
          console.log('🕐 CRITICAL WINDOW ENDED: 5 second monitoring complete')
          return
        }
        
        console.log(`🕐 CRITICAL MONITOR [${elapsed}ms]: URL=${window.location.href}, Route=${router.currentRoute.value.path}, Error=${!!error.value}`)
      }, 50)
    }
  } catch (err) {
    console.error('💥 ULTRA DEBUG: handleLogin caught error:', err)
    console.log('📍 ULTRA DEBUG: URL check point (error):', window.location.href)
    const authStore = useAuthStore()
    authStore.error = '登入過程中發生錯誤，請稍後再試'
    console.log('📊 ULTRA DEBUG: Error handler - set error to:', authStore.error)
  }
  
  console.log(`🏁 SUPER ULTRA DEBUG: handleLogin function completed at ${Date.now()}`)
  console.log('  - Final URL:', window.location.href)
  console.log('  - Final route:', router.currentRoute.value.path)
  console.log('  - Final error state:', error.value)
  console.log('  - Final loading state:', loading.value)
  
  // 🧹 釋放登入進行標誌
  ;(window as WindowWithDebug)._loginInProgress = false
  console.log('🔓 Login flag released')
  
  // 🚨 SUPER CRITICAL: 在函數結束後監控是否有任何意外的狀態變化
  setTimeout(() => {
    console.log('⏰ SUPER ULTRA DEBUG: Post-login state check (100ms later):')
    console.log('  - URL:', window.location.href)
    console.log('  - Route:', router.currentRoute.value.path)
    console.log('  - Error:', error.value)
    console.log('  - Loading:', loading.value)
    console.log('  - IsAuthenticated:', authStore.isAuthenticated)
  }, 100)
  
  setTimeout(() => {
    console.log('⏰ SUPER ULTRA DEBUG: Post-login state check (500ms later):')
    console.log('  - URL:', window.location.href)
    console.log('  - Route:', router.currentRoute.value.path)
    console.log('  - Error:', error.value)
    console.log('  - Loading:', loading.value)
    console.log('  - IsAuthenticated:', authStore.isAuthenticated)
  }, 500)
  
  setTimeout(() => {
    console.log('⏰ SUPER ULTRA DEBUG: Post-login state check (1000ms later):')
    console.log('  - URL:', window.location.href)
    console.log('  - Route:', router.currentRoute.value.path)
    console.log('  - Error:', error.value)
    console.log('  - Loading:', loading.value)
    console.log('  - IsAuthenticated:', authStore.isAuthenticated)
  }, 1000)
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.login-container {
  background: white;
  border-radius: 24px;
  padding: 3rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.6s ease-out;
}

.logo-section {
  text-align: center;
  margin-bottom: 2.5rem;
}

.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  color: white;
  margin-bottom: 1rem;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.form-section {
  width: 100%;
}

.form-header {
  text-align: center;
  margin-bottom: 2rem;
}

.form-header h2 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.form-header p {
  color: #6b7280;
  margin: 0;
  font-size: 0.875rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.input-group {
  position: relative;
}

.form-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.2s ease;
  background: #f9fafb;
  color: #111827;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  color: #6b7280;
}

.form-input.error {
  border-color: #ef4444;
  background: #fef2f2;
}

.form-input::placeholder {
  color: #9ca3af;
}

.password-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.password-toggle:hover {
  color: #6b7280;
  background: #f3f4f6;
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.form-options {
  display: flex;
  align-items: center;
  margin: -0.5rem 0 0.5rem 0;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

.error-alert {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  animation: shake 0.5s ease-in-out;
}

.error-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.error-content {
  flex: 1;
}

.error-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.error-description {
  font-size: 0.8125rem;
  opacity: 0.9;
  line-height: 1.4;
  white-space: pre-line;
  word-wrap: break-word;
}

@keyframes shake {

  0%,
  100% {
    transform: translateX(0);
  }

  25% {
    transform: translateX(-4px);
  }

  75% {
    transform: translateX(4px);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: 2rem;
    margin: 1rem;
    border-radius: 20px;
  }

  .form-header h2 {
    font-size: 1.5rem;
  }

  .logo-icon {
    width: 56px;
    height: 56px;
  }

  .logo-text {
    font-size: 1.25rem;
  }
}
</style>