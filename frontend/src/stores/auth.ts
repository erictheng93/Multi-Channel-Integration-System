// 專案名稱：Multi-Channel Support MVP  
// 檔案路徑：/frontend/src/stores/auth.ts
// Created by: Pinia Store Developer

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Agent, LoginRequest, LoginResponse } from '@/types';
import { authApi } from '@/api/auth';
import { useRouter } from 'vue-router';

// 會話時間常量 - 統一管理
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 分鐘

// 會話恢復狀態類型
type SessionStatus = 'pending' | 'authenticated' | 'unauthenticated' | 'restored';

export const useAuthStore = defineStore('auth', () => {
  // 狀態
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const currentAgent = ref<Agent | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sessionExpiry = ref<number | null>(null);
  // 🔧 新增：會話恢復狀態 - 解決競爭條件問題
  const sessionStatus = ref<SessionStatus>('pending');

  // Initialize tokens from localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedToken = localStorage.getItem('token');
    const storedRefreshToken = localStorage.getItem('refreshToken');
    const expiry = localStorage.getItem('sessionExpiry');
    
    token.value = storedToken || null;
    refreshToken.value = storedRefreshToken || null;
    sessionExpiry.value = expiry ? parseInt(expiry, 10) : null;
    
    // Check if session has expired
    if (sessionExpiry.value && Date.now() > sessionExpiry.value) {
      // Session expired, clear tokens but don't redirect yet
      token.value = null;
      refreshToken.value = null;
      sessionExpiry.value = null;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionExpiry');
    }
  }

  // 計算屬性
  const isAdmin = computed(() => currentAgent.value?.role === 'admin');
  const isTeam = computed(() => currentAgent.value?.role === 'team');
  const isAgent = computed(() => currentAgent.value?.role === 'agent');
  const isTeamOrAdmin = computed(() => 
    currentAgent.value?.role === 'admin' || currentAgent.value?.role === 'team'
  );

  // 方法
  async function login(credentials: LoginRequest) {
    console.log('🏪 authStore.login called with:', credentials);
    loading.value = true;
    error.value = null;

    try {
      console.log('📡 Calling authApi.login...');
      const response = await authApi.login(credentials);
      console.log('📨 API response:', response);
      if (response.success && response.data) {
        const loginData = response.data as LoginResponse;
        // 檢查是否需要強制更改密碼
        if (loginData.mustChangePassword) {
          console.log('🔐 Password must be changed before login');
          return {
            success: false,
            mustChangePassword: true,
            tempToken: loginData.tempToken,
            agent: loginData.agent
          };
        }
        
        console.log('✅ Login API successful, setting auth state...');
        token.value = loginData.token;
        refreshToken.value = loginData.refreshToken || null;
        currentAgent.value = loginData.agent;
        
        // Set session expiry
        const expiry = Date.now() + SESSION_DURATION;
        sessionExpiry.value = expiry;
        
        console.log('💾 Saving to localStorage...');
        // 儲存 tokens 和過期時間
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('token', loginData.token);
          if (loginData.refreshToken) {
            localStorage.setItem('refreshToken', loginData.refreshToken);
          }
          localStorage.setItem('sessionExpiry', expiry.toString());
        }
        
        // 設定預設 header
        authApi.setAuthHeader(loginData.token, loginData.refreshToken);
        
        console.log('🔐 Auth state after login:');
        console.log('- token:', !!token.value);
        console.log('- tokenValue:', token.value ? `${token.value.substring(0, 20)  }...` : null);
        console.log('- currentAgent:', currentAgent.value);
        console.log('- sessionExpiry:', sessionExpiry.value);
        console.log('- sessionExpiryDate:', sessionExpiry.value ? new Date(sessionExpiry.value).toLocaleString() : null);
        console.log('- validateSession():', validateSession());
        console.log('- isAuthenticated:', !!token.value && validateSession());
        
        // 記錄初始會話狀態
        logSessionStatus();
        
        // 🔧 設定會話狀態為已認證
        setSessionStatus('authenticated');
        
        return true;
      } else {
        // 使用 API 回傳的詳細錯誤訊息
        const apiError = response.error || '登入失敗';
        console.log('❌ Login API failed with error:', apiError);
        error.value = apiError;
        console.log('📊 Error value set to:', error.value);
        console.log('📊 Error ref value:', error.value);
        
        // 確保清理任何可能設置的認證狀態，但保留錯誤訊息
        token.value = null;
        refreshToken.value = null;
        currentAgent.value = null;
        sessionExpiry.value = null;
        
        // 🔧 ULTRA DEBUG FIX: 清理 localStorage 防止殘留的認證資料影響判斷
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('sessionExpiry');
        }
        
        // 🔧 設定會話狀態為未認證
        setSessionStatus('unauthenticated');
        
        return false;
      }
    } catch (err) {
      console.error('🚨 Login error caught:', err);
      
      // 確保清理任何可能設置的認證狀態
      token.value = null;
      refreshToken.value = null;
      currentAgent.value = null;
      sessionExpiry.value = null;
      
      // 🔧 ULTRA DEBUG FIX: 清理 localStorage 防止殘留的認證資料影響判斷
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('sessionExpiry');
      }
      
      // 提取更詳細的錯誤訊息
      if (err && typeof err === 'object' && 'message' in err) {
        error.value = (err as Error).message;
      } else if (typeof err === 'string') {
        error.value = err;
      } else {
        error.value = '網路錯誤，請稍後再試';
      }
      
      // 🔧 設定會話狀態為未認證
      setSessionStatus('unauthenticated');
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout(callAPI = true) {
    // Call logout API if requested
    if (callAPI && token.value) {
      try {
        await authApi.logout();
      } catch (err) {
        console.warn('Logout API call failed:', err);
      }
    }

    // Clear all auth state
    token.value = null;
    refreshToken.value = null;
    currentAgent.value = null;
    sessionExpiry.value = null;
    
    // Clear localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionExpiry');
    }
    
    // Remove auth headers
    authApi.removeAuthHeader();
    
    // 🔧 設定會話狀態為未認證
    setSessionStatus('unauthenticated');
    
    // Navigate to login (only if not already on login page)
    if (typeof window !== 'undefined') {
      try {
        const router = useRouter();
        const currentPath = router.currentRoute.value.path;
        if (currentPath !== '/login') {
          await router.push('/login');
        }
      } catch (err) {
        console.log('Router not available, using window.location');
        if (typeof window !== 'undefined' && window.location && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
  }

  async function fetchCurrentAgent() {
    if (!token.value) {return;}

    try {
      const response = await authApi.me();
      if (response.success && response.data) {
        currentAgent.value = response.data;
      } else if (response.status === 401) {
        // Token 確實已過期，清理認證狀態
        console.log('Token expired, clearing auth state');
        await logout(false); // 不調用 API，只清理本地狀態
      }
    } catch (err) {
      console.warn('fetchCurrentAgent failed:', err);
      // 網路錯誤等其他情況不應該強制登出
      // 只有確定是認證錯誤時才清理狀態
    }
  }

  // 驗證會話是否有效
  function validateSession(): boolean {
    if (import.meta.env.DEV) {
      console.log('🔍 validateSession called:', {
        hasToken: !!token.value,
        sessionExpiry: sessionExpiry.value,
        now: Date.now(),
        isValid: sessionExpiry.value ? Date.now() < sessionExpiry.value : 'no expiry set'
      });
    }
    
    if (!token.value) {
      if (import.meta.env.DEV) {
        console.log('❌ validateSession: no token');
      }
      return false;
    }
    // 如果沒有設置過期時間，假設 token 仍然有效
    if (!sessionExpiry.value) {
      if (import.meta.env.DEV) {
        console.log('✅ validateSession: no expiry set, assuming valid');
      }
      return true;
    }
    const isValid = Date.now() < sessionExpiry.value;
    if (import.meta.env.DEV) {
      console.log(`${isValid ? '✅' : '❌'} validateSession: ${isValid ? 'valid' : 'expired'}`);
    }
    return isValid;
  }

  // 延長會話時間
  function extendSession() {
    if (token.value && typeof window !== 'undefined') {
      const newExpiry = Date.now() + SESSION_DURATION;
      sessionExpiry.value = newExpiry;
      localStorage.setItem('sessionExpiry', newExpiry.toString());
    }
  }

  // 自動延長會話 - 在用戶活動時調用
  function autoExtendSession() {
    if (token.value && validateSession()) {
      // 如果會話還有不到 1 天就過期，自動延長
      const oneDay = 24 * 60 * 60 * 1000;
      if (sessionExpiry.value && (sessionExpiry.value - Date.now()) < oneDay) {
        extendSession();
      }
    }
  }

  // 檢查是否需要刷新 token
  function shouldRefreshToken(): boolean {
    if (!token.value || !sessionExpiry.value) {return false;}
    
    // 如果 token 在 30 分鐘內過期，就刷新
    return (sessionExpiry.value - Date.now()) < TOKEN_REFRESH_THRESHOLD;
  }

  // 主動刷新 token
  async function proactiveTokenRefresh() {
    if (shouldRefreshToken() && refreshToken.value) {
      console.log('🔄 Proactively refreshing token...');
      const result = await refreshAuthToken();
      if (result.success) {
        console.log('✅ Token refreshed successfully');
        // 更新會話過期時間 - 保持與初始登入一致的7天期限
        const newExpiry = Date.now() + SESSION_DURATION;
        sessionExpiry.value = newExpiry;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sessionExpiry', newExpiry.toString());
        }
        console.log('🔄 Session extended to 7 days after token refresh');
        logSessionStatus();
      } else {
        console.log('❌ Token refresh failed:', result.error);
      }
    }
  }

  // 清除錯誤訊息
  function clearError() {
    console.log('🧹 clearError called, current error:', error.value);
    error.value = null;
    console.log('🧹 clearError completed, new error:', error.value);
  }

  // 🔧 新增：會話狀態管理方法 - 解決競爭條件
  function setSessionStatus(status: SessionStatus) {
    console.log(`🔄 Session status changing: ${sessionStatus.value} -> ${status}`);
    sessionStatus.value = status;
  }

  // 會話恢復 - 統一的初始化邏輯
  async function initializeSession(): Promise<void> {
    console.log('🚀 Initializing session...');
    setSessionStatus('pending');
    
    try {
      // 檢查是否有存儲的 token
      if (!token.value) {
        console.log('❌ No stored token found');
        setSessionStatus('unauthenticated');
        return;
      }
      
      // 檢查會話是否有效
      if (!validateSession()) {
        console.log('❌ Session expired, clearing auth state');
        await logout(false);
        setSessionStatus('unauthenticated');
        return;
      }
      
      // 嘗試獲取用戶資料
      console.log('🔍 Fetching current agent...');
      const response = await authApi.me();
      
      if (response.success && response.data) {
        currentAgent.value = response.data;
        setSessionStatus('authenticated');
        console.log('✅ Session restored successfully');
      } else if (response.status === 401) {
        console.log('❌ Token invalid, clearing auth state');
        await logout(false);
        setSessionStatus('unauthenticated');
      } else {
        console.warn('⚠️ Failed to fetch user data but token might be valid');
        setSessionStatus('unauthenticated');
      }
    } catch (error) {
      console.error('💥 Session initialization error:', error);
      setSessionStatus('unauthenticated');
    }
  }

  // 調試用：記錄會話狀態
  function logSessionStatus() {
    if (sessionExpiry.value) {
      const now = Date.now();
      const timeLeft = sessionExpiry.value - now;
      const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
      const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      
      console.log(`📊 Session Status: ${daysLeft}d ${hoursLeft}h ${minutesLeft}m remaining`);
      console.log(`📅 Session expires at: ${new Date(sessionExpiry.value).toLocaleString()}`);
    }
  }

  // 刷新 Token
  async function refreshAuthToken() {
    if (!refreshToken.value) {
      return { success: false, error: 'No refresh token available' };
    }

    try {
      const response = await authApi.refreshToken();
      if (response.success && response.data) {
        token.value = response.data.token;
        if (response.data.refreshToken) {
          refreshToken.value = response.data.refreshToken;
        }
        
        // 更新 localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('token', response.data.token);
          if (response.data.refreshToken) {
            localStorage.setItem('refreshToken', response.data.refreshToken);
          }
        }
        
        // 設定認證標頭
        authApi.setAuthHeader(response.data.token, response.data.refreshToken);
        
        return { success: true };
      } else {
        // 刷新失敗，清除所有認證狀態
        await logout(false);
        return { success: false, error: response.error || 'Token refresh failed' };
      }
    } catch (err) {
      await logout(false);
      return { success: false, error: 'Token refresh error' };
    }
  }

  // 🔧 新的初始化邏輯 - 設定認證標頭但不立即恢復會話
  // 會話恢復將由 main.ts 調用 initializeSession() 來處理
  if (typeof window !== 'undefined' && token.value) {
    authApi.setAuthHeader(token.value, refreshToken.value || undefined);
  }

  return {
    // 狀態
    token,
    refreshToken,
    currentAgent,
    loading,
    error,
    sessionExpiry,
    sessionStatus,
    // 計算屬性
    isAuthenticated: computed(() => {
      const hasToken = !!token.value;
      const sessionValid = validateSession();
      const hasCurrentAgent = !!currentAgent.value;
      const hasError = !!error.value;
      
      // 🔧 CRITICAL FIX: 優先考慮有效的認證數據，而不是錯誤狀態
      // 如果用戶有有效的 token、session 和 agent 數據，即使有錯誤狀態也應視為已認證
      // 錯誤狀態可能來自其他操作或是過時的錯誤
      const result = hasToken && sessionValid && hasCurrentAgent;
      
      console.log('🔐 isAuthenticated computed:', {
        hasToken,
        sessionValid,
        hasCurrentAgent,
        hasError,
        result,
        tokenValue: token.value ? 'exists' : 'null',
        currentPath: typeof window !== 'undefined' && window.location ? window.location.pathname : 'unknown',
        reasoning: 'Priority on valid auth data over error states'
      });
      
      // 🧹 AUTO-CLEANUP: 如果認證有效但有錯誤狀態，自動清除過時的錯誤
      if (result && hasError) {
        console.log('🧹 Auto-clearing stale error state since authentication is valid');
        // 使用 nextTick 避免在計算屬性中直接修改響應式狀態
        setTimeout(() => {
          if (error.value) {
            console.log('🧹 Clearing error:', error.value);
            error.value = null;
          }
        }, 0);
      }
      
      return result;
    }),
    isAdmin,
    isTeam,
    isAgent,
    isTeamOrAdmin,
    // 方法
    login,
    logout,
    fetchCurrentAgent,
    validateSession,
    extendSession,
    autoExtendSession,
    refreshAuthToken,
    shouldRefreshToken,
    proactiveTokenRefresh,
    logSessionStatus,
    clearError,
    // 🔧 新增：會話恢復相關方法
    setSessionStatus,
    initializeSession
  };
});