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
  <div class="flex items-center justify-between gap-6 mt-6 lg:flex-col lg:items-stretch lg:gap-4">
    <div class="flex gap-4 md:flex-col md:gap-3">
      <!-- 状态筛选 -->
      <div class="flex flex-col gap-1 md:w-full">
        <label class="text-xs font-medium text-gray-700 uppercase tracking-wider">狀態篩選</label>
        <select
          :value="filters.status"
          class="form-select"
          @change="onFilterChange('status', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            所有狀態
          </option>
          <option value="active">
            進行中
          </option>
          <option value="assigned">
            已指派
          </option>
          <option value="pending">
            待處理
          </option>
        </select>
      </div>

      <!-- 平台筛选 -->
      <div class="flex flex-col gap-1 md:w-full">
        <label class="text-xs font-medium text-gray-700 uppercase tracking-wider">平台篩選</label>
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

      <!-- 團隊指派筛选 -->
      <!-- Note: Individual assignment (assignedTo) removed - only team-based filtering is supported now -->
      <div class="flex flex-col gap-1 md:w-full">
        <label class="text-xs font-medium text-gray-700 uppercase tracking-wider">團隊指派</label>
        <select
          :value="filters.teamId || ''"
          class="form-select"
          @change="onFilterChange('teamId', ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
        >
          <option value="">
            全部
          </option>
          <option value="0">
            未指派
          </option>
        </select>
      </div>

      <!-- 标签筛选 -->
      <div class="flex flex-col gap-1 relative">
        <label class="text-xs font-medium text-gray-700 uppercase tracking-wider">標籤篩選</label>
        <div class="relative">
          <button
            class="tag-filter-btn"
            :class="{ 'has-selection': selectedTagIds.length > 0 }"
            @click="showTagDropdown = !showTagDropdown"
          >
            <span v-if="selectedTagIds.length === 0">選擇標籤</span>
            <span v-else>已選 {{ selectedTagIds.length }} 個</span>
            <svg
              class="w-4 h-4 ml-auto transition-transform duration-200"
              :class="{ 'rotate-180': showTagDropdown }"
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
              class="p-4 text-center text-gray-500 text-sm"
            >
              暫無可用標籤
            </div>
            <div
              v-for="tag in availableTags"
              v-else
              :key="tag.id"
              class="flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors hover:bg-gray-50"
              :class="{ 'bg-primary-50': selectedTagIds.includes(tag.id) }"
              @click="toggleTag(tag.id)"
            >
              <div
                class="w-3 h-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: tag.color }"
              />
              <span class="flex-1 text-sm text-gray-800">{{ tag.name }}</span>
              <svg
                v-if="selectedTagIds.includes(tag.id)"
                class="w-4 h-4 text-primary-600"
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
              class="py-3 px-4 text-center text-red-600 text-sm cursor-pointer border-t border-gray-200 hover:bg-red-50 transition-colors"
              @click="clearTags"
            >
              清除篩選
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="flex gap-6 lg:justify-center sm:flex-col sm:gap-3">
      <div class="flex flex-col items-center text-center sm:flex-row sm:justify-between sm:p-3 sm:bg-gray-50 sm:rounded-lg">
        <span class="text-2xl font-bold text-primary-600 leading-none">{{ totalConversations }}</span>
        <span class="text-xs text-gray-600 font-medium mt-1 sm:mt-0">總對話</span>
      </div>
      <div class="flex flex-col items-center text-center sm:flex-row sm:justify-between sm:p-3 sm:bg-gray-50 sm:rounded-lg">
        <span class="text-2xl font-bold text-primary-600 leading-none">{{ unreadCount }}</span>
        <span class="text-xs text-gray-600 font-medium mt-1 sm:mt-0">未讀</span>
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
  'update:filter': [key: keyof ConversationFilters, value: string | number | undefined]
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
function onFilterChange(key: keyof ConversationFilters, value: string | number | undefined) {
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
/* Tag Filter Button - Complex styles */
.tag-filter-btn {
  @apply flex items-center gap-2 py-2 px-3 bg-white border border-gray-200;
  @apply rounded-lg text-sm text-gray-600 cursor-pointer transition-all min-w-[120px];
}

.tag-filter-btn:hover {
  @apply border-primary-600 text-primary-600;
}

.tag-filter-btn.has-selection {
  @apply bg-primary-50 border-primary-600 text-primary-600;
}

/* Tag Filter Dropdown - Positioning and animation */
.tag-filter-dropdown {
  @apply absolute z-50 min-w-[200px] max-h-[300px] overflow-y-auto;
  @apply bg-white border border-gray-200 rounded-xl shadow-xl;
  top: calc(100% + 0.5rem);
  left: 0;
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
</style>
