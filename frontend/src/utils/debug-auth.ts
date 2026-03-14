// Debug utility to check auth data flow
export function debugAuthData() {
  console.log('=== AUTH DEBUG START ===')
  
  // 1. Check localStorage
  console.log('1. localStorage contents:')
  const token = localStorage.getItem('token')
  const refreshToken = localStorage.getItem('refreshToken')
  const sessionExpiry = localStorage.getItem('sessionExpiry')
  
  console.log('  - token exists:', !!token)
  console.log('  - refreshToken exists:', !!refreshToken)
  console.log('  - sessionExpiry:', sessionExpiry)
  
  // 2. Decode JWT token (without verification)
  if (token) {
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1] || ''))
        console.log('2. JWT Token payload:')
        console.log('  - userId:', payload.userId)
        console.log('  - username:', payload.username)
        console.log('  - displayName:', payload.displayName)
        console.log('  - email:', payload.email)
        console.log('  - role:', payload.role)
        console.log('  - Full payload:', payload)
      }
    } catch (e) {
      console.error('Failed to decode token:', e)
    }
  }
  
  // 3. Check auth store
  import('@/stores/auth').then(({ useAuthStore }) => {
    const authStore = useAuthStore()
    console.log('3. Auth Store state:')
    console.log('  - currentAgent:', authStore.currentAgent)
    if (authStore.currentAgent) {
      console.log(' - id:', authStore.currentAgent.id)
      console.log(' - email:', authStore.currentAgent.email)
      console.log(' - name:', authStore.currentAgent.name)
      console.log(' - displayName:', authStore.currentAgent.displayName)
      console.log(' - role:', authStore.currentAgent.role)
    }
    console.log('  - isAuthenticated:', authStore.isAuthenticated)
  })
  
  console.log('=== AUTH DEBUG END ===')
}

// Auto-run in development
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).debugAuth = debugAuthData
  console.log('Debug auth available: run debugAuth() in console')
}