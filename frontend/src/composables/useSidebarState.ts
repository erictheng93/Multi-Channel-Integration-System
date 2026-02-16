/**
 * Singleton composable for sidebar reactive state and resize logic.
 *
 * Uses module-level state so all callers share the same refs.
 * Pattern matches useConfirmDialog.ts singleton approach.
 */
import { shallowRef, ref } from 'vue'

// ── Module-level singleton state (shared across all callers) ──
const sidebarCollapsed = shallowRef(false)
const isAutoCollapsed = ref(false)
const showMobileMenu = shallowRef(false)
const isMobile = shallowRef(false)

let resizeTimeout: ReturnType<typeof setTimeout>
let initialized = false

/**
 * Debounced resize handler.
 * Determines mobile vs desktop state and auto-collapses sidebar on medium screens.
 */
function handleResize() {
  clearTimeout(resizeTimeout)

  resizeTimeout = setTimeout(() => {
    const width = window.innerWidth
    const newIsMobile = width <= 768

    if (isMobile.value !== newIsMobile) {
      isMobile.value = newIsMobile
    }

    if (newIsMobile) {
      // On mobile, let showMobileMenu control visibility
      sidebarCollapsed.value = false
      isAutoCollapsed.value = false
    } else {
      if (width >= 1025) {
        // Large screens: restore from auto-collapse
        if (isAutoCollapsed.value) {
          sidebarCollapsed.value = false
          isAutoCollapsed.value = false
        }
      } else {
        // Medium screens (769-1024): auto-collapse
        if (!sidebarCollapsed.value || isAutoCollapsed.value) {
          sidebarCollapsed.value = true
          isAutoCollapsed.value = true
        }
      }
      showMobileMenu.value = false
    }
  }, 150)
}

function toggleSidebar() {
  if (isMobile.value) {
    showMobileMenu.value = !showMobileMenu.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
    isAutoCollapsed.value = false
  }
}

/**
 * Call from onMounted to start listening for resize events.
 * Safe to call multiple times; only attaches listener once.
 */
function initialize() {
  if (initialized) {
    return
  }
  initialized = true
  window.addEventListener('resize', handleResize)
  handleResize() // Initial size check
}

/**
 * Call from onUnmounted to clean up the resize listener.
 */
function cleanup() {
  if (!initialized) {
    return
  }
  initialized = false
  window.removeEventListener('resize', handleResize)
  clearTimeout(resizeTimeout)
}

export function useSidebarState() {
  return {
    sidebarCollapsed,
    isAutoCollapsed,
    showMobileMenu,
    isMobile,
    toggleSidebar,
    initialize,
    cleanup,
  }
}
