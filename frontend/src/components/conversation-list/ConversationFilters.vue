<!--
  Conversation Filters Component

  对话列表筛选器组件

  @example
  <ConversationFilters
    :filters="filters"
    :available-tags="tags"
    :total-conversations="100"
    :unread-count="5"
    @update:filter="handleFilterUpdate"
    @update:tag-filter="handleTagFilterUpdate"
  />
-->
<template>
  <div class="filters-section">
    <div class="filters">
      <!-- 状态筛选 -->
      <div class="filter-group">
        <label class="filter-label">狀態篩選</label>
        <select
          :value="filters.status"
          class="form-select"
          @change="onFilterChange('status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            所有狀態
          </option>
          <option value="open">
            待處理
          </option>
          <option value="assigned">
            已指派
          </option>
          <option value="closed">
            已關閉
          </option>
        </select>
      </div>

      <!-- 平台筛选 -->
      <div class="filter-group">
        <label class="filter-label">平台篩選</label>
        <select
          :value="filters.platform"
          class="form-select"
          @change="onFilterChange('platform', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            所有平台
          </option>
          <option value="line">
            LINE
          </option>
          <option value="facebook">
            Facebook
          </option>
          <option value="instagram">
            Instagram
          </option>
          <option value="whatsapp">
            WhatsApp
          </option>
        </select>
      </div>

      <!-- 指派状态筛选 -->
      <div class="filter-group">
        <label class="filter-label">指派狀態</label>
        <select
          :value="filters.assignedTo"
          class="form-select"
          @change="onFilterChange('assignedTo', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            全部
          </option>
          <option value="me">
            指派給我
          </option>
          <option value="unassigned">
            未指派
          </option>
        </select>
      </div>

      <!-- 标签筛选 -->
      <div class="filter-group tag-filter-group">
        <label class="filter-label">標籤篩選</label>
        <div class="tag-filter-wrapper">
          <button
            class="tag-filter-btn"
            :class="{ 'has-selection': selectedTagIds.length > 0 }"
            @click="showTagDropdown = !showTagDropdown"
          >
            <span v-if="selectedTagIds.length === 0">選擇標籤</span>
            <span v-else>已選 {{ selectedTagIds.length }} 個</span>
            <svg
              class="dropdown-chevron"
              :class="{ 'rotated': showTagDropdown }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <!-- 标签下拉菜单 -->
          <div
            v-if="showTagDropdown"
            class="tag-filter-dropdown"
          >
            <div
              v-if="availableTags.length === 0"
              class="no-tags-message"
            >
              暫無可用標籤
            </div>
            <div
              v-for="tag in availableTags"
              v-else
              :key="tag.id"
              class="tag-option"
              :class="{ 'selected': selectedTagIds.includes(tag.id) }"
              @click="toggleTag(tag.id)"
            >
              <div
                class="tag-color-dot"
                :style="{ backgroundColor: tag.color }"
              />
              <span class="tag-name">{{ tag.name }}</span>
              <svg
                v-if="selectedTagIds.includes(tag.id)"
                class="check-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div
              v-if="selectedTagIds.length > 0"
              class="clear-tags-btn"
              @click="clearTags"
            >
              清除篩選
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="quick-stats">
      <div class="stat-item">
        <span class="stat-number">{{ totalConversations }}</span>
        <span class="stat-label">總對話</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ unreadCount }}</span>
        <span class="stat-label">未讀</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ConversationFilters } from '@/types'

export interface Tag {
  id: number
  name: string
  color: string
}

export interface ConversationFiltersProps {
  /** 筛选条件 */
  filters: ConversationFilters
  /** 可用标签列表 */
  availableTags?: Tag[]
  /** 总对话数 */
  totalConversations?: number
  /** 未读数 */
  unreadCount?: number
}

const props = withDefaults(defineProps<ConversationFiltersProps>(), {
  totalConversations: 0,
  unreadCount: 0,
  availableTags: () => []
})

const emit = defineEmits<{
  'update:filter': [key: keyof ConversationFilters, value: string | undefined]
  'update:tag-filter': [tagIds: number[]]
  'toggle:tag': [tagId: number]
  'clear:tags': []
}>()

// 状态
const showTagDropdown = ref(false)

// 计算选中的标签 IDs
const selectedTagIds = computed(() => props.filters.tagIds || [])

/**
 * 处理筛选变化
 */
function onFilterChange(key: keyof ConversationFilters, value: string) {
  emit('update:filter', key, value || undefined)
}

/**
 * 切换标签
 */
function toggleTag(tagId: number) {
  emit('toggle:tag', tagId)
}

/**
 * 清除标签筛选
 */
function clearTags() {
  emit('clear:tags')
  showTagDropdown.value = false
}
</script>

<style scoped>
.filters-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  margin-top: var(--space-6);
}

.filters {
  display: flex;
  gap: var(--space-4);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-700);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quick-stats {
  display: flex;
  gap: var(--space-6);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-600);
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--gray-600);
  font-weight: 500;
  margin-top: var(--space-1);
}

/* 标签筛选样式 */
.tag-filter-group {
  position: relative;
}

.tag-filter-wrapper {
  position: relative;
}

.tag-filter-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.tag-filter-btn:hover {
  border-color: var(--primary-color, #6366f1);
  color: var(--primary-color, #6366f1);
}

.tag-filter-btn.has-selection {
  background: var(--primary-50, #eef2ff);
  border-color: var(--primary-color, #6366f1);
  color: var(--primary-color, #6366f1);
}

.dropdown-chevron {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
  margin-left: auto;
}

.dropdown-chevron.rotated {
  transform: rotate(180deg);
}

.tag-filter-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 50;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  animation: dropdown-appear 0.2s ease-out;
}

@keyframes dropdown-appear {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.no-tags-message {
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.tag-option:hover {
  background: var(--hover-color, #f9fafb);
}

.tag-option.selected {
  background: var(--primary-50, #eef2ff);
}

.tag-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text-primary, #374151);
}

.check-icon {
  width: 16px;
  height: 16px;
  color: var(--primary-color, #6366f1);
}

.clear-tags-btn {
  padding: 0.75rem 1rem;
  text-align: center;
  color: var(--error-color, #ef4444);
  font-size: 0.875rem;
  cursor: pointer;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.clear-tags-btn:hover {
  background: var(--error-50, #fef2f2);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .filters-section {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
  }

  .quick-stats {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
    gap: var(--space-3);
  }

  .filter-group {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .quick-stats {
    flex-direction: column;
    gap: var(--space-3);
  }

  .stat-item {
    flex-direction: row;
    justify-content: space-between;
    padding: var(--space-3);
    background-color: var(--gray-50);
    border-radius: var(--radius-lg);
  }
}
</style>
