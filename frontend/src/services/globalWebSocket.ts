// Global WebSocket Service
// Provides app-wide WebSocket connection that initializes after authentication
// Project: Multi-Channel Support MVP

import { ref, watch } from 'vue'
import { getWebSocketManager } from './websocketManager'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { Notification } from '@/api/notifications'

// Singleton state
const isInitialized = ref(false)
const isConnecting = ref(false)
const connectionError = ref<string | null>(null)
const retryCount = ref(0)
const maxRetries = 3
const retryDelay = 5000 // 5 seconds

/**
 * Setup notification event handler
 * Connects WebSocket notification events to the notifications store
 */
function setupNotificationEventHandler(manager: ReturnType<typeof getWebSocketManager>): void {
  try {
    const notificationsStore = useNotificationsStore()

    manager.setEventCallbacks({
      onNotification: (notificationData: unknown) => {
        try {
          // Handle notification event from WebSocket
          // The data structure from backend: { notification: {...} }
          const data = notificationData as { notification?: Partial<Notification> }

          if (data?.notification) {
            const notification = data.notification

            // Convert to full Notification object
            const fullNotification: Notification = {
              id: notification.id || crypto.randomUUID(),
              userId: notification.userId || 0,
              type: notification.type || 'system',
              title: notification.title || '新通知',
              content: notification.content || '',
              data: notification.data || {},
              priority: notification.priority || 'normal',
              isRead: false,
              readAt: undefined,
              expiresAt: notification.expiresAt,
              createdAt: notification.createdAt || new Date().toISOString()
            }

            // Add to notifications store for immediate UI update
            notificationsStore.addNotification(fullNotification)

            console.log('🔔 [GlobalWebSocket] Real-time notification received:', {
              id: fullNotification.id,
              type: fullNotification.type,
              title: fullNotification.title
            })
          }
        } catch (error) {
          console.error('[GlobalWebSocket] Error processing notification:', error)
        }
      }
    })

    console.log('[GlobalWebSocket] Notification event handler setup complete')
  } catch (error) {
    console.error('[GlobalWebSocket] Failed to setup notification handler:', error)
  }
}

/**
 * Initialize global WebSocket connection
 * Should be called once after app startup and authentication
 */
export async function initializeGlobalWebSocket(): Promise<boolean> {
  const authStore = useAuthStore()

  // Don't initialize if not authenticated
  if (!authStore.isAuthenticated || !authStore.token) {
    console.log('[GlobalWebSocket] Not authenticated, skipping initialization')
    return false
  }

  // Don't initialize if already connecting or initialized
  if (isConnecting.value) {
    console.log('[GlobalWebSocket] Already connecting, skipping')
    return false
  }

  isConnecting.value = true
  connectionError.value = null

  try {
    console.log('[GlobalWebSocket] Initializing global WebSocket connection...')

    const manager = getWebSocketManager()

    // Check if already connected
    if (manager.isConnected.value) {
      console.log('[GlobalWebSocket] Already connected')
      isInitialized.value = true
      isConnecting.value = false
      return true
    }

    await manager.connect()

    // 🔔 Setup notification event handler to push real-time notifications to store
    setupNotificationEventHandler(manager)

    isInitialized.value = true
    retryCount.value = 0
    console.log('[GlobalWebSocket] Successfully connected')

    return true

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    connectionError.value = errorMessage
    console.error('[GlobalWebSocket] Connection failed:', errorMessage)

    // Schedule retry if under max retries
    if (retryCount.value < maxRetries) {
      retryCount.value++
      console.log(`[GlobalWebSocket] Scheduling retry ${retryCount.value}/${maxRetries} in ${retryDelay}ms`)

      setTimeout(() => {
        isConnecting.value = false
        initializeGlobalWebSocket()
      }, retryDelay)
    } else {
      console.warn('[GlobalWebSocket] Max retries reached, WebSocket will initialize on demand')
    }

    return false

  } finally {
    isConnecting.value = false
  }
}

/**
 * Setup automatic WebSocket connection management
 * Watches authentication state and connects/disconnects accordingly
 */
export function setupGlobalWebSocketWatcher(): void {
  const authStore = useAuthStore()

  // Watch for authentication changes
  watch(
    () => authStore.isAuthenticated,
    async (isAuth, wasAuth) => {
      if (isAuth && !wasAuth) {
        // User just logged in - connect WebSocket
        console.log('[GlobalWebSocket] User authenticated, initializing WebSocket...')

        // Small delay to ensure token is properly stored
        setTimeout(async () => {
          await initializeGlobalWebSocket()
        }, 500)

      } else if (!isAuth && wasAuth) {
        // User logged out - disconnect WebSocket
        console.log('[GlobalWebSocket] User logged out, disconnecting WebSocket...')
        disconnectGlobalWebSocket()
      }
    },
    { immediate: false }
  )

  // If already authenticated when watcher is set up, initialize
  if (authStore.isAuthenticated && !isInitialized.value) {
    console.log('[GlobalWebSocket] Already authenticated, initializing WebSocket...')
    initializeGlobalWebSocket()
  }

  console.log('[GlobalWebSocket] Watcher setup complete')
}

/**
 * Disconnect global WebSocket
 */
export function disconnectGlobalWebSocket(): void {
  try {
    const manager = getWebSocketManager()
    manager.disconnect()
    isInitialized.value = false
    retryCount.value = 0
    connectionError.value = null
    console.log('[GlobalWebSocket] Disconnected')
  } catch (error) {
    console.error('[GlobalWebSocket] Error disconnecting:', error)
  }
}

/**
 * Get global WebSocket status
 */
export function getGlobalWebSocketStatus() {
  const manager = getWebSocketManager()

  return {
    isInitialized: isInitialized.value,
    isConnecting: isConnecting.value,
    isConnected: manager.isConnected.value,
    connectionState: manager.connectionState.value,
    connectionError: connectionError.value,
    retryCount: retryCount.value,
    stats: manager.stats.value
  }
}

/**
 * Force reconnect global WebSocket
 */
export async function reconnectGlobalWebSocket(): Promise<boolean> {
  console.log('[GlobalWebSocket] Force reconnecting...')

  disconnectGlobalWebSocket()

  // Brief delay before reconnecting
  await new Promise(resolve => setTimeout(resolve, 1000))

  retryCount.value = 0
  return initializeGlobalWebSocket()
}

// Export reactive state for components
export const globalWebSocketState = {
  isInitialized,
  isConnecting,
  connectionError,
  retryCount
}
