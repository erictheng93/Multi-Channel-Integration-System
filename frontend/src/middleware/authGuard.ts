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

  console.log('🛡️ AUTH GUARD: Initial check:', {
    from: from.path,
    to: to.path,
    sessionStatus: authStore.sessionStatus,
    requiresAuth: to.meta.requiresAuth,
    requiresAdmin: to.meta.requiresAdmin,
    guestOnly: to.meta.guestOnly,
    isAuthenticated: authStore.isAuthenticated,
    hasToken: !!authStore.token,
    hasCurrentAgent: !!authStore.currentAgent,
    hasError: !!authStore.error,
    timestamp: Date.now()
  });

  // 🔧 CRITICAL FIX: 等待會話恢復完成 - 解決競爭條件
  if (authStore.sessionStatus === 'pending') {
    console.log('⏳ AUTH GUARD: Session restoration pending, waiting...');
    
    // 等待會話恢復完成，最多等待 5 秒
    const maxWaitTime = 5000;
    const startTime = Date.now();
    
    while (authStore.sessionStatus === 'pending' && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ AUTH GUARD: Session restoration completed after ${Date.now() - startTime}ms, status: ${authStore.sessionStatus}`);
  }
  
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

    // 檢查是否為訪客專用頁面 (簡化邏輯 - 基於可靠的會話狀態)
    if (to.meta.guestOnly) {
      console.log('👤 GUEST ONLY PAGE: Checking authentication status');
      console.log('👤 Session status:', authStore.sessionStatus);
      console.log('👤 Is authenticated:', authStore.isAuthenticated);
      
      // 🔧 簡化邏輯：基於會話狀態做判斷
      if (authStore.sessionStatus === 'authenticated' && authStore.isAuthenticated) {
        console.log('🔄 User is authenticated, redirecting to dashboard');
        next('/dashboard');
        return;
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