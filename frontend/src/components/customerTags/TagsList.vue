<template>
  <div class="tags-section">
    <!-- Empty State -->
    <div
      v-if="tags.length === 0 && !loading"
      class="empty-state"
    >
      <div class="empty-icon">
        <TagIcon />
      </div>
      <h3 class="empty-title">
        暫無標籤
      </h3>
      <p class="empty-description">
        點擊「新增標籤」開始創建您的第一個標籤
      </p>
    </div>

    <!-- Tags Grid -->
    <div
      v-else
      class="tags-grid"
    >
      <TagCard
        v-for="tag in tags"
        :key="tag.id"
        :tag="tag"
        :is-selected="isSelected(tag.id)"
        @select="$emit('select-tag', tag.id)"
        @edit="$emit('edit-tag', tag)"
        @delete="$emit('delete-tag', tag)"
        @view-stats="$emit('view-stats', tag)"
        @view-conversations="$emit('view-conversations', tag)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { TagIcon } from '@/components/icons'
import TagCard from './TagCard.vue'
import type { Tag } from '@/types/tag'

defineProps<{
  tags: Tag[]
  loading: boolean
  isSelected: (_id: number) => boolean
}>()

defineEmits<{
  'select-tag': [id: number]
  'edit-tag': [tag: Tag]
  'delete-tag': [tag: Tag]
  'view-stats': [tag: Tag]
  'view-conversations': [tag: Tag]
}>()
</script>

<style scoped>
.tags-section {
  min-height: 400px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  background: var(--gray-100);
  border-radius: var(--radius-full);
  color: var(--gray-400);
  margin-bottom: var(--space-6);
}

.empty-icon svg {
  width: 48px;
  height: 48px;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.empty-description {
  color: var(--gray-500);
  margin: 0;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(280px, 25vw, 320px), 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
}

@media (max-width: 768px) {
  .tags-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
}

@media (max-width: 480px) {
  .tags-grid {
    grid-template-columns: 1fr;
  }
}
</style>
