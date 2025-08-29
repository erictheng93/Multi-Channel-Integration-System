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
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) {
  const authStore = useAuthStore()

  // 極度簡化版本 - 避免任何可能的循環
  console.log('🛡️ Simple Auth Guard:', to.path)

  // 1. 如果不需要認證，直接通過
  if (!to.meta.requiresAuth) {
    next()
    return
  }

  // 2. 需要認證 - 檢查 token 是否存在（不做複雜檢查）
  const hasToken = !!authStore.token || !!localStorage.getItem('token')
  
  if (!hasToken) {
    // 沒有 token，去登入頁
    if (to.path !== '/login') {
      console.log('No token, redirecting to login')
      next('/login')
    } else {
      next()
    }
    return
  }

  // 3. 有 token，允許訪問
  console.log('Has token, allowing access')
  next()
}