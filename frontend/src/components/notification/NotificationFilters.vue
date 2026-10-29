<template>
  <section
    class="filters-section ui-card"
    role="search"
    aria-label="通知篩選選項"
  >
    <!-- Read Status Filter -->
    <div
      class="ui-seg filter-tabs"
      role="group"
      aria-label="已讀狀態"
    >
      <button
        class="filter-tab"
        :class="{ 'is-on': selectedReadStatus === undefined }"
        :aria-pressed="selectedReadStatus === undefined"
        @click="$emit('update:selectedReadStatus', undefined); $emit('apply-filters')"
      >
        全部
        <span
          v-if="counts"
          class="ui-seg-n"
        >{{ counts.total }}</span>
      </button>
      <button
        class="filter-tab"
        :class="{ 'is-on': selectedReadStatus === false }"
        :aria-pressed="selectedReadStatus === false"
        @click="$emit('update:selectedReadStatus', false); $emit('apply-filters')"
      >
        <span class="tab-badge" />
        未讀
        <span
          v-if="counts"
          class="ui-seg-n"
        >{{ counts.unread }}</span>
      </button>
      <button
        class="filter-tab"
        :class="{ 'is-on': selectedReadStatus === true }"
        :aria-pressed="selectedReadStatus === true"
        @click="$emit('update:selectedReadStatus', true); $emit('apply-filters')"
      >
        已讀
        <span
          v-if="counts"
          class="ui-seg-n"
        >{{ Math.max(0, counts.total - counts.unread) }}</span>
      </button>
    </div>

    <!-- Type Filter -->
    <select
      :value="selectedType"
      class="ui-select filter-select"
      aria-label="通知類型"
      @change="$emit('update:selectedType', ($event.target as HTMLSelectElement).value); $emit('apply-filters')"
    >
      <option value="">
        全部類型
      </option>
      <option
        v-for="type in notificationTypes"
        :key="type.value"
        :value="type.value"
      >
        {{ type.label }}
      </option>
    </select>

    <!-- Priority Filter -->
    <select
      :value="selectedPriority"
      class="ui-select filter-select"
      aria-label="通知優先級"
      @change="$emit('update:selectedPriority', ($event.target as HTMLSelectElement).value); $emit('apply-filters')"
    >
      <option value="">
        全部優先級
      </option>
      <option
        v-for="priority in priorities"
        :key="priority.value"
        :value="priority.value"
      >
        {{ priority.label }}
      </option>
    </select>

    <!-- Clear Filters -->
    <button
      v-if="hasActiveFilters"
      class="btn btn-ghost btn-sm"
      @click="$emit('clear-filters')"
    >
      <XIcon />
      清除篩選
    </button>
  </section>
</template>

<script setup lang="ts">
import { XIcon } from '@/components/icons'

defineProps<{
  selectedType: string
  selectedPriority: string
  selectedReadStatus: boolean | undefined
  hasActiveFilters: boolean
  notificationTypes: Array<{ value: string; label: string }>
  priorities: Array<{ value: string; label: string }>
  /** Real totals from /notifications/stats for the tab counts */
  counts?: { total: number; unread: number } | null
}>()

defineEmits<{
  'update:selectedType': [value: string]
  'update:selectedPriority': [value: string]
  'update:selectedReadStatus': [value: boolean | undefined]
  'apply-filters': []
  'clear-filters': []
}>()
</script>

<style scoped>
.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  align-items: center;
  padding: 14px 18px;
}

.filter-select {
  width: auto;
  min-width: 140px;
  height: 36px;
  border-radius: 999px;
}

.tab-badge {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-accent);
}

.btn svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 768px) {
  .filter-tabs {
    width: 100%;
  }

  .filter-tab {
    flex: 1;
    justify-content: center;
  }

  .filter-select {
    flex: 1 1 140px;
    min-width: 0;
  }
}
</style>
