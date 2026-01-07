<template>
  <Modal
    :show="visible && !!tag"
    size="sm"
    :show-header="false"
    @close="$emit('update:visible', false)"
  >
    <!-- Warning Content -->
    <div class="warning-content">
      <div class="warning-icon">
        <AlertTriangleIcon />
      </div>
      <h2 class="warning-title">
        確認刪除標籤
      </h2>
      <p class="warning-text">
        您確定要刪除標籤 <strong>「{{ tag?.name }}」</strong> 嗎？
      </p>
      <p class="warning-subtext">
        此操作無法復原。該標籤將從所有相關的客戶和對話中移除。
      </p>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <button
        class="btn btn-secondary"
        @click="$emit('update:visible', false)"
      >
        取消
      </button>
      <button
        class="btn btn-danger"
        @click="$emit('confirm')"
      >
        確認刪除
      </button>
    </template>
  </Modal>
</template>

/**
 * DeleteConfirmModal - Single Tag Deletion Confirmation Modal
 *
 * @component
 * @description Simple confirmation dialog for single tag deletion:
 * - **Tag name display** - Shows specific tag being deleted
 * - **Warning message** - Clear irreversible action warning
 * - **Minimal design** - Focused confirmation without distractions
 *
 * @example Basic Usage
 * ```vue
 * <template>
 *   <DeleteConfirmModal
 *     v-model:visible="showDeleteModal"
 *     :tag="tagToDelete"
 *     @confirm="handleDelete"
 *   />
 * </template>
 *
 * <script setup>
 * const tagToDelete = ref(null)
 * const showDeleteModal = ref(false)
 *
 * const confirmDelete = (tag) => {
 *   tagToDelete.value = tag
 *   showDeleteModal.value = true
 * }
 *
 * const handleDelete = async () => {
 *   await tagApi.delete(tagToDelete.value.id)
 *   showDeleteModal.value = false
 * }
 * </script>
 * ```
 *
 * Props:
 * - **visible** - Modal visibility (supports v-model)
 * - **tag** - Tag object to delete (can be null)
 *
 * Events:
 * - **update:visible** - Visibility changed (for v-model support)
 * - **confirm** - User confirmed deletion
 *
 * Features:
 * - **Null-safe** - Modal only renders when tag is not null
 * - **Name highlighting** - Tag name shown in bold red
 * - **Warning icon** - Red alert triangle
 * - **Simple actions** - Cancel and confirm buttons only
 *
 * @see {@link frontend/src/views/CustomerTags.vue} for usage context
 */

<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue'
import { AlertTriangleIcon } from '@/components/icons'
import type { Tag } from '@/types/tag'

defineProps<{
  /** Modal visibility state */
  visible: boolean

  /** Tag to delete (null-safe) */
  tag: Tag | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()
</script>

<style scoped>
.warning-content {
  text-align: center;
  padding: var(--space-2) 0;
}

.warning-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--red-100);
  border-radius: var(--radius-full);
  color: var(--red-600);
  margin-bottom: var(--space-4);
}

.warning-icon svg {
  width: 32px;
  height: 32px;
}

.warning-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 var(--space-4);
  color: var(--red-700);
}

.warning-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.warning-text strong {
  color: var(--red-600);
}

.warning-subtext {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0;
  line-height: 1.5;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-danger {
  background: var(--red-500);
  color: white;
}

.btn-danger:hover {
  background: var(--red-600);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}
</style>
