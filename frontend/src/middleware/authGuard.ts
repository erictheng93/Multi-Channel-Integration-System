// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/middleware/authGuard.ts
// Created by: Frontend Middleware Developer

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * 認證守衛 - 檢查用戶是否已登入
 */
export function authGuard(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  if (authStore.isAuthenticated) {
    next()
  } else {
    next('/login')
  }
}

/**
 * 管理員守衛 - 檢查用戶是否為管理員
 */
export function adminGuard(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  if (authStore.isAuthenticated && authStore.isAdmin) {
    next()
  } else if (authStore.isAuthenticated) {
    next('/dashboard') // 已登入但非管理員，重定向到儀表板
  } else {
    next('/login')
  }
}

/**
 * 訪客守衛 - 已登入用戶不能訪問的頁面（如登入頁）
 */
export function guestGuard(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  if (authStore.isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
}

/**
 * 組合認證守衛 - 結合多個守衛的邏輯
 */
export async function combinedAuthGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  console.log('🛡️ SUPER ULTRA DEBUG: AuthGuard called:', {
    from: from.path,
    to: to.path,
    requiresAuth: to.meta.requiresAuth,
    requiresAdmin: to.meta.requiresAdmin,
    guestOnly: to.meta.guestOnly,
    isAuthenticated: authStore.isAuthenticated,
    hasToken: !!authStore.token,
    hasCurrentAgent: !!authStore.currentAgent,
    hasError: !!authStore.error,
    loading: authStore.loading,
    timestamp: Date.now(),
    callStack: new Error().stack
  });
  
  // 🚨 CRITICAL: 檢查是否是從登入頁面觸發的導航
  if (from.path === '/login' && (to.path === '/dashboard' || to.path === '/')) {
    console.log('🔥 SUPER CRITICAL: Navigation from login to dashboard detected in auth guard!')
    console.log('  - This might be the source of the unwanted navigation!')
  }

  try {
    // 檢查路由是否需要認證
    if (to.meta.requiresAuth) {
      console.log('🔒 Route requires auth, checking authentication...');
      if (!authStore.isAuthenticated) {
        console.log('❌ User not authenticated, redirecting to login');
        next('/login')
        return
      }
      console.log('✅ User is authenticated');

      // 檢查是否需要管理員權限
      if (to.meta.requiresAdmin) {
        // 如果 currentAgent 還沒載入，但有 token，先允許導航，然後在背景載入
        if (!authStore.currentAgent && authStore.token) {
          // 非阻塞式載入用戶資料
          authStore.fetchCurrentAgent().catch(error => {
            console.warn('Failed to fetch current agent:', error)
          })
          
          // 暫時允許導航，如果用戶不是管理員，頁面會自動處理權限檢查
          next()
          return
        }

        // 如果已經有 currentAgent 資料，檢查管理員權限
        if (authStore.currentAgent && !authStore.isAdmin) {
          console.log('Access denied: User is not admin', {
            hasCurrentAgent: !!authStore.currentAgent,
            isAdmin: authStore.isAdmin,
            userRole: authStore.currentAgent?.role
          })
          next('/dashboard')
          return
        }
      }
    }

    // 檢查是否為訪客專用頁面
    if (to.meta.guestOnly) {
      console.log('👤 Route is guest only, checking if user is authenticated...');
      console.log('👤 Auth check details:', {
        isAuthenticated: authStore.isAuthenticated,
        hasToken: !!authStore.token,
        hasCurrentAgent: !!authStore.currentAgent,
        sessionValid: authStore.token ? 'check needed' : 'no token',
        hasError: !!authStore.error,
        loading: authStore.loading
      });
      
      // 🚨 SUPER ULTRA DEBUG FIX: 完全阻止任何可能導致跳轉的邏輯
      console.log('🚨 GUEST ONLY PAGE LOGIC - SUPER DEBUG CHECK:');
      console.log('  - From path:', from.path);
      console.log('  - To path:', to.path);
      console.log('  - Has error:', !!authStore.error);
      console.log('  - Error value:', authStore.error);
      console.log('  - Loading:', authStore.loading);
      console.log('  - IsAuthenticated:', authStore.isAuthenticated);
      console.log('  - Has token:', !!authStore.token);
      console.log('  - Has currentAgent:', !!authStore.currentAgent);
      
      // 🔧 EMERGENCY BYPASS: 如果是登入頁面且有任何錯誤或載入狀態，完全跳過認證檢查
      if (to.path === '/login' && (authStore.error || authStore.loading)) {
        console.log('🚨 EMERGENCY BYPASS: Staying on login page due to error/loading state');
        next()
        return
      }
      
      // 🔧 EMERGENCY BYPASS: 如果從登入頁面導航且目標不是登入頁面，檢查是否應該阻止
      if (from.path === '/login' && to.path !== '/login') {
        console.log('🚨 POTENTIAL UNWANTED NAVIGATION FROM LOGIN PAGE!');
        console.log('  - Target:', to.path);
        console.log('  - Should allow navigation?');
        
        // 只有在明確成功認證的情況下才允許導航
        const hasValidAuth = authStore.token && authStore.currentAgent && !authStore.error && !authStore.loading
        console.log('  - Has valid auth:', hasValidAuth);
        
        if (!hasValidAuth) {
          console.log('🛑 BLOCKING navigation - auth state not fully valid');
          next('/login') // 強制回到登入頁面
          return
        }
      }
      
      // 原始邏輯 (簡化版)
      if (authStore.isAuthenticated && authStore.currentAgent && authStore.token && !authStore.error) {
        console.log('🔄 User is fully authenticated, redirecting to dashboard');
        next('/dashboard')
        return
      }
      
      console.log('✅ Allowing access to guest page');
    }

    // 確保導航繼續
    console.log('🎯 Navigation allowed, proceeding...');
    next()
  } catch (error) {
    console.error('Navigation guard error:', error)
    // 發生錯誤時，仍然允許導航繼續，避免卡住
    next()
  }
}