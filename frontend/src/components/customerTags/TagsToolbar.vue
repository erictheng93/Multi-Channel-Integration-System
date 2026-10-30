<template>
  <section class="toolbar-section">
    <div class="search-box">
      <SearchIcon class="search-icon" />
      <input
        v-model="localSearchQuery"
        type="search"
        class="ui-input search-input"
        placeholder="搜尋標籤名稱或描述"
        aria-label="搜尋標籤"
        @input="$emit('update:search-query', localSearchQuery)"
        @keydown.escape="handleClear"
      >
      <button
        v-if="localSearchQuery"
        type="button"
        class="search-clear"
        aria-label="清除搜尋"
        @click="handleClear"
      >
        &times;
      </button>
    </div>
    <div class="toolbar-actions">
      <!-- Bulk actions (shown when tags are selected) -->
      <div
        v-if="hasSelection"
        class="selection-indicator"
      >
        <span class="selection-count">已選擇 {{ selectionCount }} 個標籤</span>
        <button
          class="btn btn-danger btn-sm"
          @click="$emit('bulk-delete')"
        >
          <TrashIcon />
          <span>批量刪除</span>
        </button>
        <button
          class="btn btn-secondary btn-sm"
          @click="$emit('clear-selection')"
        >
          <span>取消選擇</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { SearchIcon, TrashIcon } from '@/components/icons'

const props = defineProps<{
  searchQuery: string
  hasSelection: boolean
  selectionCount: number
  isSearching: boolean
  filteredCount: number
  totalCount: number
}>()

const emit = defineEmits<{
  'update:search-query': [value: string]
  'bulk-delete': []
  'clear-selection': []
}>()

const localSearchQuery = ref(props.searchQuery)

watch(() => props.searchQuery, (newValue) => {
  localSearchQuery.value = newValue
})

function handleClear() {
  localSearchQuery.value = ''
  emit('update:search-query', '')
}
</script>

<style scoped>
.toolbar-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.search-box {
  position: relative;
  flex: 1 1 260px;
}

.search-icon {
  position: absolute;
  top: 50%;
  left: 13px;
  width: 16px;
  height: 16px;
  color: var(--ui-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.search-input {
  height: 40px;
  padding-left: 38px;
  border-radius: 999px;
  background: var(--ui-surface);
}

.search-clear {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--ui-fill);
  color: var(--ui-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
}

.toolbar-actions:empty {
  display: none;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.selection-indicator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.selection-count {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.btn svg {
  width: 15px;
  height: 15px;
}

@media (max-width: 640px) {
  .toolbar-actions {
    width: 100%;
    margin-left: 0;
  }
}

/* placeholder text must read at AA on the grey field fill */
.ui-input::placeholder,
.ui-textarea::placeholder {
  color: var(--ui-muted);
}
</style>
