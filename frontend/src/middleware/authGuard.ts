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
 * 修復無限刷新問題：等待 initializeSession 完成後再判斷
 *
 * 問題分析：
 * 1. main.ts 中 initializeSession() 正在執行（檢查 token 有效性）
 * 2. 同時路由守衛也在執行（只檢查 localStorage 有沒有 token）
 * 3. 競爭條件：守衛說「有 token，可以通行」，但 session init 說「token 無效，登出」
 * 4. 結果：無限重定向循環
 *
 * 解決方案：
 * 等待 initializeSession 完成，然後使用確定的 isAuthenticated 狀態來判斷
 */
export async function combinedAuthGuard(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<boolean> {
  const authStore = useAuthStore()

  console.log(' Auth Guard:', to.path, '| Session Status:', authStore.sessionStatus)

  // Wait for session initialization to complete
  if (authStore.sessionStatus === 'pending') {
    console.log(' Waiting for session initialization...')
    await authStore.initializeSession()
    console.log(' Session initialization completed:', authStore.sessionStatus)
  }

  // Use the finalized isAuthenticated state (token validated)
  const isAuthenticated = authStore.isAuthenticated

  // 1. Handle guestOnly pages (e.g., login page)
  if (to.meta.guestOnly) {
    if (isAuthenticated) {
      console.log(' Already authenticated, redirecting to dashboard')
      next('/dashboard')
      return true
    }
    console.log(' Guest page, allowing access')
    next()
    return false
  }

  // 2. Handle pages that require auth
  if (to.meta.requiresAuth) {
    if (!isAuthenticated) {
      console.log(' Not authenticated, redirecting to login')
      next('/login')
      return false
    }
    console.log(' Authenticated, allowing access')
    next()
    return true
  }

  // 3. Other pages — allow through
  console.log(' Public page, allowing access')
  next()
  return isAuthenticated
}
