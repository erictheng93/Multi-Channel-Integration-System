/**
 * Tag Keyboard Composable
 *
 * Manages keyboard shortcuts for tag operations.
 * Provides efficient keyboard navigation and actions.
 *
 * @module composables/customerTags/useTagKeyboard
 */

import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Keyboard shortcuts for tag management
 *
 * Shortcuts:
 * - Ctrl+N / Cmd+N: Create new tag
 * - Escape: Close modals/menus
 * - Ctrl+/ / Cmd+/: Focus search box
 *
 * @param showCreateModal - Create modal visibility ref
 * @param showEditModal - Edit modal visibility ref
 * @param showDeleteModal - Delete modal visibility ref
 * @param showBulkDeleteModal - Bulk delete modal visibility ref
 * @param showBulkMenu - Bulk menu visibility ref
 * @param closeModalsCallback - Callback to close edit/create modals
 * @param cancelDeleteCallback - Callback to cancel delete
 * @param cancelBulkDeleteCallback - Callback to cancel bulk delete
 * @returns Keyboard state and methods
 */
export function useTagKeyboard(
  showCreateModal: Ref<boolean>,
  showEditModal: Ref<boolean>,
  showDeleteModal: Ref<boolean>,
  showBulkDeleteModal: Ref<boolean>,
  showBulkMenu: Ref<boolean>,
  closeModalsCallback: () => void,
  cancelDeleteCallback: () => void,
  cancelBulkDeleteCallback: () => void
) {
  // ==================== Keyboard Handler ====================

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyboardShortcuts = (event: KeyboardEvent) => {
    // Ctrl+N or Cmd+N: Create new tag
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
      event.preventDefault()
      showCreateModal.value = true
      console.log('[TagKeyboard] Triggered: Create tag (Ctrl+N)')
      return
    }

    // Escape: Close modals
    if (event.key === 'Escape') {
      if (showCreateModal.value || showEditModal.value) {
        closeModalsCallback()
        console.log('[TagKeyboard] Triggered: Close create/edit modal (Escape)')
      } else if (showDeleteModal.value) {
        cancelDeleteCallback()
        console.log('[TagKeyboard] Triggered: Cancel delete (Escape)')
      } else if (showBulkDeleteModal.value) {
        cancelBulkDeleteCallback()
        console.log('[TagKeyboard] Triggered: Cancel bulk delete (Escape)')
      } else if (showBulkMenu.value) {
        showBulkMenu.value = false
        console.log('[TagKeyboard] Triggered: Close bulk menu (Escape)')
      }
      return
    }

    // Ctrl+/ or Cmd+/: Focus search box
    if ((event.ctrlKey || event.metaKey) && event.key === '/') {
      event.preventDefault()
      const searchInput = document.querySelector('.search-input') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
        console.log('[TagKeyboard] Triggered: Focus search (Ctrl+/)')
      }
      return
    }
  }

  // ==================== Lifecycle ====================

  /**
   * Initialize keyboard shortcuts
   */
  const initialize = () => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    console.log('[TagKeyboard] Keyboard shortcuts enabled')
    console.log(' - Ctrl+N: Create new tag')
    console.log(' - Escape: Close modals')
    console.log(' - Ctrl+/: Focus search')
  }

  /**
   * Cleanup keyboard shortcuts
   */
  const cleanup = () => {
    document.removeEventListener('keydown', handleKeyboardShortcuts)
    console.log('[TagKeyboard] Keyboard shortcuts disabled')
  }

  // Auto-initialize on mount
  onMounted(initialize)
  onUnmounted(cleanup)

  // ==================== Return Interface ====================

  return {
    handleKeyboardShortcuts,
    initialize,
    cleanup
  }
}
