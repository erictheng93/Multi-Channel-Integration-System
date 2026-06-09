// 專案名稱：Multi-Channel Support MVP  
// 檔案路徑：/frontend/src/stores/auth.ts
// Created by: Pinia Store Developer

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Agent, LoginRequest, LoginResponse } from '@/types';
import { authApi } from '@/api/auth';
import { apiClient } from '@/api/base';
import { createLogger } from '@/utils/logger'
import {
  clearAuthStorageItems,
  clearLegacyAuthLocalStorage,
  getStoredAuthItem,
  setStoredAuthItem
} from '@/utils/authStorage'

const frontendLogger = createLogger('auth')

// Phase 1 Optimization: Team role type (matches backend TeamRoleInTeam)
type TeamRoleInTeam = 'member' | 'lead' | 'supervisor';

// 會話時間常量 - 統一管理
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天
const SESSION_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 分鐘

// 會話恢復狀態類型
type SessionStatus = 'pending' | 'authenticated' | 'unauthenticated' | 'restored';

// Utility functions for auth management
function clearAuthStorage() {
  if (typeof window !== 'undefined') {
    clearAuthStorageItems();
  }
}

function isValidAgent(agent: Agent | null): boolean {
  return !!(agent?.id && agent?.email && agent?.displayName &&
    ['admin', 'team', 'agent'].includes(agent.role));
}

function storeAuthData(loginData: LoginResponse, expiry: number) {
  if (typeof window === 'undefined') {return;}

  setStoredAuthItem('sessionExpiry', expiry.toString());
  setStoredAuthItem('currentAgent', JSON.stringify(loginData.agent));

  clearLegacyAuthLocalStorage();
}

function handleLoginError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as Error).message;
  }
  if (typeof error === 'string') {return error;}
  return '網路錯誤，請稍後再試';
}



export const useAuthStore = defineStore('auth', () => {
  // 狀態
  const token = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const currentAgent = ref<Agent | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sessionExpiry = ref<number | null>(null);
  // 新增：會話恢復狀態 - 解決競爭條件問題
  const sessionStatus = ref<SessionStatus>('pending');

  // Phase 1 Optimization: Multi-team support state
  const allowedTeamIds = ref<number[]>([]);
  const teamRoles = ref<Record<number, TeamRoleInTeam>>({});
  const contextTeamId = ref<number | null>(null);

  // 清除認證狀態的內部函數
  function clearAuthState() {
    token.value = null;
    refreshToken.value = null;
    currentAgent.value = null;
    sessionExpiry.value = null;
    // Phase 1: Clear multi-team state
    allowedTeamIds.value = [];
    teamRoles.value = {};
    contextTeamId.value = null;
    apiClient.setContextTeam(null);
  }

  // Phase 1 Optimization: Switch team context
  function switchTeam(teamId: number): boolean {
    // Validate: admin can switch to any team, agents must have access
    if (currentAgent.value?.role !== 'admin' && !allowedTeamIds.value.includes(teamId)) {
      console.warn('[Auth] Cannot switch to team without access:', {
        requestedTeam: teamId,
        allowedTeams: allowedTeamIds.value
      });
      return false;
    }

    contextTeamId.value = teamId;
    apiClient.setContextTeam(teamId);

    // Persist to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('contextTeamId', teamId.toString());
    }

    frontendLogger.debug('[Auth] Switched team context to:', teamId);
    return true;
  }

  // Phase 1 Optimization: Get user's role in a specific team
  function getTeamRole(teamId: number): TeamRoleInTeam | undefined {
    return teamRoles.value[teamId];
  }

  // Phase 1 Optimization: Check if user can access a team
  function canAccessTeam(teamId: number): boolean {
    if (currentAgent.value?.role === 'admin') {
      return true;
    }
    return allowedTeamIds.value.includes(teamId);
  }

  // Initialize non-credential session metadata. HttpOnly auth cookies are
  // verified later by initializeSession() through /auth/me.
  if (typeof window !== 'undefined') {
    const expiry = getStoredAuthItem('sessionExpiry');
    const parsedExpiry = expiry ? parseInt(expiry, 10) : null;
    const isSessionFresh = parsedExpiry !== null && Date.now() <= parsedExpiry;

    if (isSessionFresh) {
      sessionExpiry.value = parsedExpiry;

      const storedAgent = getStoredAuthItem('currentAgent');
      if (storedAgent) {
        try {
          currentAgent.value = JSON.parse(storedAgent);
        } catch {
          clearAuthStorage();
        }
      }

      const storedContextTeamId = localStorage.getItem('contextTeamId');
      if (storedContextTeamId) {
        const parsed = parseInt(storedContextTeamId, 10);
        if (!isNaN(parsed)) {
          contextTeamId.value = parsed;
          apiClient.setContextTeam(parsed);
        }
      }
    } else {
      clearAuthStorage();
      apiClient.removeAuthHeader();
    }
  }

  // 計算屬性 - Simplified from 3-tier to 2-tier role system
  const isAdmin = computed(() => currentAgent.value?.role === 'admin');
  const isAgent = computed(() => currentAgent.value?.role === 'agent');
  const isTeamOrAdmin = computed(() =>
    currentAgent.value?.role === 'admin' // Note: 'team' role removed
  );

  // Simplified login method
  async function login(credentials: LoginRequest) {
    loading.value = true;
    error.value = null;

    try {
      const response = await authApi.login(credentials);

      if (!response.success || !response.data) {
        error.value = response.error || '登入失敗';
        clearAuthState();
        setSessionStatus('unauthenticated');
        return false;
      }

      const loginData = response.data as LoginResponse;

      // Handle password change requirement
      if (loginData.mustChangePassword) {
        return {
          success: false,
          mustChangePassword: true,
          tempToken: loginData.tempToken,
          agent: loginData.agent
        };
      }

      // Set auth state. Access and refresh credentials are issued as
      // HttpOnly cookies by the backend; do not mirror them in JS storage.
      token.value = null;
      refreshToken.value = null;
      currentAgent.value = loginData.agent;

      const expiry = Date.now() + SESSION_DURATION;
      sessionExpiry.value = expiry;

      // Phase 1: Set initial team context to agent's primary team
      if (loginData.agent.primaryTeamId) {
        switchTeam(loginData.agent.primaryTeamId);
      }

      // Store auth data
      storeAuthData(loginData, expiry);
      setSessionStatus('authenticated');

      return true;

    } catch (err) {
      clearAuthState();
      clearAuthStorage();
      error.value = handleLoginError(err);
      
      // 設定會話狀態為未認證
      setSessionStatus('unauthenticated');
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout(callAPI = true) {
    // Call logout API if requested
    if (callAPI && (currentAgent.value || sessionStatus.value === 'authenticated')) {
      try {
        await authApi.logout();
      } catch (_err) {
        console.warn('Logout API call failed:', _err);
      }
    }

    // Clear all auth state
    token.value = null;
    refreshToken.value = null;
    currentAgent.value = null;
    sessionExpiry.value = null;
    
    // Clear localStorage (auth + conversation caches to prevent cross-user contamination)
    if (typeof window !== 'undefined' && window.localStorage) {
      clearAuthStorageItems();

      // Clear all caches to prevent cross-user data leakage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('conversation-list') ||
          key.startsWith('cache_') ||
          key === 'analytics_comparison_cache' ||
          key === 'conversation_metadata_cache'
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    // Remove auth headers
    authApi.removeAuthHeader();
    
    // 設定會話狀態為未認證
    setSessionStatus('unauthenticated');

    // Notify router to invalidate auth cache (avoids circular dependency via event)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:state-changed'));
    }

    // Navigate to login (only if not already on login page)
    if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  // 智能獲取當前用戶 - 優先使用快取
  async function fetchCurrentAgent(forceRefresh = false) {
    // 優化：如果已有有效資料且非強制刷新，直接返回
    if (!forceRefresh && currentAgent.value && isValidAgent(currentAgent.value)) {
      if (import.meta.env.DEV) {
        frontendLogger.debug(' Agent data already cached, skipping API request');
      }
      return;
    }

    try {
      if (import.meta.env.DEV) {
        frontendLogger.debug(' Fetching agent data from server...');
      }
      
      const response = await authApi.me();
      if (response?.success && response.data) {
        currentAgent.value = response.data;
        // 同步更新 localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          setStoredAuthItem('currentAgent', JSON.stringify(response.data));
        }
      } else if (response?.status === 401) {
        await logout(false);
      }
    } catch (_err) {
      console.warn('fetchCurrentAgent failed:', _err);
    }
  }

  // 驗證會話是否有效 (PURE FUNCTION - No side effects)
  function validateSession(): boolean {
    if (!sessionExpiry.value) {return false;}

    // 檢查是否過期
    const isValid = Date.now() < sessionExpiry.value;
    if (!isValid) {
      console.warn('[Auth] Session has expired');
    }

    return isValid;
  }

  // 延長會話時間
  function extendSession() {
    if (typeof window !== 'undefined') {
      const newExpiry = Date.now() + SESSION_DURATION;
      sessionExpiry.value = newExpiry;
      setStoredAuthItem('sessionExpiry', newExpiry.toString());
    }
  }

  // 自動延長會話 - 在用戶活動時調用
  function autoExtendSession() {
    if (validateSession()) {
      // 如果會話還有不到 1 天就過期，自動延長
      const oneDay = 24 * 60 * 60 * 1000;
      if (sessionExpiry.value && (sessionExpiry.value - Date.now()) < oneDay) {
        extendSession();
      }
    }
  }

  // Check if access token JWT has expired (uses JWT exp claim, not sessionExpiry)
  function isTokenExpired(): boolean {
    return !validateSession();
  }

  // 新增：驗證 Token 格式和內容
  function isTokenValid(): boolean {
    return validateSession();
  }

  // Check if token should be proactively refreshed (PURE FUNCTION - No side effects)
  // Uses JWT exp claim to determine proximity to expiry, not sessionExpiry
  function shouldRefreshToken(): boolean {
    if (!sessionExpiry.value || !validateSession()) {return false;}
    return (sessionExpiry.value - Date.now()) < SESSION_REFRESH_THRESHOLD;
  }

  // 主動刷新 token
  async function proactiveTokenRefresh() {
    if (shouldRefreshToken()) {
      const result = await refreshAuthToken();
      if (result.success) {
        const newExpiry = Date.now() + SESSION_DURATION;
        sessionExpiry.value = newExpiry;
        if (typeof window !== 'undefined') {
          setStoredAuthItem('sessionExpiry', newExpiry.toString());
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
      if (!validateSession()) {
        await logout(false);
        setSessionStatus('unauthenticated');
        return;
      }

      if (import.meta.env.DEV) {
        frontendLogger.debug(' Verifying cookie-backed session with /auth/me...');
      }
      
      const response = await authApi.me();
      
      if (response?.success && response.data) {
        currentAgent.value = response.data;
        // 同步更新 localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          setStoredAuthItem('currentAgent', JSON.stringify(response.data));
        }
        setSessionStatus('authenticated');
      } else if (response?.status === 401) {
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
      frontendLogger.debug(`Session: ${daysLeft}d ${hoursLeft}h remaining`);
    }
  }

  // Unified token refresh — delegates to apiClient which has request queue + retry logic
  async function refreshAuthToken() {
    try {
      const newToken = await apiClient.refreshAuthToken();
      if (newToken) {
        const newExpiry = Date.now() + SESSION_DURATION;
        sessionExpiry.value = newExpiry;
        if (typeof window !== 'undefined') {
          setStoredAuthItem('sessionExpiry', newExpiry.toString());
        }
        await fetchCurrentAgent(true);

        try {
          const { reconnectWebSocketStore } = await import('@/stores/websocketReconnect');
          frontendLogger.debug('[Auth] Cookie session refreshed, reconnecting WebSocket...');
          reconnectWebSocketStore().catch((err: Error) => {
            console.warn('[Auth] WebSocket reconnection failed after token refresh:', err);
          });
        } catch (wsError) {
          console.warn('[Auth] Could not reconnect WebSocket after token refresh:', wsError);
        }

        return { success: true };
      } else {
        // apiClient.refreshAuthToken() returns null on failure and handles redirect
        return { success: false, error: 'Token refresh failed' };
      }
    } catch (_err) {
      return { success: false, error: 'Token refresh error' };
    }
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
    // Phase 1: Multi-team state
    allowedTeamIds,
    teamRoles,
    contextTeamId,
    // 計算屬性 (PURE COMPUTED - No side effects)
    isAuthenticated: computed(() => {
      // Pure computation without any state mutations
      // Error clearing should be handled explicitly by caller, not automatically
      return validateSession() && !!currentAgent.value;
    }),
    isAdmin,
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
    // 新增：會話恢復相關方法
    setSessionStatus,
    initializeSession,
    // 新增：Token 有效性檢查方法
    isTokenExpired,
    isTokenValid,
    // Phase 1: Multi-team methods
    switchTeam,
    getTeamRole,
    canAccessTeam
  };
});
