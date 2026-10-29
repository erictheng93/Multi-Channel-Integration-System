<template>
  <div class="toolbar">
    <div
      class="ui-seg"
      role="group"
      aria-label="依狀態篩選"
    >
      <button
        v-for="s in statusOptions"
        :key="s.value"
        type="button"
        :aria-pressed="filters.status === s.value"
        @click="updateFilter('status', s.value)"
      >
        {{ s.label }}
        <span
          v-if="counts"
          class="ui-seg-n"
        >{{ counts[s.value] }}</span>
      </button>
    </div>

    <div
      class="ui-seg"
      role="group"
      aria-label="依分類篩選"
    >
      <button
        v-for="c in categoryOptions"
        :key="c.value"
        type="button"
        :aria-pressed="filters.category === c.value"
        @click="updateFilter('category', c.value)"
      >
        {{ c.label }}
      </button>
    </div>

    <label class="find">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><circle
        cx="11"
        cy="11"
        r="7"
      /><path d="m21 21-4.3-4.3" /></svg>
      <input
        :value="filters.search"
        type="text"
        placeholder="搜尋端點路徑或說明"
        aria-label="搜尋端點"
        class="ui-input"
        @input="updateSearch"
      >
    </label>
  </div>
</template>

<script setup lang="ts">
import type { FilterState } from '@/types/api-monitor'

const props = defineProps<{
  filters: FilterState
  /** Endpoint count per status ('all' = total); shown on the status segments when given */
  counts?: Record<'all' | 'healthy' | 'warning' | 'error', number>
}>()

const emit = defineEmits<{
  (_e: 'update:filters', _value: FilterState): void
}>()

const statusOptions = [
  { value: 'all' as const, label: '全部' },
  { value: 'healthy' as const, label: '正常' },
  { value: 'warning' as const, label: '警告' },
  { value: 'error' as const, label: '錯誤' },
]

const categoryOptions = [
  { value: 'all' as const, label: '全部' },
  { value: 'system' as const, label: '系統' },
  { value: 'auth' as const, label: '驗證' },
  { value: 'conversation' as const, label: '業務' },
  { value: 'integration' as const, label: '整合' },
]

function updateFilter(key: 'status' | 'category', value: string) {
  emit('update:filters', { ...props.filters, [key]: value })
}

function updateSearch(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:filters', { ...props.filters, search: target.value })
}
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 0 22px 14px;
}

.toolbar .ui-seg {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.find {
  position: relative;
  flex: 1;
  min-width: 180px;
}

.find svg {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 15px;
  height: 15px;
  color: var(--ui-muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.find .ui-input {
  height: 34px;
  padding-left: 34px;
  border-radius: 999px;
  font-size: 13px;
}

@media (max-width: 768px) {
  .toolbar {
    padding: 0 16px 14px;
  }
}
</style>
