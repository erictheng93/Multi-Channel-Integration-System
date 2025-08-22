import { ref, watch, onMounted } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const THEME_KEY = 'ui-theme'

export function useTheme() {
  const theme = ref<Theme>('system')
  const isDark = ref(false)
  const systemPrefersDark = ref(false)

  // Watch for system preference changes
  const mediaQuery = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

  const updateSystemPreference = () => {
    if (mediaQuery) {
      systemPrefersDark.value = mediaQuery.matches
    }
  }

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    if (newTheme === 'system') {
      isDark.value = systemPrefersDark.value
    } else {
      isDark.value = newTheme === 'dark'
    }

    // Apply theme to DOM
    if (isDark.value) {
      root.setAttribute('data-theme', 'dark')
      root.classList.add('dark')
    } else {
      root.setAttribute('data-theme', 'light')
      root.classList.remove('dark')
    }
  }

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
    applyTheme(newTheme)
    
    // Persist theme preference
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_KEY, newTheme)
    }
  }

  const toggleTheme = () => {
    if (theme.value === 'system') {
      setTheme(systemPrefersDark.value ? 'light' : 'dark')
    } else {
      setTheme(theme.value === 'dark' ? 'light' : 'dark')
    }
  }

  const initializeTheme = () => {
    // Get saved theme or default to system
    const savedTheme = (typeof window !== 'undefined' 
      ? localStorage.getItem(THEME_KEY) 
      : null) as Theme | null

    theme.value = savedTheme || 'system'
    
    // Initialize system preference
    updateSystemPreference()
    
    // Listen for system preference changes
    if (mediaQuery) {
      mediaQuery.addEventListener('change', updateSystemPreference)
    }
    
    // Apply initial theme
    applyTheme(theme.value)
  }

  // Watch for system preference changes and apply if using system theme
  watch(systemPrefersDark, () => {
    if (theme.value === 'system') {
      applyTheme('system')
    }
  })

  onMounted(() => {
    initializeTheme()
  })

  // Cleanup
  const cleanup = () => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', updateSystemPreference)
    }
  }

  return {
    theme,
    isDark,
    systemPrefersDark,
    setTheme,
    toggleTheme,
    cleanup
  }
}