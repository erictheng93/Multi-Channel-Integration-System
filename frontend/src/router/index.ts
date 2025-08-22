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
      component: () => import('@/views/Conversations.vue'),
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
  console.log('🚦 SUPER ULTRA DEBUG: Router navigation:', from.path, '->', to.path)
  console.log('  - Timestamp:', Date.now())
  console.log('  - From full route:', from)
  console.log('  - To full route:', to)
  console.log('  - Call stack:', new Error().stack)
  
  // 檢查是否是從登入頁面導航離開
  if (from.path === '/login') {
    console.log('🚨 NAVIGATION FROM LOGIN PAGE DETECTED!')
    console.log('  - Target path:', to.path)
    console.log('  - Navigation trigger stack:', new Error().stack)
    
    // 如果是導航到 dashboard，這可能是不當的重定向
    if (to.path === '/dashboard' || to.path === '/') {
      console.log('🔥 CRITICAL: Potential unwanted redirect from login to dashboard!')
    }
  }
  
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} - Multi-Channel Support`
  } else {
    document.title = 'Multi-Channel Support'
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