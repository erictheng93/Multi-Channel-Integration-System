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
        title: '?�表板'
      }
    },
    {
      path: '/conversations',
      name: 'Conversations',
      component: () => import('@/views/ConversationsTable.vue'),  // 使用?��?表格?�本
      meta: { 
        requiresAuth: true,
        title: '對話管�?'
      }
    },
    {
      path: '/conversations/:id',
      name: 'ConversationDetail',
      component: () => import('@/views/ConversationDetail.vue'),
      meta: { 
        requiresAuth: true,
        title: '對話詳�?'
      }
    },
    {
      path: '/team',
      name: 'TeamManagement',
      component: () => import('@/views/TeamManagement.vue'),
      meta: { 
        requiresAuth: true,
        requiresAdmin: true,
        title: '?��?管�?'
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
        title: '活�?記�?'
      }
    },
    {
      path: '/settings',
      name: 'SystemSettings',
      component: () => import('@/views/SystemSettings.vue'),
      meta: { 
        requiresAuth: true,
        requiresAdmin: true,
        title: '系統設�?'
      }
    },
    {
      path: '/api-monitor',
      name: 'ApiMonitor',
      component: () => import('@/views/ApiMonitor.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: 'API??��'
      }
    },
    // ==================== WebSocket 管�?路由 ====================
    {
      path: '/admin/websocket',
      name: 'WebSocketAdmin',
      component: () => import('@/views/WebSocketAdmin.vue'),
      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        title: 'WebSocket ?�移管�?'
      }
    },
    {
      path: '/monitoring/websocket',
      name: 'WebSocketMonitoring',
      component: () => import('@/views/WebSocketMonitoring.vue'),
      meta: {
        requiresAuth: true,
        title: 'WebSocket ?��???��'
      }
    },
    // ==================== 客戶管�?路由 ====================
    {
      path: '/customers/tags',
      name: 'CustomerTags',
      component: () => import('@/views/CustomerTags.vue'),
      meta: {
        requiresAuth: true,
        title: '標籤管�?'
      }
    },
    // ==================== ?�表系統路由 (嵌�?結�? - ?�層 Sidebar) ====================
    {
      path: '/reports',
      component: () => import('@/views/Reports.vue'),
      meta: {
        requiresAuth: true,
        title: '?�表系統'
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
            title: '?�表?�表板'
          }
        },
        {
          path: 'templates',
          name: 'ReportTemplates',
          component: () => import('@/components/reports/ReportTemplates.vue'),
          meta: {
            requiresAuth: true,
            title: '?�表模板'
          }
        },
        {
          path: 'generate',
          name: 'ReportGenerator',
          component: () => import('@/components/reports/ReportGenerator.vue'),
          meta: {
            requiresAuth: true,
            title: '?��??�表'
          }
        },
        {
          path: ':id',
          name: 'ReportViewer',
          component: () => import('@/components/reports/ReportViewer.vue'),
          meta: {
            requiresAuth: true,
            title: '檢�??�表'
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
  // 簡�??�調試日�?
  console.log('?�� Navigation:', from.path, '->', to.path)
  
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} - Multi-Channel Support`
  } else {
    document.title = 'Multi-Channel Support'
  }
  
  // ?�止?��?循環 - 如�?已�??�目標路徑�??�接?�許
  if (to.path === from.path) {
    console.log('?��? Same path navigation detected, allowing...')
    next()
    return
  }
  
  // Use combined auth guard for all authentication logic
  try {
    await combinedAuthGuard(to, from, next)
  } catch (error) {
    console.error('Router guard error:', error)
    // 確�??�使?�錯也能繼�?導航
    next()
  }
})

// Handle navigation completion
router.afterEach((to, from) => {
  console.log('??Navigation completed:', from.path, '->', to.path)
})

// Handle navigation errors
router.onError((error) => {
  console.error('??Router error:', error)
})

export default router