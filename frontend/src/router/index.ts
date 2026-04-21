import { createRouter, createWebHistory } from 'vue-router'
import { combinedAuthGuard } from '@/middleware/authGuard'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('index')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { 
        requiresAuth: false,
        guestOnly: true,
        layout: 'blank'
      }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: {
        requiresAuth: true,
        title: '儀表板'
      }
    },
    {
      path: '/conversations',
      name: 'Conversations',
      component: () => import('@/views/ConversationsTable.vue'),  // 使用優化表格版本
      meta: {
        requiresAuth: true,
        title: '對話管理'
      }
    },
    {
      path: '/conversations/:id',
      name: 'ConversationDetail',
      component: () => import('@/views/ConversationDetail.vue'),  // 使用原始 2890 行版本
      meta: {
        requiresAuth: true,
        title: '對話詳情'
      }
    },
    {
      path: '/team',
      name: 'TeamManagement',
      component: () => import('@/views/TeamManagement.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: '團隊管理'
      }
    },
    {
      path: '/channels',
      name: 'ChannelManagement',
      component: () => import('@/views/ChannelManagement.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: '頻道管理'
      }
    },
    {
      path: '/activities',
      name: 'ActivityLog',
      component: () => import('@/views/ActivityLog.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: '活動記錄'
      }
    },
    {
      path: '/settings',
      component: () => import('@/views/SystemSettings.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: '系統設定'
      },
      children: [
        {
          path: '',
          redirect: '/settings/general'
        },
        {
          path: 'general',
          name: 'SettingsGeneral',
          component: () => import('@/components/system-settings/pages/GeneralSettingsPage.vue'),
          meta: { requiresAuth: true, requiresAdmin: true, title: '一般設定' }
        },
        {
          path: 'integrations',
          redirect: '/settings/integrations/line'
        },
        {
          path: 'integrations/line',
          name: 'SettingsIntegrationsLine',
          component: () => import('@/components/system-settings/pages/LineIntegrationPage.vue'),
          meta: { requiresAuth: true, requiresAdmin: true, title: 'LINE OA 整合' }
        },
        {
          path: 'integrations/facebook',
          name: 'SettingsIntegrationsFacebook',
          component: () => import('@/components/system-settings/pages/FacebookIntegrationPage.vue'),
          meta: { requiresAuth: true, requiresAdmin: true, title: 'Facebook 整合' }
        },
        {
          path: 'advanced',
          name: 'SettingsAdvanced',
          component: () => import('@/components/system-settings/pages/AdvancedSettingsPage.vue'),
          meta: { requiresAuth: true, requiresAdmin: true, title: '進階設定' }
        },
        {
          path: 'maintenance',
          redirect: '/settings/maintenance/health'
        },
        {
          path: 'maintenance/health',
          name: 'SettingsMaintenanceHealth',
          component: () => import('@/components/system-settings/pages/SystemHealthPage.vue'),
          meta: { requiresAuth: true, requiresAdmin: true, title: '系統健康檢查' }
        }
      ]
    },
    {
      path: '/monitoring/api',
      name: 'ApiMonitor',
      component: () => import('@/views/ApiMonitor.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: 'API監控'
      }
    },
    // ==================== 组件测试页面 (开发用) ====================
    {
      path: '/test/components',
      name: 'ComponentTest',
      component: () => import('@/views/ComponentTestPage.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: '组件测试'
      }
    },
    // ==================== WebSocket 管理路由 ====================
    {
      path: '/admin/websocket',
      name: 'WebSocketAdmin',
      component: () => import('@/views/WebSocketAdmin.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: 'WebSocket 遷移管理'
      }
    },
    {
      path: '/monitoring/websocket',
      name: 'WebSocketMonitoring',
      component: () => import('@/views/WebSocketMonitoring.vue'),
      meta: {
        requiresAuth: true,
        title: 'WebSocket 性能監控'
      }
    },
    // ==================== 客戶管理路由 ====================
    {
      path: '/customers/tags',
      name: 'CustomerTags',
      component: () => import('@/views/CustomerTags.vue'),
      meta: {
        requiresAuth: true,
        title: '標籤管理'
      }
    },
    // ==================== 通知系統路由 ====================
    {
      path: '/notifications',
      name: 'NotificationList',
      component: () => import('@/views/NotificationList.vue'),
      meta: {
        requiresAuth: true,
        title: '通知中心'
      }
    },
    // ==================== 資料管理路由 ====================
    {
      path: '/data',
      component: () => import('@/views/DataManagement.vue'),
      meta: {
        requiresAuth: true,
        title: '資料管理'
      },
      children: [
        {
          path: '',
          redirect: '/data/export'
        },
        {
          path: 'export',
          name: 'DataExport',
          component: () => import('@/components/data-management/DataExport.vue'),
          meta: {
            requiresAuth: true,
            title: '匯出對話記錄'
          }
        }
      ]
    },
    // ==================== 報表系統路由 (嵌套結構 - 獨層 Sidebar) ====================
    {
      path: '/reports',
      component: () => import('@/views/Reports.vue'),
      meta: {
        requiresAuth: true,
        title: '報表系統'
      },
      children: [
        {
          path: '',
          redirect: '/reports/dashboard'
        },
        {
          path: 'dashboard',
          name: 'ReportsDashboard',
          component: () => import('@/components/reports/ReportDashboard.vue'),
          meta: {
            requiresAuth: true,
            title: '報表儀表板'
          }
        },
        {
          path: 'templates',
          name: 'ReportTemplates',
          component: () => import('@/components/reports/ReportTemplates.vue'),
          meta: {
            requiresAuth: true,
            title: '報表模板'
          }
        },
        {
          path: 'generate',
          name: 'ReportGenerator',
          component: () => import('@/components/reports/ReportGenerator.vue'),
          meta: {
            requiresAuth: true,
            title: '生成報表'
          }
        },
        {
          path: 'export',
          redirect: '/data/export'
        },
        {
          path: ':id',
          name: 'ReportViewer',
          component: () => import('@/components/reports/ReportViewer.vue'),
          meta: {
            requiresAuth: true,
            title: '檢視報表'
          }
        }
      ]
    },
    // ==================== 自動回覆路由 ====================
    {
      path: '/auto-reply',
      name: 'AutoReply',
      component: () => import('@/views/AutoReply.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: '自動回覆'
      }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/NotFound.vue'),
      meta: {
        title: '頁面不存在'
      }
    }
  ]
})

// FIX Phase 1: Auth state cache to reduce navigation delay
interface AuthCache {
  isAuthenticated: boolean
  requiresAuth: boolean
  timestamp: number
}

let authStateCache: AuthCache | null = null
const AUTH_CACHE_TTL = 5000 // 5 seconds cache validity

// Invalidate auth cache when auth state changes (e.g., logout)
// Uses custom event to avoid circular dependency: router -> authGuard -> authStore -> router
if (typeof window !== 'undefined') {
  window.addEventListener('auth:state-changed', () => {
    authStateCache = null
  })
}

router.beforeEach(async (to, from, next) => {
  // 簡化的調試日誌
  frontendLogger.debug(' Navigation:', from.path, '->', to.path)

  // Set page title immediately (no delay)
  if (to.meta.title) {
    document.title = `${to.meta.title} - Multi-Channel Support`
  } else {
    document.title = 'Multi-Channel Support'
  }

  // 防止重複循環 - 如果已在目標路徑則直接允許
  if (to.path === from.path) {
    frontendLogger.debug(' Same path navigation detected, allowing...')
    next()
    return
  }

  // FIX Phase 1: Use cached auth state if available and fresh
  const now = Date.now()
  const requiresAuth = to.meta.requiresAuth !== false // Default to true

  if (authStateCache && (now - authStateCache.timestamp) < AUTH_CACHE_TTL) {
    // Cache is fresh
    if (!requiresAuth) {
      // Public route - allow immediately
      frontendLogger.debug('[Router Cache] Public route, allowing...')
      next()
      return
    }

    if (authStateCache.isAuthenticated && authStateCache.requiresAuth) {
      // User was authenticated recently - allow immediately
      frontendLogger.debug('[Router Cache] Using cached auth state, allowing...')
      next()
      return
    }
  }

  // Use combined auth guard for all authentication logic
  try {
    const isAuthenticated = await combinedAuthGuard(to, from, next)

    // Update cache with ACTUAL auth state from guard (not hardcoded true)
    authStateCache = {
      isAuthenticated,
      requiresAuth,
      timestamp: now
    }
  } catch (error) {
    console.error('Router guard error:', error)

    // FIX Phase 1: Cache the failed state
    authStateCache = {
      isAuthenticated: false,
      requiresAuth,
      timestamp: now
    }

    // 確保即使出錯也能繼續導航
    next()
  }
})

// Handle navigation completion
router.afterEach((to, from) => {
  frontendLogger.debug(' Navigation completed:', from.path, '->', to.path)
})

// Handle navigation errors
router.onError((error) => {
  console.error(' Router error:', error)
})

export default router