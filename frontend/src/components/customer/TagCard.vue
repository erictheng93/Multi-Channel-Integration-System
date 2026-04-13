<template>
  <div
    class="tag-card"
    :class="{ 'selected': selected }"
    @click="handleCardClick"
  >
    <!-- Left: Tag Info -->
    <div class="tag-info">
      <div
        class="tag-checkbox-wrapper"
        @click.stop
      >
        <input
          type="checkbox"
          :checked="selected"
          class="tag-checkbox"
          @change="$emit('toggle-selection')"
        >
      </div>

      <div
        class="tag-color-badge"
        :style="{ backgroundColor: tag.color }"
      />

      <div class="tag-details">
        <div class="tag-header">
          <h3 class="tag-name">
            {{ tag.name }}
          </h3>
        </div>

        <p
          v-if="tag.description"
          class="tag-description"
        >
          {{ tag.description }}
        </p>

        <div class="tag-meta">
          <span class="meta-item">
            <svg
              class="meta-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            {{ tag.conversationCount || 0 }} 對話
          </span>
        </div>
      </div>
    </div>

    <!-- Right: Actions -->
    <div
      class="tag-actions"
      @click.stop
    >
      <button
        class="btn btn-sm btn-secondary"
        :disabled="loading"
        @click="$emit('view-stats')"
      >
        <svg
          class="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        統計
      </button>
      <button
        class="btn btn-sm btn-danger"
        :disabled="loading"
        @click="$emit('delete')"
      >
        <svg
          class="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        刪除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tag } from '@/api/tags'

interface Props {
  tag: Tag
  selected?: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  selected: false,
  loading: false
})

const emit = defineEmits<{
  'toggle-selection': []
  'view-stats': []
  'edit': []
  'delete': []
}>()

const handleCardClick = () => {
  emit('edit')
}
</script>

<style scoped>
.tag-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-xl);
  transition: all var(--transition-fast);
  cursor: pointer;
  margin-bottom: var(--space-3);
  position: relative;
}

.tag-card:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-1px);
}

.tag-card:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.1);
}

.tag-card.selected {
  border-color: var(--primary-500);
  background: var(--primary-50);
}

/* Left: Tag Info */
.tag-info {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  min-width: 0; /* Allow text truncation */
}

.tag-checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tag-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  border-radius: var(--radius-md);
  border: 2px solid var(--gray-300);
  transition: all var(--transition-fast);
}

.tag-checkbox:checked {
  background: var(--primary-600);
  border-color: var(--primary-600);
}

.tag-color-badge {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-xl);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.tag-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tag-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.tag-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--gray-900);
  letter-spacing: -0.025em;
}

.tag-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--gray-600);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-meta {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--gray-600);
  font-size: 0.8125rem;
  font-weight: 500;
}

.meta-icon {
  width: 14px;
  height: 14px;
  color: var(--gray-400);
  flex-shrink: 0;
}

/* Right: Actions */
.tag-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .tag-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .tag-info {
    width: 100%;
  }

  .tag-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 640px) {
  .tag-actions {
    flex-wrap: wrap;
    justify-content: stretch;
  }

  .btn {
    flex: 1;
    min-width: 0;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .tag-card,
  .btn {
    transition: none !important;
  }

  .tag-card:hover {
    transform: none !important;
  }
}
</style>
