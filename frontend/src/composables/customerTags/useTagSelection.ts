/**
 * Tag Selection Composable
 *
 * Manages bulk tag selection for batch operations.
 * Handles selection toggle, clear, and selection state.
 *
 * @module composables/customerTags/useTagSelection
 */

import { ref, computed } from 'vue'

/**
 * Bulk tag selection management
 *
 * Features:
 * - Multi-select support
 * - Selection state tracking
 * - Bulk action readiness
 *
 * @returns Selection state and methods
 */
export function useTagSelection() {
  // ==================== State ====================

  const selectedTags = ref<number[]>([])

  // ==================== Computed ====================

  /**
   * Check if any tags are selected
   */
  const hasSelection = computed(() => selectedTags.value.length > 0)

  /**
   * Get count of selected tags
   */
  const selectionCount = computed(() => selectedTags.value.length)

  /**
   * Check if specific tag is selected
   */
  const isTagSelected = (tagId: number): boolean => {
    return selectedTags.value.includes(tagId)
  }

  // ==================== Methods ====================

  /**
   * Toggle tag selection
   * Adds tag if not selected, removes if already selected
   *
   * @param tagId - Tag ID to toggle
   */
  const toggleTagSelection = (tagId: number) => {
    const index = selectedTags.value.indexOf(tagId)
    if (index > -1) {
      // Already selected - remove it
      selectedTags.value.splice(index, 1)
      console.log(`🔄 [TagSelection] Deselected tag ${tagId}. Total: ${selectedTags.value.length}`)
    } else {
      // Not selected - add it
      selectedTags.value.push(tagId)
      console.log(`✅ [TagSelection] Selected tag ${tagId}. Total: ${selectedTags.value.length}`)
    }
  }

  /**
   * Clear all selections
   */
  const clearSelection = () => {
    const count = selectedTags.value.length
    selectedTags.value = []
    console.log(`🧹 [TagSelection] Cleared ${count} selections`)
  }

  /**
   * Select multiple tags at once
   *
   * @param tagIds - Array of tag IDs to select
   */
  const selectTags = (tagIds: number[]) => {
    selectedTags.value = [...tagIds]
    console.log(`📋 [TagSelection] Selected ${tagIds.length} tags`)
  }

  /**
   * Select all tags
   *
   * @param allTagIds - Array of all available tag IDs
   */
  const selectAll = (allTagIds: number[]) => {
    selectedTags.value = [...allTagIds]
    console.log(`📋 [TagSelection] Selected all ${allTagIds.length} tags`)
  }

  // ==================== Return Interface ====================

  return {
    // State
    selectedTags,
    hasSelection,
    selectionCount,

    // Methods
    isTagSelected,
    toggleTagSelection,
    clearSelection,
    selectTags,
    selectAll
  }
}
