import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('debugauth')
// Debug utility to check auth data flow
export function debugAuthData() {
  frontendLogger.debug('=== AUTH DEBUG START ===')
  
  // 1. Check localStorage
  frontendLogger.debug('1. localStorage contents:')
  const token = localStorage.getItem('token')
  const refreshToken = localStorage.getItem('refreshToken')
  const sessionExpiry = localStorage.getItem('sessionExpiry')
  
  frontendLogger.debug('  - token exists:', !!token)
  frontendLogger.debug('  - refreshToken exists:', !!refreshToken)
  frontendLogger.debug('  - sessionExpiry:', sessionExpiry)
  
  // 2. Decode JWT token (without verification)
  if (token) {
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1] || ''))
        frontendLogger.debug('2. JWT Token payload:')
        frontendLogger.debug('  - userId:', payload.userId)
        frontendLogger.debug('  - username:', payload.username)
        frontendLogger.debug('  - displayName:', payload.displayName)
        frontendLogger.debug('  - email:', payload.email)
        frontendLogger.debug('  - role:', payload.role)
        frontendLogger.debug('  - Full payload:', payload)
      }
    } catch (e) {
      console.error('Failed to decode token:', e)
    }
  }
  
  // 3. Check auth store
  import('@/stores/auth').then(({ useAuthStore }) => {
    const authStore = useAuthStore()
    frontendLogger.debug('3. Auth Store state:')
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