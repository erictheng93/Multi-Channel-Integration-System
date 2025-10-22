import { createRouter, createWebHistory } from 'vue-router'
import { combinedAuthGuard } from '@/middleware/authGuard'

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
      component: () => import('@/views/ConversationDetail.vue'),
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
      path: '/invite/:token',
      name: 'InviteAcceptance',
      component: () => import('@/views/InviteAcceptance.vue'),
      meta: {
        requiresAuth: false,
        layout: 'blank',
        title: '接受邀請'
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
      name: 'SystemSettings',
      component: () => import('@/views/SystemSettings.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: '系統設定'
      }
    },
    {
      path: '/api-monitor',
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

router.beforeEach(async (to, from, next) => {
  // 簡化的調試日誌
  console.log('🔀 Navigation:', from.path, '->', to.path)
  
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} - Multi-Channel Support`
  } else {
    document.title = 'Multi-Channel Support'
  }
  
  // 防止重複循環 - 如果已在目標路徑則直接允許
  if (to.path === from.path) {
    console.log('⚠️ Same path navigation detected, allowing...')
    next()
    return
  }

  // Use combined auth guard for all authentication logic
  try {
    await combinedAuthGuard(to, from, next)
  } catch (error) {
    console.error('Router guard error:', error)
    // 確保即使出錯也能繼續導航
    next()
  }
})

// Handle navigation completion
router.afterEach((to, from) => {
  console.log('✅ Navigation completed:', from.path, '->', to.path)
})

// Handle navigation errors
router.onError((error) => {
  console.error('❌ Router error:', error)
})

export default router