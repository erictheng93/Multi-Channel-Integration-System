import { createLogger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'

const frontendLogger = createLogger('websocketdiagnostic')
/**
 * WebSocket 诊断工具
 * 用于检查 WebSocket 连接状态和实时更新是否正常工作
 */

/** Extended window properties for diagnostic runtime globals */
interface DiagnosticWindowProps {
  __ws_client?: {
    state?: string
    isConnected?: { value: boolean }
  }
  __sync_service?: {
    status?: { value: string }
    lastUpdate?: { value: string }
  }
  __pinia?: {
    stores?: {
      conversations?: {
        conversations?: Array<{ unreadCount?: number; [key: string]: unknown }>
      }
    }
  }
  diagnoseWebSocket?: typeof diagnoseWebSocket
}

const diagWindow = window as unknown as DiagnosticWindowProps

export function diagnoseWebSocket() {
  frontendLogger.debug(' ===== WebSocket 诊断开始 =====')

  // 1. 检查前端认证状态。HttpOnly cookie 无法从 JS 读取。
  const authStore = useAuthStore()
  frontendLogger.debug('1️ Auth State:', authStore.isAuthenticated ? ' 已认证' : ' 未认证')

  // 2. 检查全局 WebSocket 连接
  const ws = diagWindow.__ws_client
  frontendLogger.debug('2️ WebSocket Client:', ws ? ' 存在' : ' 未初始化')

  if (ws) {
    frontendLogger.debug(' - 连接状态:', ws.state || 'unknown')
    frontendLogger.debug(' - 是否已连接:', ws.isConnected?.value || false)
  }

  // 3. 检查 ConversationSync 服务
  const syncService = diagWindow.__sync_service
  frontendLogger.debug('3️ Sync Service:', syncService ? ' 存在' : ' 未初始化')

  if (syncService) {
    frontendLogger.debug(' - 同步状态:', syncService.status?.value || 'unknown')
    frontendLogger.debug(' - 最后更新:', syncService.lastUpdate?.value || 'never')
  }

  // 4. 检查 Pinia stores
  const conversationsStore = diagWindow.__pinia?.stores?.conversations
  frontendLogger.debug('4️ Conversations Store:', conversationsStore ? ' 存在' : ' 未初始化')

  if (conversationsStore) {
    const conversations = conversationsStore.conversations || []
    const totalUnread = conversations.reduce((sum: number, c: { unreadCount?: number }) => sum + (c.unreadCount || 0), 0)
    frontendLogger.debug(` - 对话总数: ${conversations.length}`)
    frontendLogger.debug(` - 未读消息总数: ${totalUnread}`)
    frontendLogger.debug(` - 有未读的对话:`, conversations.filter((c: { unreadCount?: number }) => (c.unreadCount ?? 0) > 0))
  }

  frontendLogger.debug(' ===== 诊断完成 =====')
  frontendLogger.debug(' 如果 WebSocket 未连接，请检查：')
  frontendLogger.debug(' 1. 是否已登录')
  frontendLogger.debug(' 2. 后端 WebSocket 服务是否正常')
  frontendLogger.debug(' 3. 浏览器控制台是否有错误信息')
}

// 添加到全局，方便在控制台调用
if (typeof window !== 'undefined') {
  diagWindow.diagnoseWebSocket = diagnoseWebSocket
}
