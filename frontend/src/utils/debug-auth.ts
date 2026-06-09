import { createLogger } from '@/utils/logger'
import { getStoredAuthItem } from '@/utils/authStorage'

const frontendLogger = createLogger('debugauth')
// Debug utility to check auth data flow
export function debugAuthData() {
  frontendLogger.debug('=== AUTH DEBUG START ===')
  
  // 1. Check session-scoped auth storage
  frontendLogger.debug('1. auth storage contents:')
  const sessionExpiry = getStoredAuthItem('sessionExpiry')
  const currentAgent = getStoredAuthItem('currentAgent')
  
  frontendLogger.debug('  - sessionExpiry:', sessionExpiry)
  frontendLogger.debug('  - currentAgent exists:', !!currentAgent)
  
  // 2. Check auth store
  import('@/stores/auth').then(({ useAuthStore }) => {
    const authStore = useAuthStore()
    frontendLogger.debug('2. Auth Store state:')
    frontendLogger.debug('  - currentAgent:', authStore.currentAgent)
    if (authStore.currentAgent) {
      frontendLogger.debug(' - id:', authStore.currentAgent.id)
      frontendLogger.debug(' - email:', authStore.currentAgent.email)
      frontendLogger.debug(' - name:', authStore.currentAgent.name)
      frontendLogger.debug(' - displayName:', authStore.currentAgent.displayName)
      frontendLogger.debug(' - role:', authStore.currentAgent.role)
    }
    frontendLogger.debug('  - isAuthenticated:', authStore.isAuthenticated)
  })
  
  frontendLogger.debug('=== AUTH DEBUG END ===')
}

// Auto-run in development
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).debugAuth = debugAuthData
  frontendLogger.debug('Debug auth available: run debugAuth() in console')
}
