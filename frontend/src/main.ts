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

const startApp = async () => {
  try {
    // 首先嘗試初始化安全配置，但不讓它阻止應用啟動
    try {
      await initializeSecurity()
      console.log('✅ Security initialization completed')
    } catch (securityError) {
      console.warn('⚠️ Security initialization failed, continuing with basic setup:', securityError)
    }
    
    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)
    app.use(router)
    app.use(i18n)

    // 初始化認證狀態
    const authStore = useAuthStore()
    
    // 🔧 ULTRA DEBUG FIX: 更謹慎的認證狀態初始化
    // 如果有 token 且會話有效且沒有錯誤狀態，才嘗試恢復用戶狀態
    if (authStore.token && authStore.validateSession() && !authStore.error && !authStore.loading) {
      try {
        console.log('🏁 App startup: Attempting to restore user session')
        await authStore.fetchCurrentAgent()
        console.log('✅ App startup: User session restored successfully')
      } catch (error) {
        console.warn('⚠️ App startup: Failed to fetch current agent, clearing auth state:', error)
        // 如果獲取用戶資料失敗，清理認證狀態但不重定向
        // 讓用戶在需要認證的頁面時自然被引導到登入頁面
        authStore.logout(false)
      }
    } else {
      console.log('🏁 App startup: Skipping session restore - invalid token or error state exists')
    }

    // Performance monitoring enabled in development
    if (import.meta.env.DEV) {
      console.log('🚀 Performance monitoring enabled')
    }

    app.mount('#app')
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

// 啟動應用程式
startApp()