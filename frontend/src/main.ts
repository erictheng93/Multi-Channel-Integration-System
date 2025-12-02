import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/variables.css'
import './style.css'
import { useAuthStore } from '@/stores/auth'
import { i18n } from './plugins/i18n'

// 初始化安全配置
import { initializeSecurity } from '@/utils/securityInit'

// Service Worker 和 PWA 支援
import { swManager } from '@/services/serviceWorkerManager'

// 🚀 数据预加载服务
import { preloadService } from '@/services/preloadService'

// 🔌 Global WebSocket Service - Real-time communication
import { setupGlobalWebSocketWatcher, initializeGlobalWebSocket } from '@/services/globalWebSocket'

const startApp = async () => {
  const startTime = performance.now()

  try {
    // ⚡ LCP 優化：建立 Vue 應用實例 (最高優先級)
    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)
    app.use(router)
    app.use(i18n)

    // ⚡ LCP 優化：盡快掛載應用，讓骨架屏顯示
    // 這是關鍵的 LCP 優化 - 先渲染 UI，再初始化後台服務
    app.mount('#app')

    const mountTime = performance.now() - startTime
    console.log(`⚡ [LCP] App mounted in ${mountTime.toFixed(2)}ms`)

    // 🔧 關鍵修復：在應用掛載後初始化會話
    // 使用 requestIdleCallback 在瀏覽器空閒時執行，避免阻塞 LCP
    const initializePostMount = async () => {
      try {
        // 安全配置初始化（非阻塞）
        initializeSecurity()
          .then(() => console.log('✅ Security initialization completed'))
          .catch(err => console.warn('⚠️ Security initialization failed:', err))

        // 會話初始化 - 這需要同步完成以確保正確的認證狀態
        const authStore = useAuthStore()
        console.log('🏁 App startup: Initializing session...')
        await authStore.initializeSession()
        console.log(`✅ App startup: Session completed in ${(performance.now() - startTime).toFixed(2)}ms, status: ${authStore.sessionStatus}`)

        // 🔌 Global WebSocket: Setup watcher for auth state changes
        // This ensures WebSocket connects/disconnects with login/logout
        setupGlobalWebSocketWatcher()
        console.log('🔌 App startup: WebSocket watcher initialized')

        // 🔌 Global WebSocket: Initialize connection if already authenticated
        if (authStore.isAuthenticated) {
          console.log('🔌 App startup: User authenticated, initializing WebSocket...')
          initializeGlobalWebSocket().then(connected => {
            if (connected) {
              console.log(`✅ App startup: WebSocket connected in ${(performance.now() - startTime).toFixed(2)}ms`)
            } else {
              console.warn('⚠️ App startup: WebSocket connection deferred (will retry)')
            }
          }).catch(err => {
            console.warn('⚠️ App startup: WebSocket initialization failed (non-critical):', err)
          })
        }

        // 🚀 非阻塞預加載：僅對管理員用戶
        if (authStore.isAuthenticated && authStore.currentAgent?.role === 'admin') {
          console.log('🔥 App startup: Preloading data for admin user...')
          preloadService.warmup().catch(err => {
            console.warn('⚠️ App startup: Preload warmup failed (non-critical):', err)
          })
        }

        // Performance monitoring in development
        if (import.meta.env.DEV) {
          console.log('🚀 Performance monitoring enabled')
        }

        // 🚀 初始化 PWA 功能（低優先級）
        initializePWAFeatures().catch(err => {
          console.warn('⚠️ PWA initialization failed (non-critical):', err)
        })

      } catch (error) {
        console.error('❌ Post-mount initialization failed:', error)
      }
    }

    // 使用 requestIdleCallback 延遲非關鍵初始化
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => initializePostMount(), { timeout: 3000 })
    } else {
      // Fallback: 使用 setTimeout 延遲執行
      setTimeout(initializePostMount, 50)
    }

    console.log('✅ Application started successfully')
    
  } catch (error) {
    console.error('❌ Failed to start application:', error)
    
    // 更詳細的錯誤信息用於調試
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      env: import.meta.env
    })
    
    // 在生產環境中顯示用戶友好的錯誤消息
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
        <div style="text-align: center; padding: 2rem; border: 1px solid #e0e0e0; border-radius: 8px; background: #f9f9f9; max-width: 500px;">
          <h2 style="color: #d32f2f; margin-bottom: 1rem;">應用程式載入中...</h2>
          <p style="color: #666; margin-bottom: 1rem;">
            ${import.meta.env.PROD ? '請檢查您的網路連接並重新整理頁面' : `錯誤: ${errorMessage}`}
          </p>
          <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
            重新整理
          </button>
          <button onclick="console.log('Debug info:', { env: 'production', timestamp: ${Date.now()} })" style="padding: 0.5rem 1rem; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">
            查看詳情
          </button>
        </div>
      </div>
    `
  }
}

// PWA功能初始化
async function initializePWAFeatures() {
  try {
    console.log('🚀 [PWA] Initializing PWA features...')
    
    // 註冊 Service Worker
    const swRegistered = await swManager.register()
    
    if (swRegistered) {
      console.log('✅ [PWA] Service Worker registered successfully')
      
      // 檢查更新
      setTimeout(() => {
        swManager.update()
      }, 30000) // 30秒後檢查更新
      
      // 設置快取統計監控
      setInterval(async () => {
        try {
          await swManager.getCacheStats()
        } catch (_error) {
          // 靜默處理快取統計錯誤
        }
      }, 5 * 60 * 1000) // 每5分鐘更新一次
      
    } else {
      console.warn('⚠️ [PWA] Service Worker registration failed')
    }
    
    // 監聽 PWA 安裝提示
    if (swManager.installPromptEvent.value) {
      console.log('📱 [PWA] Install prompt is available')
    }
    
    // 離線功能初始化
    if (!navigator.onLine) {
      console.log('📡 [PWA] Starting in offline mode')
      // 可以在這裡顯示離線通知
    }
    
    // 設置推送通知（如果需要）
    if (import.meta.env.VITE_ENABLE_PUSH_NOTIFICATIONS === 'true') {
      try {
        const permission = await swManager.requestNotificationPermission()
        if (permission === 'granted') {
          console.log('🔔 [PWA] Push notifications enabled')
          // 可以在這裡訂閱推送
        }
      } catch (error) {
        console.warn('⚠️ [PWA] Push notifications setup failed:', error)
      }
    }
    
    console.log('🎉 [PWA] PWA features initialized successfully')
    
  } catch (error) {
    console.error('❌ [PWA] PWA initialization failed:', error)
    // PWA功能失敗不應該影響主應用運行
  }
}

// 啟動應用程式
startApp()