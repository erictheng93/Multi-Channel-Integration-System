// 現代化認證 Composable
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useError } from './useError'

export function useAuth() {
  const authStore = useAuthStore()
  const router = useRouter()
  const { handleError } = useError()

  // 計算屬性
  const isAuthenticated = computed(() => !!authStore.token)
  const currentAgent = computed(() => authStore.currentAgent)
  const isAdmin = computed(() => authStore.currentAgent?.role === 'admin')
  const isAgent = computed(() => authStore.currentAgent?.role === 'agent')
  const loading = computed(() => authStore.loading)
  // 使用 authStore 的錯誤狀態而不是 useError 的錯誤狀態
  const error = computed(() => authStore.error)

  // 登入
  const login = async (credentials: { email: string; password: string }) => {
    // 使用 authStore 的 clearError 方法
    authStore.clearError()
    try {
      const result = await authStore.login(credentials)
      
      // 處理結果
      if (result === true) {
        return { success: true }
      } else if (typeof result === 'object' && result.mustChangePassword) {
        return {
          success: false,
          mustChangePassword: true,
          tempToken: result.tempToken,
          agent: result.agent
        }
      }
      
      return { success: false }
    } catch (err) {
      // authStore.login 已經處理了錯誤，不需要重複處理
      return { success: false }
    }
  }

  // 登出
  const logout = async () => {
    try {
      await authStore.logout()
      router.push('/login')
    } catch (err) {
      handleError(err)
    }
  }

  // 檢查權限
  const hasPermission = (permission: string) => {
    if (!currentAgent.value) {return false}
    if (currentAgent.value.role === 'admin') {return true}
    
    // 這裡可以擴展更複雜的權限邏輯
    const agentPermissions = ['view_conversations', 'send_messages', 'assign_conversations']
    return agentPermissions.includes(permission)
  }

  // 刷新用戶信息
  const refreshAgent = async () => {
    try {
      await authStore.fetchCurrentAgent()
    } catch (err) {
      handleError(err)
    }
  }

  return {
    // 狀態
    isAuthenticated,
    currentAgent,
    isAdmin,
    isAgent,
    loading,
    error,

    // 方法
    login,
    logout,
    hasPermission,
    refreshAgent,
    clearError: () => authStore.clearError()
  }
}