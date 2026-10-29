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
      class="ui-page customer-tags"
      role="main"
      aria-label="客戶標籤管理頁面"
    >
      <!-- Page Header -->
      <TagsHeader
        :total-tags="stats.totalTags"
        :total-conversations="stats.totalConversations"
        :unused-tag-names="unusedTagNames"
        @create-tag="openCreateModal"
      />

      <!-- Stats Overview -->
      <TagsStats :stats="stats" />

      <!-- Toolbar -->
      <TagsToolbar
        v-model:search-query="search.searchQuery.value"
        :has-selection="selection.hasSelection.value"
        :selection-count="selection.selectionCount.value"
        :is-searching="search.isSearching.value"
        :filtered-count="search.filteredTags.value.length"
        :total-count="stats.totalTags"
        @bulk-delete="openBulkDeleteModal"
        @clear-selection="selection.clearSelection"
      />

      <!-- Tags List + conversations side panel -->
      <section
        class="tags-layout"
        :class="{ 'has-panel': panelVisible }"
      >
        <div
          class="tags-content"
          role="region"
          aria-label="標籤列表"
          :aria-busy="loading"
        >
          <!-- Loading State -->
          <div
            v-if="loading && tags.length === 0"
            class="ui-card loading-state"
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
            :active-tag-id="isWide ? conversationsTag?.id ?? null : null"
            :is-searching="search.isSearching.value"
            @select-tag="selection.toggleTagSelection"
            @edit-tag="openEditModal"
            @delete-tag="openDeleteModal"
            @view-stats="openStatsModal"
            @view-conversations="openConversationsModal"
          />
        </div>

        <!-- Desktop: persistent side panel -->
        <aside
          v-if="panelVisible"
          class="tags-panel"
          aria-live="polite"
        >
          <TagConversationsModal
            :key="conversationsTag?.id"
            :visible="true"
            :tag="conversationsTag"
            inline
            @edit="editActiveTag"
            @delete="deleteActiveTag"
          />
        </aside>
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

      <!-- Tag Conversations Modal (tablet / phone; desktop uses the side panel) -->
      <TagConversationsModal
        :visible="showConversationsModal && !isWide"
        :tag="conversationsTag"
        @update:visible="showConversationsModal = $event"
        @edit="editActiveTag"
        @delete="deleteActiveTag"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCustomerTagsController } from '@/composables/customerTags/useCustomerTagsController'
import AppLayout from '@/components/ui/AppLayout.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import {
  TagsHeader,
  TagsStats,
  TagsToolbar,
  TagsList,
  TagFormModal,
  DeleteConfirmModal,
  BulkDeleteModal,
  TagConversationsModal
} from '@/components/customerTags'

// ==================== Controller & State ====================

// Initialize main controller
const controller = useCustomerTagsController()

// Extract state from controller
const {
  loading,
  tags,
  allTags,
  stats,
  showCreateModal,
  showEditModal,
  showDeleteModal,
  showBulkDeleteModal,
  showConversationsModal,
  deletingTag,
  conversationsTag,
  formData,
  predefinedColors,
  search,
  actions,
  selection,
  openCreateModal,
  openEditModal,
  openDeleteModal,
  openStatsModal,
  openConversationsModal,
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

const unusedTagNames = computed(() =>
  allTags.value.filter((tag) => !(tag.conversationCount || 0)).map((tag) => tag.name)
)

// Side panel on wide screens (> 1280px), modal below
const WIDE_QUERY = '(min-width: 1281px)'
const wideMql = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia(WIDE_QUERY)
  : null
const isWide = ref(wideMql?.matches ?? false)
const onWideChange = (event: { matches: boolean }) => {
  isWide.value = event.matches
  showConversationsModal.value = false
}
const panelVisible = computed(() => isWide.value && !!conversationsTag.value)

// Keep the panel's tag in sync with the loaded list: select the first used
// tag by default, and drop a tag that no longer exists.
watch(allTags, (list) => {
  if (!isWide.value) { return }
  const current = conversationsTag.value
  if (current) {
    const fresh = list.find((tag) => tag.id === current.id)
    if (!fresh) { conversationsTag.value = null }
    return
  }
  const first = list.find((tag) => (tag.conversationCount || 0) > 0) ?? list[0]
  if (first) { conversationsTag.value = first }
}, { immediate: true })

// ==================== Methods ====================

// Edit / delete from the detail panel or sheet (the sheet closes first on phones)
const editActiveTag = () => {
  const tag = conversationsTag.value
  if (!tag) { return }
  showConversationsModal.value = false
  openEditModal(tag)
}
const deleteActiveTag = () => {
  const tag = conversationsTag.value
  if (!tag) { return }
  showConversationsModal.value = false
  openDeleteModal(tag)
}

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
  wideMql?.addEventListener('change', onWideChange)
  await initialize()
})

// Cleanup on unmount
onUnmounted(() => {
  wideMql?.removeEventListener('change', onWideChange)
  cleanup()
})
</script>

<style scoped>
/* ==================== Page Layout ==================== */

/* ==================== Content Section ==================== */
.tags-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.tags-layout.has-panel {
  grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
}

.tags-panel {
  position: sticky;
  top: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  text-align: center;
}

.loading-state p {
  margin: 12px 0 0;
  font-size: 13.5px;
  color: var(--ui-muted);
}

/* ==================== Responsive Design ==================== */
@media (max-width: 768px) {
}
</style>
