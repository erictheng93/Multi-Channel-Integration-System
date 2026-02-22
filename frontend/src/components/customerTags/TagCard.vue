<template>
  <div
    class="tag-card"
    :class="{ 'tag-selected': isSelected }"
  >
    <!-- Selection Checkbox -->
    <div class="tag-checkbox">
      <input
        :id="`tag-${tag.id}`"
        type="checkbox"
        :checked="isSelected"
        class="checkbox-input"
        @change="$emit('select')"
      >
      <label
        :for="`tag-${tag.id}`"
        class="checkbox-label"
      />
    </div>

    <!-- Color Indicator -->
    <div
      class="tag-color-indicator"
      :style="{ background: tag.color }"
    />

    <!-- Tag Content -->
    <div class="tag-content">
      <h3 class="tag-name">
        {{ tag.name }}
      </h3>
      <p
        v-if="tag.description"
        class="tag-description"
      >
        {{ tag.description }}
      </p>

      <!-- Stats -->
      <div class="tag-stats">
        <div class="stat-item">
          <UsersIcon />
          <span>{{ tag.customerCount || 0 }} 客戶</span>
        </div>
        <button
          class="stat-item stat-item-clickable"
          :title="`查看 ${tag.conversationCount || 0} 個對話`"
          :disabled="!tag.conversationCount"
          @click.stop="$emit('view-conversations')"
        >
          <MessageCircleIcon />
          <span>{{ tag.conversationCount || 0 }} 對話</span>
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="tag-actions">
      <button
        class="action-btn action-btn-info"
        title="查看統計"
        @click.stop="$emit('view-stats')"
      >
        <BarChartIcon />
      </button>
      <button
        class="action-btn action-btn-primary"
        title="編輯標籤"
        @click.stop="$emit('edit')"
      >
        <EditIcon />
      </button>
      <button
        class="action-btn action-btn-danger"
        title="刪除標籤"
        @click.stop="$emit('delete')"
      >
        <TrashIcon />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  UsersIcon,
  MessageCircleIcon,
  BarChartIcon,
  EditIcon,
  TrashIcon
} from '@/components/icons'
import type { Tag } from '@/types/tag'

defineProps<{
  tag: Tag
  isSelected: boolean
}>()

defineEmits<{
  select: []
  edit: []
  delete: []
  'view-stats': []
  'view-conversations': []
}>()
</script>

<style scoped>
.tag-card {
  position: relative;
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 2px solid var(--gray-100);
  transition: all var(--transition-fast);
  overflow: hidden;
}

.tag-card:hover {
  border-color: var(--gray-300);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1);
  transform: translateY(-2px);
}

.tag-card.tag-selected {
  border-color: var(--primary-400);
  background: linear-gradient(135deg, var(--primary-50), white);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.tag-checkbox {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  z-index: 1;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkbox-label {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--gray-300);
  border-radius: var(--radius-sm);
  background: white;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.checkbox-input:checked + .checkbox-label {
  background: var(--primary-500);
  border-color: var(--primary-500);
}

.checkbox-label::after {
  content: '';
  position: absolute;
  display: none;
  left: 6px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-input:checked + .checkbox-label::after {
  display: block;
}

.tag-color-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.tag-content {
  margin-top: var(--space-2);
  margin-bottom: var(--space-4);
}

.tag-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.tag-description {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0 0 var(--space-4);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-stats {
  display: flex;
  gap: var(--space-4);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  font-size: 0.8125rem;
  color: var(--gray-600);
}

.stat-item svg {
  width: 14px;
  height: 14px;
  color: var(--gray-400);
}

.stat-item-clickable {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline dotted var(--gray-400);
  transition: color var(--transition-fast);
}

.stat-item-clickable:hover:not(:disabled) {
  color: var(--primary-600);
}

.stat-item-clickable:hover:not(:disabled) svg {
  color: var(--primary-500);
}

.stat-item-clickable:disabled {
  cursor: default;
  text-decoration: none;
}

.tag-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.tag-card:hover .tag-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn-info {
  background: var(--blue-100);
  color: var(--blue-600);
}

.action-btn-info:hover {
  background: var(--blue-200);
}

.action-btn-primary {
  background: var(--gray-100);
  color: var(--gray-600);
}

.action-btn-primary:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.action-btn-danger {
  background: var(--red-100);
  color: var(--red-600);
}

.action-btn-danger:hover {
  background: var(--red-200);
}

@media (max-width: 768px) {
  .tag-actions {
    opacity: 1;
  }
}
</style>
