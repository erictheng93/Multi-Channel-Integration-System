import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from './useAuth'

export function useAccountStatusMonitor() {
  const { currentAgent } = useAuth()
  const showDisabledModal = ref(false)

  const handleAccountDisabled = (event: CustomEvent) => {
    const { memberId } = event.detail
    
    // 檢查是否是當前用戶被停權
    if (currentAgent.value && currentAgent.value.id === memberId) {
      console.log('🚫 Current user account has been disabled')
      showDisabledModal.value = true
    }
  }

  const handleUserDisabled = (event: Event) => {
    if (event instanceof CustomEvent) {
      handleAccountDisabled(event)
    }
  }

  const hideDisabledModal = () => {
    showDisabledModal.value = false
  }

  onMounted(() => {
    // 監聽全局賬戶停權事件
    window.addEventListener('user-account-disabled', handleUserDisabled)
  })

  onUnmounted(() => {
    window.removeEventListener('user-account-disabled', handleUserDisabled)
  })

  return {
    showDisabledModal,
    hideDisabledModal
  }
}