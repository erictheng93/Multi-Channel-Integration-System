/**
 * Tag Actions Composable
 *
 * Manages all CRUD operations for tags with optimistic UI updates and rollback.
 * Handles create, update, delete, and bulk delete operations.
 *
 * @module composables/customerTags/useTagActions
 */

import { type Ref, type ComputedRef } from 'vue'
import type { Tag } from '@/types/tag'
import { createTag, updateTag, deleteTag } from '@/api/tags'
import { tagCacheService } from '@/services/tagCacheService'

/**
 * Tag CRUD actions with optimistic UI updates
 *
 * Features:
 * - Optimistic UI updates for instant feedback
 * - Automatic rollback on API failure
 * - Duplicate name validation
 * - Bulk operations support
 * - Cache integration
 *
 * @param store - Tags Pinia store
 * @param tags - Computed tags array
 * @param formData - Form data ref
 * @param editingTag - Currently editing tag ref
 * @param deletingTag - Currently deleting tag ref
 * @param showSuccess - Success toast function
 * @param showError - Error toast function
 * @param closeModalsCallback - Callback to close modals
 * @param cancelDeleteCallback - Callback to cancel delete
 * @returns Action methods
 */
export function useTagActions(
  store: any,
  tags: ComputedRef<Tag[]>,
  formData: Ref<{ name: string; color: string; description: string }>,
  editingTag: Ref<Tag | null>,
  deletingTag: Ref<Tag | null>,
  showSuccess: (_title: string, _message?: string, _options?: any) => void,
  showError: (_title: string, _message?: string, _options?: any) => void,
  closeModalsCallback: () => void,
  cancelDeleteCallback: () => void
) {
  // ==================== Optimistic UI Helpers ====================

  let tempIdCounter = -1

  /**
   * Optimistically add tag to UI
   * Returns temporary ID for rollback
   */
  const optimisticAddTag = (tag: Tag): number => {
    const tempId = tempIdCounter--
    const newTag = { ...tag, id: tempId }
    store.tags.unshift(newTag)
    return tempId
  }

  /**
   * Optimistically update tag in UI
   * Returns old tag for rollback
   */
  const optimisticUpdateTag = (id: number, updates: Partial<Tag>): Tag | null => {
    const index = store.tags.findIndex((t: Tag) => t.id === id)
    if (index === -1) {return null}

    const oldTag: Tag = { ...store.tags[index] }
    store.tags[index] = { ...store.tags[index], ...updates }
    return oldTag
  }

  /**
   * Optimistically delete tag from UI
   * Returns deleted tag for rollback
   */
  const optimisticDeleteTag = (id: number): Tag | null => {
    const index = store.tags.findIndex((t: Tag) => t.id === id)
    if (index === -1) {return null}

    const deletedTag: Tag = store.tags[index]
    store.tags.splice(index, 1)
    return deletedTag
  }

  /**
   * Rollback optimistic add
   */
  const rollbackAddTag = (tempId: number) => {
    const index = store.tags.findIndex((t: Tag) => t.id === tempId)
    if (index !== -1) {
      store.tags.splice(index, 1)
    }
  }

  /**
   * Rollback optimistic update
   */
  const rollbackUpdateTag = (oldTag: Tag) => {
    const index = store.tags.findIndex((t: Tag) => t.id === oldTag.id)
    if (index !== -1) {
      store.tags[index] = oldTag
    }
  }

  /**
   * Rollback optimistic delete
   */
  const rollbackDeleteTag = (deletedTag: Tag) => {
    store.tags.push(deletedTag)
  }

  // ==================== Validation ====================

  /**
   * Check if tag name is duplicate
   */
  const isDuplicateName = (name: string, excludeId?: number): boolean => {
    const trimmedName = name.trim().toLowerCase()
    return tags.value.some(
      t => t.name.toLowerCase() === trimmedName && t.id !== excludeId
    )
  }

  // ==================== CRUD Actions ====================

  /**
   * Save tag (create or update)
   * Uses optimistic UI updates with rollback on failure
   */
  const saveTag = async () => {
    const isEdit = editingTag.value !== null
    const tagName = formData.value.name.trim()

    // Validation: Empty name
    if (!tagName) {
      showError('標籤名稱不能為空', '請輸入有效的標籤名稱')
      return
    }

    // Validation: Duplicate name
    if (isDuplicateName(tagName, editingTag.value?.id)) {
      showError(
        '標籤名稱已存在',
        `標籤「${tagName}」已經存在，請使用不同的名稱`,
        { duration: 4000 }
      )
      return
    }

    try {
      if (isEdit && editingTag.value) {
        // ===== Update Tag - Optimistic =====
        const tagId = editingTag.value.id
        const updateData = {
          name: formData.value.name,
          color: formData.value.color,
          description: formData.value.description || undefined
        }

        const oldTag = optimisticUpdateTag(tagId, {
          name: updateData.name,
          color: updateData.color,
          description: updateData.description || null,
          updatedAt: new Date().toISOString()
        })

        // Immediate success feedback
        showSuccess(
          '標籤更新成功',
          `成功更新標籤「${tagName}」`,
          { duration: 3000 }
        )
        closeModalsCallback()

        // Background verification
        try {
          const response = await updateTag(tagId, updateData)
          if (response.success && response.data) {
            tagCacheService.optimisticUpdateTag(response.data)
          }
          console.log('✅ [TagActions] Tag updated (verified):', tagName)
        } catch (error) {
          // Rollback on failure
          if (oldTag) {
            rollbackUpdateTag(oldTag)
          }
          showError('標籤更新失敗', '請檢查網路連線或稍後重試')
          console.error('❌ [TagActions] Failed to update tag:', error)
        }
      } else {
        // ===== Create Tag - Optimistic =====
        const createData = {
          name: formData.value.name,
          color: formData.value.color,
          description: formData.value.description || undefined
        }

        const newTag: Tag = {
          id: 0,
          name: createData.name,
          color: createData.color,
          description: createData.description || null,
          teamId: null,
          isActive: true,
          createdBy: 'current-user',
          customerCount: 0,
          conversationCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        const tempId = optimisticAddTag(newTag)

        // Immediate success feedback
        showSuccess(
          '標籤創建成功',
          `成功創建標籤「${tagName}」`,
          { duration: 3000 }
        )
        closeModalsCallback()

        // Background verification
        try {
          const response = await createTag(createData)
          if (response.success && response.data) {
            // Replace temp ID with real ID
            const index = store.tags.findIndex((t: Tag) => t.id === tempId)
            if (index !== -1) {
              store.tags[index] = response.data
            }
            tagCacheService.optimisticAddTag(response.data)
            console.log('✅ [TagActions] Tag created (verified):', tagName)
          }
        } catch (error) {
          // Rollback on failure
          rollbackAddTag(tempId)
          showError('標籤創建失敗', '請檢查網路連線或稍後重試')
          console.error('❌ [TagActions] Failed to create tag:', error)
        }
      }
    } catch (error) {
      console.error('❌ [TagActions] Unexpected error in saveTag:', error)
      showError(
        isEdit ? '標籤更新失敗' : '標籤創建失敗',
        '發生未預期的錯誤'
      )
    }
  }

  /**
   * Execute delete
   * Uses optimistic UI update with rollback on failure
   */
  const executeDelete = async () => {
    if (!deletingTag.value) {return}

    const tagToDelete = deletingTag.value
    const tagName = tagToDelete.name

    // Optimistic delete
    const deletedTag = optimisticDeleteTag(tagToDelete.id)

    // Immediate success feedback
    showSuccess(
      '標籤刪除成功',
      `成功刪除標籤「${tagName}」`,
      { duration: 3000 }
    )

    cancelDeleteCallback()

    // Background verification
    try {
      await deleteTag(tagToDelete.id)
      tagCacheService.optimisticRemoveTag(tagToDelete.id)
      console.log('✅ [TagActions] Tag deleted (verified):', tagName)
    } catch (error) {
      // Rollback on failure
      if (deletedTag) {
        rollbackDeleteTag(deletedTag)
      }
      showError('標籤刪除失敗', '請檢查網路連線或稍後重試')
      console.error('❌ [TagActions] Failed to delete tag:', error)
    }
  }

  /**
   * Execute bulk delete
   * Deletes multiple tags in parallel with optimistic UI updates
   */
  const executeBulkDelete = async (selectedTagIds: number[], clearSelectionCallback: () => void, closeBulkModalCallback: () => void) => {
    if (selectedTagIds.length === 0) {return}

    const tagIdsToDelete = [...selectedTagIds]
    const tagCount = tagIdsToDelete.length

    // Optimistic bulk delete
    const deletedTags = tagIdsToDelete.map(id => optimisticDeleteTag(id)).filter(Boolean) as Tag[]

    // Immediate success feedback
    showSuccess(
      '批量刪除成功',
      `成功刪除 ${tagCount} 個標籤`,
      { duration: 3000 }
    )

    closeBulkModalCallback()
    clearSelectionCallback()

    // Background verification - parallel delete
    try {
      const deletePromises = tagIdsToDelete.map(id => deleteTag(id))
      const results = await Promise.allSettled(deletePromises)

      // Check for failures
      const failedCount = results.filter(r => r.status === 'rejected').length

      if (failedCount > 0) {
        console.error(`❌ [TagActions] ${failedCount}/${tagCount} tags failed to delete`)
        showError(
          '批量刪除部分失敗',
          `${failedCount} 個標籤刪除失敗，請重試`
        )
        // Reload to ensure data consistency
        await store.fetchTags()
      } else {
        // Update cache - bulk remove
        tagIdsToDelete.forEach(id => tagCacheService.optimisticRemoveTag(id))
        console.log(`✅ [TagActions] ${tagCount} tags deleted successfully (verified)`)
      }
    } catch (error) {
      // Rollback all on complete failure
      deletedTags.forEach(tag => rollbackDeleteTag(tag))
      showError('批量刪除失敗', '請檢查網路連線或稍後重試')
      console.error('❌ [TagActions] Failed to bulk delete tags:', error)
    }
  }

  // ==================== Return Interface ====================

  return {
    saveTag,
    executeDelete,
    executeBulkDelete
  }
}
