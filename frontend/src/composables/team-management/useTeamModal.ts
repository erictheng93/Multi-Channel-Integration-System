/**
 * useTeamModal Composable
 *
 * Extracted from TeamCard.vue (lines 245-339)
 * Manages modal visibility and edit mode state
 *
 * Features:
 * - Modal show/hide state management
 * - Edit mode toggle
 * - Lifecycle hooks for modal open/close events
 * - Clean separation of modal logic from component
 */

import { ref, type Ref } from 'vue'

export interface UseTeamModalReturn {
  /** Whether the modal is currently visible */
  showModal: Ref<boolean>

  /** Whether the modal is in edit mode */
  isEditing: Ref<boolean>

  /** Open the modal */
  openModal: () => void

  /** Close the modal */
  closeModal: () => void

  /** Start edit mode */
  startEdit: () => void

  /** Cancel edit mode */
  cancelEdit: () => void

  /** Register a callback to run when modal opens */
  onModalOpen: (callback: () => void | Promise<void>) => void

  /** Register a callback to run when modal closes */
  onModalClose: (callback: () => void | Promise<void>) => void
}

export function useTeamModal(): UseTeamModalReturn {
  const showModal = ref<boolean>(false) as Ref<boolean>
  const isEditing = ref<boolean>(false) as Ref<boolean>

  // Lifecycle callbacks
  let modalOpenCallbacks: Array<() => void | Promise<void>> = []
  let modalCloseCallbacks: Array<() => void | Promise<void>> = []

  /**
   * Open the modal and execute registered callbacks
   */
  const openModal = async () => {
    showModal.value = true
    isEditing.value = false

    // Execute all registered open callbacks
    for (const callback of modalOpenCallbacks) {
      await callback()
    }
  }

  /**
   * Close the modal and execute registered callbacks
   */
  const closeModal = async () => {
    showModal.value = false
    isEditing.value = false

    // Execute all registered close callbacks
    for (const callback of modalCloseCallbacks) {
      await callback()
    }
  }

  /**
   * Enter edit mode
   */
  const startEdit = () => {
    isEditing.value = true
  }

  /**
   * Exit edit mode without saving
   */
  const cancelEdit = () => {
    isEditing.value = false
  }

  /**
   * Register a callback to execute when modal opens
   */
  const onModalOpen = (callback: () => void | Promise<void>) => {
    modalOpenCallbacks.push(callback)
  }

  /**
   * Register a callback to execute when modal closes
   */
  const onModalClose = (callback: () => void | Promise<void>) => {
    modalCloseCallbacks.push(callback)
  }

  return {
    showModal,
    isEditing,
    openModal,
    closeModal,
    startEdit,
    cancelEdit,
    onModalOpen,
    onModalClose
  }
}
