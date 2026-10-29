<template>
  <div class="tags-section">
    <!-- Empty State -->
    <div
      v-if="tags.length === 0 && !loading"
      class="ui-card ui-empty"
    >
      <div class="ui-empty-art">
        <TagIcon />
      </div>
      <template v-if="isSearching">
        <h3>找不到符合的標籤</h3>
        <p>換個關鍵字，或直接新增這個標籤。</p>
      </template>
      <template v-else>
        <h3>暫無標籤</h3>
        <p>點擊「新增標籤」開始創建您的第一個標籤</p>
      </template>
    </div>

    <!-- Tags Grid (paginated) -->
    <template v-else>
      <div class="tags-grid">
        <TagCard
          v-for="tag in paginatedTags"
          :key="tag.id"
          :tag="tag"
          :is-selected="isSelected(tag.id)"
          :is-active="activeTagId === tag.id"
          :max-count="maxCount"
          @select="$emit('select-tag', tag.id)"
          @edit="$emit('edit-tag', tag)"
          @delete="$emit('delete-tag', tag)"
          @view-stats="$emit('view-stats', tag)"
          @view-conversations="$emit('view-conversations', tag)"
        />
      </div>

      <!-- Pagination Controls -->
      <PaginationControls
        :pagination="paginationInfo"
        :visible-pages="pagination.pageRange.value"
        @change-page="pagination.setPage"
      />
    </template>
  </div>
</template>


<script setup lang="ts">
import { computed, watch } from 'vue'
import { TagIcon } from '@/components/icons'
import TagCard from './TagCard.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import { usePagination } from '@/composables/usePagination'
import type { Tag } from '@/types/tag'

const props = defineProps<{
  tags: Tag[]
  loading: boolean
  isSelected: (_id: number) => boolean
  activeTagId?: number | null
  isSearching?: boolean
}>()

defineEmits<{
  'select-tag': [id: number]
  'edit-tag': [tag: Tag]
  'delete-tag': [tag: Tag]
  'view-stats': [tag: Tag]
  'view-conversations': [tag: Tag]
}>()

const PAGE_SIZE = 24

const maxCount = computed(() => props.tags.reduce((m, t) => Math.max(m, t.conversationCount || 0), 0))

// Pagination
const pagination = usePagination({ limit: PAGE_SIZE, total: props.tags.length })

const paginatedTags = computed(() => {
  return pagination.paginateData(props.tags)
})

const paginationInfo = computed(() => ({
  page: pagination.currentPage.value,
  pageSize: pagination.pageSize.value,
  total: pagination.total.value,
  totalPages: pagination.totalPages.value,
  hasNext: pagination.hasNext.value,
  hasPrev: pagination.hasPrev.value,
}))

// Sync total + reset page when tags change (e.g. search filter, data refresh)
watch(
  () => props.tags.length,
  (newLength) => {
    pagination.setTotal(newLength)
    pagination.setPage(1)
  }
)
</script>

<style scoped>
.tags-section {
  min-height: 120px;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

@media (max-width: 480px) {
  .tags-grid {
    grid-template-columns: 1fr;
  }
}
</style>
