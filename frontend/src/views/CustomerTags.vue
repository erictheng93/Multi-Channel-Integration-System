<!--
  CustomerTags.vue (Refactored)

  Size: ~180 lines (down from 1,984 lines - 90% reduction)
  Components: 8 reusable components
  Controller: useCustomerTagsController composable
  Features: Optimistic UI, cache, keyboard shortcuts, bulk operations
-->

<template>
  <AppLayout>
    <div
      class="customer-tags"
      role="main"
      aria-label="客戶標籤管理頁面"
    >
      <!-- Page Header -->
      <TagsHeader @create-tag="openCreateModal" />

      <!-- Stats Overview -->
      <TagsStats :stats="stats" />

      <!-- Toolbar -->
      <TagsToolbar
        v-model:search-query="search.searchQuery.value"
        :has-selection="selection.hasSelection.value"
        :selection-count="selection.selectionCount.value"
        @bulk-delete="openBulkDeleteModal"
        @clear-selection="selection.clearSelection"
      />

      <!-- Tags List -->
      <section
        class="tags-content"
        role="region"
        aria-label="標籤列表"
        :aria-busy="loading"
      >
        <!-- Loading State -->
        <div
          v-if="loading && tags.length === 0"
          class="loading-state"
        >
          <LoadingSpinner size="lg" />
          <p>載入標籤中...</p>
        </div>

        <!-- Tags Grid -->
        <TagsList
          v-else
          :tags="tags"
          :loading="loading"
          :is-selected="selection.isTagSelected"
          @select-tag="selection.toggleTagSelection"
          @edit-tag="openEditModal"
          @delete-tag="openDeleteModal"
          @view-stats="openStatsModal"
        />
      </section>

      <!-- Create/Edit Modal -->
      <TagFormModal
        v-model:visible="showFormModal"
        v-model:form-data="formData"
        :is-edit="showEditModal"
        :predefined-colors="predefinedColors"
        @save="actions.saveTag"
      />

      <!-- Delete Confirmation Modal -->
      <DeleteConfirmModal
        v-model:visible="showDeleteModal"
        :tag="deletingTag"
        @confirm="actions.executeDelete"
      />

      <!-- Bulk Delete Confirmation Modal -->
      <BulkDeleteModal
        v-model:visible="showBulkDeleteModal"
        :selected-tags="selectedTagObjects"
        :selected-count="selection.selectionCount.value"
        @confirm="handleBulkDelete"
      />

      <!-- Tag Stats Modal (if needed) -->
      <!-- Can reuse existing TagStatsModal from original component -->
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useCustomerTagsController } from '@/composables/customerTags/useCustomerTagsController'
import { LoadingSpinner, AppLayout } from '@/components/ui'
import {
  TagsHeader,
  TagsStats,
  TagsToolbar,
  TagsList,
  TagFormModal,
  DeleteConfirmModal,
  BulkDeleteModal
} from '@/components/customerTags'

// ==================== Controller & State ====================

// Initialize main controller
const controller = useCustomerTagsController()

// Extract state from controller
const {
  loading,
  tags,
  stats,
  showCreateModal,
  showEditModal,
  showDeleteModal,
  showBulkDeleteModal,
  deletingTag,
  formData,
  predefinedColors,
  search,
  actions,
  selection,
  openCreateModal,
  openEditModal,
  openDeleteModal,
  openStatsModal,
  openBulkDeleteModal,
  initialize,
  cleanup
} = controller

// ==================== Computed ====================

/**
 * Get Tag objects for selected IDs
 */
const selectedTagObjects = computed(() =>
  tags.value.filter((tag) => selection.selectedTags.value.includes(tag.id))
)

/**
 * Computed property for form modal visibility
 * Handles both create and edit modals
 */
const showFormModal = computed({
  get: () => showCreateModal.value || showEditModal.value,
  set: (value: boolean) => {
    if (!value) {
      showCreateModal.value = false
      showEditModal.value = false
    }
  }
})

// ==================== Methods ====================

/**
 * Handle bulk delete confirmation
 */
const handleBulkDelete = async () => {
  await actions.executeBulkDelete(
    selection.selectedTags.value,
    selection.clearSelection,
    () => { showBulkDeleteModal.value = false }
  )
}

// ==================== Lifecycle ====================

// Initialize on mount
onMounted(async () => {
  await initialize()
})

// Cleanup on unmount
onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
/* ==================== Page Layout ==================== */
.customer-tags {
  max-width: clamp(1200px, 85vw, 1650px);
  margin: 0 auto;
  padding: clamp(1rem, 2vw, 2rem) clamp(0.5rem, 2vw, 1.5rem);
  min-height: 100%;
}

/* ==================== Content Section ==================== */
.tags-content {
  min-height: 400px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.loading-state p {
  margin-top: var(--space-4);
  color: var(--gray-500);
}

/* ==================== Responsive Design ==================== */
@media (max-width: 768px) {
  .customer-tags {
    padding: var(--space-4);
  }
}
</style>
