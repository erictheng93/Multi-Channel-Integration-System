// 專案名稱：Multi-Channel Support MVP  
// 檔案路徑：/frontend/src/stores/auth.ts
// Created by: Pinia Store Developer

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Agent, LoginRequest, LoginResponse } from '@/types';
import { authApi } from '@/api/auth';
import { apiClient } from '@/api/base';

// 🚀 Phase 1 Optimization: Team role type (matches backend TeamRoleInTeam)
type TeamRoleInTeam = 'member' | 'lead' | 'supervisor';

// 會話時間常量 - 統一管理
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天
const TOKEN_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 分鐘

// 會話恢復狀態類型
type SessionStatus = 'pending' | 'authenticated' | 'unauthenticated' | 'restored';

/**
 * UTF-8 安全的 Base64 URL 解碼
 * 使用 TextDecoder 支持所有 Unicode 字符（包括中文、emoji 等）
 * 符合 RFC 7519 (JWT) 標準
 */
function base64UrlDecode(str: string): string {
  try {
    // 將 URL 安全格式轉回標準 Base64
    const base64 = str
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(str.length + (4 - str.length % 4) % 4, '=');

    // Base64 解碼為二進制字符串
    const binaryString = atob(base64);

    // 轉為 Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // UTF-8 解碼
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (error) {
    console.error('[base64UrlDecode] Decoding failed:', error);
    throw error;
  }
}

// Utility functions for auth management
function clearAuthStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    ['token', 'refreshToken', 'sessionExpiry', 'currentAgent'].forEach(key =>
      localStorage.removeItem(key)
    );
  }
}

function isValidAgent(agent: Agent | null): boolean {
  return !!(agent?.id && agent?.email && agent?.displayName &&
    ['admin', 'team', 'agent'].includes(agent.role));
}

function storeAuthData(loginData: LoginResponse, expiry: number) {
  if (typeof window === 'undefined' || !window.localStorage) {return;}

  localStorage.setItem('token', loginData.token);
  localStorage.setItem('sessionExpiry', expiry.toString());
  localStorage.setItem('currentAgent', JSON.stringify(loginData.agent));

  if (loginData.refreshToken) {
    localStorage.setItem('refreshToken', loginData.refreshToken);
  }
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
  // 🔧 新增：會話恢復狀態 - 解決競爭條件問題
  const sessionStatus = ref<SessionStatus>('pending');

  // 🚀 Phase 1 Optimization: Multi-team support state
  const allowedTeamIds = ref<number[]>([]);
  const teamRoles = ref<Record<number, TeamRoleInTeam>>({});
  const contextTeamId = ref<number | null>(null);

  // 清除認證狀態的內部函數
  function clearAuthState() {
    token.value = null;
    refreshToken.value = null;
    currentAgent.value = null;
    sessionExpiry.value = null;
    // 🚀 Phase 1: Clear multi-team state
    allowedTeamIds.value = [];
    teamRoles.value = {};
    contextTeamId.value = null;
    apiClient.setContextTeam(null);
  }

  // 🚀 Phase 1 Optimization: Parse multi-team data from JWT token
  function parseJwtTeamData(tokenStr: string): void {
    try {
      const parts = tokenStr.split('.');
      if (parts.length === 3 && parts[1]) {
        const payload = JSON.parse(base64UrlDecode(parts[1]));

        // Extract multi-team data from JWT
        if (payload.allowedTeamIds && Array.isArray(payload.allowedTeamIds)) {
          allowedTeamIds.value = payload.allowedTeamIds;
        }
        if (payload.teamRoles && typeof payload.teamRoles === 'object') {
          teamRoles.value = payload.teamRoles;
        }

        console.log('[Auth] Parsed JWT team data:', {
          allowedTeamIds: allowedTeamIds.value,
          teamRoles: teamRoles.value
        });
      }
    } catch (e) {
      console.error('[Auth] Failed to parse JWT team data:', e);
    }
  }

  // 🚀 Phase 1 Optimization: Switch team context
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

    console.log('[Auth] Switched team context to:', teamId);
    return true;
  }

  // 🚀 Phase 1 Optimization: Get user's role in a specific team
  function getTeamRole(teamId: number): TeamRoleInTeam | undefined {
    return teamRoles.value[teamId];
  }

  // 🚀 Phase 1 Optimization: Check if user can access a team
  function canAccessTeam(teamId: number): boolean {
    if (currentAgent.value?.role === 'admin') {
      return true;
    }
    return allowedTeamIds.value.includes(teamId);
  }

  // Initialize from localStorage with JWT validation
  // 🔧 修復無限刷新問題：檢查 JWT token 的有效性
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedToken = localStorage.getItem('token');
    const expiry = localStorage.getItem('sessionExpiry');

    // Check session validity first
    const isSessionValid = expiry && Date.now() <= parseInt(expiry, 10);

    if (isSessionValid && storedToken) {
      // ✅ 驗證 JWT token 是否有效（檢查格式和過期時間）
      let isJwtValid = false;
      try {
        const parts = storedToken.split('.');
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(atob(parts[1]));
          // 檢查必要字段
          if (payload.userId && payload.role) {
            // 檢查 JWT 是否過期
            if (payload.exp) {
              const currentTime = Math.floor(Date.now() / 1000);
              isJwtValid = payload.exp > currentTime;
              if (!isJwtValid) {
                console.warn('[Auth Init] JWT token expired, clearing storage');
              }
            } else {
              // 沒有 exp 字段，假設有效
              isJwtValid = true;
            }
          }
        }
      } catch (e) {
        console.error('[Auth Init] JWT validation failed:', e);
        isJwtValid = false;
      }

      // ✅ 只有 JWT 有效時才恢復 token
      if (isJwtValid) {
        token.value = storedToken;
        refreshToken.value = localStorage.getItem('refreshToken');
        sessionExpiry.value = parseInt(expiry || '0', 10);

        // 🚀 Phase 1: Parse multi-team data from stored token
        parseJwtTeamData(storedToken);

        // 🚀 Phase 1: Restore team context from localStorage
        const storedContextTeamId = localStorage.getItem('contextTeamId');
        if (storedContextTeamId) {
          const parsed = parseInt(storedContextTeamId, 10);
          if (!isNaN(parsed)) {
            contextTeamId.value = parsed;
            apiClient.setContextTeam(parsed);
          }
        }

        // Restore agent data
        const storedAgent = localStorage.getItem('currentAgent');
        if (storedAgent) {
          try {
            currentAgent.value = JSON.parse(storedAgent);
          } catch {
            clearAuthStorage();
          }
        }
      } else {
        // JWT 已過期或無效，清除所有數據
        clearAuthStorage();
      }
    } else {
      clearAuthStorage();
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

      // Set auth state
      token.value = loginData.token;
      refreshToken.value = loginData.refreshToken || null;
      currentAgent.value = loginData.agent;

      const expiry = Date.now() + SESSION_DURATION;
      sessionExpiry.value = expiry;

      // 🚀 Phase 1: Parse multi-team data from new token
      parseJwtTeamData(loginData.token);

      // 🚀 Phase 1: Set initial team context to agent's primary team
      if (loginData.agent.primaryTeamId) {
        switchTeam(loginData.agent.primaryTeamId);
      }

      // Store auth data
      storeAuthData(loginData, expiry);
      authApi.setAuthHeader(loginData.token, loginData.refreshToken);
      setSessionStatus('authenticated');

      return true;

    } catch (err) {
      clearAuthState();
      clearAuthStorage();
      error.value = handleLoginError(err);
      
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
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('sessionExpiry');
      localStorage.removeItem('currentAgent');

      // Clear conversation caches (Layer 1 + Layer 2) to prevent cross-user data leakage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('conversation-list') || key.startsWith('cache_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
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
    } catch (_err) {
      console.warn('fetchCurrentAgent failed:', _err);
    }
  }

  // 驗證會話是否有效 (PURE FUNCTION - No side effects)
  function validateSession(): boolean {
    if (!token.value) {return false;}

    // 🔧 增強：檢查 Token 格式和內容有效性
    if (!isTokenValid()) {
      console.warn('[Auth] Invalid token detected during session validation');
      // ⚠️  Do NOT call logout here - validation functions must be pure
      // Caller should handle logout based on validation result
      return false;
    }

    if (!sessionExpiry.value) {return true;}

    // 檢查是否過期
    const isValid = Date.now() < sessionExpiry.value;
    if (!isValid) {
      console.warn('[Auth] Session has expired');
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

  // 🔧 新增：檢查 Token 是否已完全過期
  function isTokenExpired(): boolean {
    if (!token.value) {return true;}
    if (!sessionExpiry.value) {return false;} // 如果沒有過期時間，假設有效

    return Date.now() >= sessionExpiry.value;
  }

  // 🔧 新增：驗證 Token 格式和內容
  function isTokenValid(): boolean {
    if (!token.value) {return false;}

    try {
      // 檢查 Token 格式（JWT 應該有 3 部分）
      const parts = token.value.split('.');
      if (parts.length !== 3 || !parts[1]) {return false;}

      // ✅ 使用 UTF-8 安全的解碼函數解析 payload
      const payload = JSON.parse(base64UrlDecode(parts[1]));
      if (!payload.userId || !payload.role) {return false;}

      // 檢查 Token 是否過期
      if (payload.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp <= currentTime) {
          console.warn('[Auth] Token has expired');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[Auth] Token validation failed:', error);
      return false;
    }
  }

  // 檢查是否需要刷新 token (PURE FUNCTION - No side effects)
  function shouldRefreshToken(): boolean {
    if (!token.value || !sessionExpiry.value) {return false;}

    // 🔧 增強：先檢查 Token 是否已經完全過期
    if (isTokenExpired()) {
      console.warn('[Auth] Token has expired, cannot refresh');
      // ⚠️  Do NOT call logout here - validation functions must be pure
      // Caller should handle logout based on expiration check
      return false;
    }

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

        // 🔌 Phase B4: Reconnect WebSocket with new token
        // The WebSocket connection uses the token from the URL, so we need to reconnect
        // after token refresh to ensure the new token is used
        try {
          const { useWebSocketStore } = await import('@/stores/websocket');
          const wsStore = useWebSocketStore();
          console.log('[Auth] Token refreshed, reconnecting global WebSocket Store with new token...');
          wsStore.reconnect().then(() => {
            console.log('[Auth] Global WebSocket Store reconnected successfully after token refresh');
          }).catch((err: Error) => {
            console.warn('[Auth] WebSocket reconnection failed after token refresh:', err);
          });
        } catch (wsError) {
          console.warn('[Auth] Could not reconnect WebSocket after token refresh:', wsError);
        }

        return { success: true };
      } else {
        await logout(false);
        return { success: false, error: response.error || 'Token refresh failed' };
      }
    } catch (_err) {
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
    // 🚀 Phase 1: Multi-team state
    allowedTeamIds,
    teamRoles,
    contextTeamId,
    // 計算屬性 (PURE COMPUTED - No side effects)
    isAuthenticated: computed(() => {
      // ✅ Pure computation without any state mutations
      // Error clearing should be handled explicitly by caller, not automatically
      return !!token.value && validateSession() && !!currentAgent.value;
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
    // 🔧 新增：會話恢復相關方法
    setSessionStatus,
    initializeSession,
    // 🔧 新增：Token 有效性檢查方法
    isTokenExpired,
    isTokenValid,
    // 🚀 Phase 1: Multi-team methods
    switchTeam,
    getTeamRole,
    canAccessTeam
  };
});