// 專案名稱：Multi-Channel Support MVP  
// 檔案路徑：/frontend/src/stores/auth.ts
// Created by: Pinia Store Developer

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Agent, LoginRequest, LoginResponse } from '@/types';
import { authApi } from '@/api/auth';

// 會話時間常量 - 統一管理
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 分鐘

// 會話恢復狀態類型
type SessionStatus = 'pending' | 'authenticated' | 'unauthenticated' | 'restored';

// 工具函數：清理localStorage中的認證數據
function clearAuthStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const authKeys = ['token', 'refreshToken', 'sessionExpiry', 'currentAgent'];
    authKeys.forEach(key => localStorage.removeItem(key));
  }
}

// 工具函數：驗證 agent 資料的有效性
function isValidAgent(agent: Agent | null): boolean {
  if (!agent) return false;
  
  // 檢查必要欄位是否存在
  return !!(
    agent.id &&
    agent.email &&
    agent.displayName &&
    agent.role &&
    ['admin', 'team', 'agent'].includes(agent.role)
  );
}


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

  // Initialize tokens and agent from localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedToken = localStorage.getItem('token');
    const storedRefreshToken = localStorage.getItem('refreshToken');
    const expiry = localStorage.getItem('sessionExpiry');
    const storedAgent = localStorage.getItem('currentAgent');
    
    token.value = storedToken || null;
    refreshToken.value = storedRefreshToken || null;
    sessionExpiry.value = expiry ? parseInt(expiry, 10) : null;
    
    // Restore currentAgent from localStorage
    if (storedAgent) {
      try {
        currentAgent.value = JSON.parse(storedAgent);
      } catch (e) {
        console.error('Failed to parse stored agent:', e);
        currentAgent.value = null;
      }
    }
    
    // Check if session has expired
    if (sessionExpiry.value && Date.now() > sessionExpiry.value) {
      token.value = null;
      refreshToken.value = null;
      sessionExpiry.value = null;
      currentAgent.value = null;
      clearAuthStorage();
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
    loading.value = true;
    error.value = null;

    try {
      const response = await authApi.login(credentials);
      if (response.success && response.data) {
        const loginData = response.data as LoginResponse;
        // 檢查是否需要強制更改密碼
        if (loginData.mustChangePassword) {
          return {
            success: false,
            mustChangePassword: true,
            tempToken: loginData.tempToken,
            agent: loginData.agent
          };
        }
        token.value = loginData.token;
        refreshToken.value = loginData.refreshToken || null;
        currentAgent.value = loginData.agent;
        
        // Set session expiry
        const expiry = Date.now() + SESSION_DURATION;
        sessionExpiry.value = expiry;
        // 儲存 tokens、過期時間和 currentAgent
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('token', loginData.token);
          if (loginData.refreshToken) {
            localStorage.setItem('refreshToken', loginData.refreshToken);
          }
          localStorage.setItem('sessionExpiry', expiry.toString());
          // Save currentAgent to localStorage
          localStorage.setItem('currentAgent', JSON.stringify(loginData.agent));
        }
        
        // 設定預設 header
        authApi.setAuthHeader(loginData.token, loginData.refreshToken);
        
        setSessionStatus('authenticated');
        
        return true;
      } else {
        // 使用 API 回傳的詳細錯誤訊息
        const apiError = response.error || '登入失敗';
        error.value = apiError;
        
        // 清理認證狀態
        token.value = null;
        refreshToken.value = null;
        currentAgent.value = null;
        sessionExpiry.value = null;
        clearAuthStorage();
        setSessionStatus('unauthenticated');
        
        return false;
      }
    } catch (err) {
      
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
      localStorage.removeItem('currentAgent');
    }
    
    // Remove auth headers
    authApi.removeAuthHeader();
    
    // 🔧 設定會話狀態為未認證
    setSessionStatus('unauthenticated');
    
    // Navigate to login (only if not already on login page)
    if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  // 智能獲取當前用戶 - 優先使用快取
  async function fetchCurrentAgent(forceRefresh = false) {
    if (!token.value) {return;}

    // ✅ 優化：如果已有有效資料且非強制刷新，直接返回
    if (!forceRefresh && currentAgent.value && isValidAgent(currentAgent.value)) {
      if (import.meta.env.DEV) {
        console.log('✅ Agent data already cached, skipping API request');
      }
      return;
    }

    try {
      if (import.meta.env.DEV) {
        console.log('🔄 Fetching agent data from server...');
      }
      
      const response = await authApi.me();
      if (response.success && response.data) {
        currentAgent.value = response.data;
        // 同步更新 localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('currentAgent', JSON.stringify(response.data));
        }
      } else if (response.status === 401) {
        await logout(false);
      }
    } catch (err) {
      console.warn('fetchCurrentAgent failed:', err);
    }
  }

  // 驗證會話是否有效
  function validateSession(): boolean {
    if (!token.value) {return false;}
    if (!sessionExpiry.value) {return true;}
    return Date.now() < sessionExpiry.value;
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
      const result = await refreshAuthToken();
      if (result.success) {
        const newExpiry = Date.now() + SESSION_DURATION;
        sessionExpiry.value = newExpiry;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sessionExpiry', newExpiry.toString());
        }
      }
    }
  }

  // 清除錯誤訊息
  function clearError() {
    error.value = null;
  }

  // 會話狀態管理
  function setSessionStatus(status: SessionStatus) {
    sessionStatus.value = status;
  }

  // 會話恢復 - 智能初始化邏輯（避免額外API請求）
  async function initializeSession(): Promise<void> {
    setSessionStatus('pending');
    
    try {
      if (!token.value) {
        setSessionStatus('unauthenticated');
        return;
      }
      
      if (!validateSession()) {
        await logout(false);
        setSessionStatus('unauthenticated');
        return;
      }
      
      // ✅ 優化：如果已有有效的 currentAgent，直接使用快取
      if (currentAgent.value && isValidAgent(currentAgent.value)) {
        setSessionStatus('authenticated');
        if (import.meta.env.DEV) {
          console.log('✅ Using cached agent data, skipping /auth/me request');
        }
        return;
      }
      
      // 只有在沒有有效 currentAgent 時才發送 API 請求
      if (import.meta.env.DEV) {
        console.log('🔄 No cached agent data, fetching from server...');
      }
      
      const response = await authApi.me();
      
      if (response.success && response.data) {
        currentAgent.value = response.data;
        // 同步更新 localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('currentAgent', JSON.stringify(response.data));
        }
        setSessionStatus('authenticated');
      } else if (response.status === 401) {
        await logout(false);
        setSessionStatus('unauthenticated');
      } else {
        setSessionStatus('unauthenticated');
      }
    } catch (error) {
      console.error('Session initialization error:', error);
      setSessionStatus('unauthenticated');
    }
  }

  // 調試用：記錄會話狀態
  function logSessionStatus() {
    if (sessionExpiry.value && import.meta.env.DEV) {
      const timeLeft = sessionExpiry.value - Date.now();
      const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
      const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      console.log(`Session: ${daysLeft}d ${hoursLeft}h remaining`);
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
        
        // 更新 localStorage 中的 token 資料
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('token', response.data.token);
          if (response.data.refreshToken) {
            localStorage.setItem('refreshToken', response.data.refreshToken);
          }
        }
        
        authApi.setAuthHeader(response.data.token, response.data.refreshToken);
        return { success: true };
      } else {
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
      const result = !!token.value && validateSession() && !!currentAgent.value;
      
      // 自動清除過時錯誤
      if (result && error.value) {
        setTimeout(() => {
          if (error.value) {error.value = null;}
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