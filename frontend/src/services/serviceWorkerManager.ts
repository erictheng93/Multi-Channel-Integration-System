// Service Worker 管理服務 - PWA核心功能
// 負責註冊、更新、通訊和離線功能管理

import { ref, type Ref } from 'vue'

// PWA 安装提示事件类型定义
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// 扩展 ServiceWorkerRegistration 以包含 Background Sync API
declare global {
  interface ServiceWorkerRegistration {
    sync?: {
      register(tag: string): Promise<void>
      getTags(): Promise<string[]>
    }
  }
}

// Service Worker 狀態類型
export type SWStatus = 'unsupported' | 'installing' | 'waiting' | 'active' | 'redundant' | 'error'

// 離線操作類型
interface OfflineAction {
  id: string
  type: string
  data: unknown
  timestamp: number
  retries: number
}

// Service Worker 消息類型
interface SWMessage {
  type: string
  payload?: unknown
  cacheNames?: string[]
}

// Service Worker 響應類型
interface SWResponse {
  data?: unknown
  error?: string
  hitRate?: number
}

// 快取更新數據類型
interface CacheUpdateData {
  cacheType?: string
  urls?: string[]
}

// 背景同步數據類型
interface BackgroundSyncData {
  tag?: string
  processedIds?: string[]
}

// 離線操作處理數據類型
interface OfflineActionProcessedData {
  actionId: string
  success: boolean
  error?: string
}

// Service Worker 管理配置
interface SWConfig {
  swUrl: string
  scope?: string
  updateCheckInterval: number
  maxOfflineActions: number
  enableBackgroundSync: boolean
  enablePushNotifications: boolean
}

const DEFAULT_CONFIG: SWConfig = {
  swUrl: '/sw.js',
  scope: '/',
  updateCheckInterval: 60 * 60 * 1000, // 1小時檢查一次更新
  maxOfflineActions: 100,
  enableBackgroundSync: true,
  enablePushNotifications: false
}

export class ServiceWorkerManager {
  private config: SWConfig
  private registration: ServiceWorkerRegistration | null = null
  private updateCheckTimer: NodeJS.Timeout | null = null
  private offlineActions: OfflineAction[] = []
  
  // 響應式狀態
  public status: Ref<SWStatus> = ref('unsupported')
  public isOnline: Ref<boolean> = ref(navigator.onLine)
  public updateAvailable: Ref<boolean> = ref(false)
  public installPromptEvent: Ref<BeforeInstallPromptEvent | null> = ref(null)
  
  // 統計資訊
  public stats = ref({
    cacheHitRate: 0,
    offlineActionsCount: 0,
    lastSyncTime: null as Date | null,
    backgroundSyncSupported: false,
    pushSupported: false
  })

  constructor(config?: Partial<SWConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.setupEventListeners()
  }

  // 註冊 Service Worker
  async register(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ [SWManager] Service Worker not supported')
      this.status.value = 'unsupported'
      return false
    }

    try {
      console.log('🚀 [SWManager] Registering Service Worker...')
      this.status.value = 'installing'

      this.registration = await navigator.serviceWorker.register(
        this.config.swUrl,
        { scope: this.config.scope }
      )

      console.log('✅ [SWManager] Service Worker registered successfully')
      
      // 設置更新監聽
      this.setupUpdateListeners()
      
      // 設置消息監聽
      this.setupMessageListeners()
      
      // 檢查功能支援
      this.checkFeatureSupport()
      
      // 開始定期檢查更新
      this.startUpdateCheck()
      
      // 恢復離線操作
      await this.restoreOfflineActions()
      
      this.status.value = 'active'
      return true
      
    } catch (error) {
      console.error('❌ [SWManager] Service Worker registration failed:', error)
      this.status.value = 'error'
      return false
    }
  }

  // 更新 Service Worker
  async update(): Promise<void> {
    if (!this.registration) {
      console.warn('⚠️ [SWManager] No registration found for update')
      return
    }

    try {
      console.log('🔄 [SWManager] Checking for updates...')
      await this.registration.update()
      
      if (this.registration.waiting) {
        console.log('⏳ [SWManager] Update found, waiting for activation')
        this.updateAvailable.value = true
      } else {
        console.log('✅ [SWManager] No updates available')
      }
    } catch (error) {
      console.error('❌ [SWManager] Update check failed:', error)
    }
  }

  // 激活等待中的更新
  async activateUpdate(): Promise<void> {
    if (!this.registration?.waiting) {
      console.warn('⚠️ [SWManager] No waiting service worker')
      return
    }

    try {
      console.log('🔄 [SWManager] Activating update...')
      
      // 發送跳過等待消息
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      
      // 等待激活
      await new Promise<void>((resolve) => {
        const handler = () => {
          resolve()
          navigator.serviceWorker.removeEventListener('controllerchange', handler)
        }
        navigator.serviceWorker.addEventListener('controllerchange', handler)
      })
      
      this.updateAvailable.value = false
      console.log('✅ [SWManager] Update activated, reloading...')
      
      // 重新載入頁面
      window.location.reload()
      
    } catch (error) {
      console.error('❌ [SWManager] Update activation failed:', error)
    }
  }

  // 發送消息到 Service Worker
  async sendMessage(message: SWMessage): Promise<SWResponse> {
    if (!navigator.serviceWorker.controller) {
      throw new Error('No active service worker')
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error))
        } else {
          resolve(event.data)
        }
      }

      const controller = navigator.serviceWorker.controller
      if (controller) {
        controller.postMessage(message, [messageChannel.port2])
      } else {
        reject(new Error('Service worker controller not available'))
      }
    })
  }

  // 添加離線操作到隊列
  addOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>): void {
    const offlineAction: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0
    }

    this.offlineActions.push(offlineAction)
    
    // 限制隊列大小
    if (this.offlineActions.length > this.config.maxOfflineActions) {
      this.offlineActions = this.offlineActions.slice(-this.config.maxOfflineActions)
    }
    
    // 持久化到 localStorage
    this.saveOfflineActions()
    
    // 更新統計
    this.stats.value.offlineActionsCount = this.offlineActions.length
    
    console.log(`📝 [SWManager] Added offline action: ${action.type}`)
    
    // 如果線上，立即嘗試同步
    if (this.isOnline.value) {
      this.requestBackgroundSync('offline-actions')
    }
  }

  // 請求背景同步
  async requestBackgroundSync(tag: string): Promise<void> {
    if (!this.registration?.sync || !this.config.enableBackgroundSync) {
      console.warn('⚠️ [SWManager] Background sync not supported')
      return
    }

    try {
      await this.registration.sync.register(tag)
      console.log(`🔄 [SWManager] Background sync requested: ${tag}`)
    } catch (error) {
      console.error(`❌ [SWManager] Background sync request failed: ${tag}`, error)
    }
  }

  // 請求推送通知權限
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('⚠️ [SWManager] Notifications not supported')
      return 'denied'
    }

    try {
      const permission = await Notification.requestPermission()
      console.log(`🔔 [SWManager] Notification permission: ${permission}`)
      return permission
    } catch (error) {
      console.error('❌ [SWManager] Notification permission request failed:', error)
      return 'denied'
    }
  }

  // 訂閱推送通知
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration || !this.config.enablePushNotifications) {
      return null
    }

    try {
      // 這裡需要 VAPID 公鑰，實際使用時替換
      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY'
      
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      })

      console.log('📱 [SWManager] Push subscription created')
      return subscription
    } catch (error) {
      console.error('❌ [SWManager] Push subscription failed:', error)
      return null
    }
  }

  // 獲取快取統計
  async getCacheStats(): Promise<SWResponse | null> {
    try {
      const stats = await this.sendMessage({ type: 'GET_CACHE_STATS' })
      this.stats.value.cacheHitRate = stats.hitRate || 0
      return stats
    } catch (error) {
      console.error('❌ [SWManager] Failed to get cache stats:', error)
      return null
    }
  }

  // 清理快取
  async clearCache(cacheNames?: string[]): Promise<void> {
    try {
      await this.sendMessage({ 
        type: 'CLEAR_CACHE', 
        cacheNames 
      })
      console.log('🧹 [SWManager] Cache cleared')
    } catch (error) {
      console.error('❌ [SWManager] Cache clear failed:', error)
    }
  }

  // 設置事件監聽器
  private setupEventListeners(): void {
    // 線上/離線狀態監聽
    window.addEventListener('online', () => {
      console.log('🌐 [SWManager] Connection restored')
      this.isOnline.value = true
      
      // 嘗試同步離線操作
      if (this.offlineActions.length > 0) {
        this.requestBackgroundSync('offline-actions')
      }
    })

    window.addEventListener('offline', () => {
      console.log('📡 [SWManager] Connection lost')
      this.isOnline.value = false
    })

    // PWA 安裝提示監聽
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      this.installPromptEvent.value = event as BeforeInstallPromptEvent
      console.log('📱 [SWManager] PWA install prompt available')
    })
  }

  // 設置更新監聽器
  private setupUpdateListeners(): void {
    if (!this.registration) {return}

    this.registration.addEventListener('updatefound', () => {
      console.log('🔄 [SWManager] New service worker found')
      
      const newWorker = this.registration?.installing
      if (!newWorker) {return}

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('⏳ [SWManager] New service worker installed, waiting for activation')
          this.updateAvailable.value = true
        }
      })
    })
  }

  // 設置消息監聽器
  private setupMessageListeners(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('📨 [SWManager] Message from SW:', event.data)
      
      switch (event.data.type) {
        case 'CACHE_UPDATED':
          this.handleCacheUpdate(event.data)
          break
        case 'BACKGROUND_SYNC_COMPLETE':
          this.handleBackgroundSyncComplete(event.data)
          break
        case 'OFFLINE_ACTION_PROCESSED':
          this.handleOfflineActionProcessed(event.data)
          break
      }
    })
  }

  // 檢查功能支援
  private checkFeatureSupport(): void {
    this.stats.value.backgroundSyncSupported = 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
    this.stats.value.pushSupported = 'serviceWorker' in navigator && 'PushManager' in window
    
    console.log('🔧 [SWManager] Feature support:', {
      backgroundSync: this.stats.value.backgroundSyncSupported,
      push: this.stats.value.pushSupported
    })
  }

  // 開始定期檢查更新
  private startUpdateCheck(): void {
    this.updateCheckTimer = setInterval(() => {
      this.update()
    }, this.config.updateCheckInterval)
  }

  // 處理快取更新
  private handleCacheUpdate(data: CacheUpdateData): void {
    console.log('💾 [SWManager] Cache updated:', data)
    // 可以觸發UI更新通知
  }

  // 處理背景同步完成
  private handleBackgroundSyncComplete(data: BackgroundSyncData): void {
    console.log('✅ [SWManager] Background sync completed:', data)
    this.stats.value.lastSyncTime = new Date()
    
    if (data.tag === 'offline-actions') {
      this.clearProcessedOfflineActions(data.processedIds || [])
    }
  }

  // 處理離線操作完成
  private handleOfflineActionProcessed(data: OfflineActionProcessedData): void {
    const { actionId, success } = data
    
    if (success) {
      this.offlineActions = this.offlineActions.filter(action => action.id !== actionId)
      this.saveOfflineActions()
      this.stats.value.offlineActionsCount = this.offlineActions.length
      
      console.log(`✅ [SWManager] Offline action processed: ${actionId}`)
    }
  }

  // 清理已處理的離線操作
  private clearProcessedOfflineActions(processedIds: string[]): void {
    const originalLength = this.offlineActions.length
    this.offlineActions = this.offlineActions.filter(action => !processedIds.includes(action.id))
    
    if (this.offlineActions.length !== originalLength) {
      this.saveOfflineActions()
      this.stats.value.offlineActionsCount = this.offlineActions.length
      console.log(`🧹 [SWManager] Cleared ${originalLength - this.offlineActions.length} processed actions`)
    }
  }

  // 保存離線操作到 localStorage
  private saveOfflineActions(): void {
    try {
      localStorage.setItem('sw_offline_actions', JSON.stringify(this.offlineActions))
    } catch (error) {
      console.warn('⚠️ [SWManager] Failed to save offline actions:', error)
    }
  }

  // 從 localStorage 恢復離線操作
  private async restoreOfflineActions(): Promise<void> {
    try {
      const stored = localStorage.getItem('sw_offline_actions')
      if (stored) {
        this.offlineActions = JSON.parse(stored)
        this.stats.value.offlineActionsCount = this.offlineActions.length
        
        if (this.offlineActions.length > 0) {
          console.log(`📥 [SWManager] Restored ${this.offlineActions.length} offline actions`)
          
          // 如果線上，立即同步
          if (this.isOnline.value) {
            await this.requestBackgroundSync('offline-actions')
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ [SWManager] Failed to restore offline actions:', error)
    }
  }

  // 工具函數：轉換 VAPID 密鑰
  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    
    return outputArray.buffer
  }

  // 清理資源
  destroy(): void {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer)
      this.updateCheckTimer = null
    }
  }

  // PWA安裝
  async promptInstall(): Promise<boolean> {
    if (!this.installPromptEvent.value) {
      console.warn('⚠️ [SWManager] No install prompt available')
      return false
    }

    try {
      this.installPromptEvent.value.prompt()
      const { outcome } = await this.installPromptEvent.value.userChoice
      
      console.log(`📱 [SWManager] Install prompt result: ${outcome}`)
      
      if (outcome === 'accepted') {
        this.installPromptEvent.value = null
        return true
      }
      
      return false
    } catch (error) {
      console.error('❌ [SWManager] Install prompt failed:', error)
      return false
    }
  }
}

// 創建單例實例
export const swManager = new ServiceWorkerManager()

// 自動註冊（可選）
if (import.meta.env.PROD) {
  swManager.register().then((success) => {
    if (success) {
      console.log('🎉 [SWManager] Service Worker ready for production')
    }
  })
}