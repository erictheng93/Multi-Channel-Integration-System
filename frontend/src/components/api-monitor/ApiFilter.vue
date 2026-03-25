<template>
  <div class="flex flex-wrap gap-2">
    <!-- Status pills -->
    <button
      v-for="s in statusOptions"
      :key="s.value"
      class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 border-none cursor-pointer"
      :class="filters.status === s.value
        ? 'bg-[#007AFF] text-white'
        : 'bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#E5E5EA]'"
      @click="updateFilter('status', s.value)"
    >
      {{ s.label }}
    </button>

    <!-- Divider -->
    <div class="w-px h-6 bg-[#E5E5EA] self-center mx-1" />

    <!-- Category pills -->
    <button
      v-for="c in categoryOptions"
      :key="c.value"
      class="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 border-none cursor-pointer"
      :class="filters.category === c.value
        ? 'bg-[#007AFF] text-white'
        : 'bg-[#F2F2F7] text-[#8E8E93] hover:bg-[#E5E5EA]'"
      @click="updateFilter('category', c.value)"
    >
      {{ c.label }}
    </button>

    <!-- Search input (right side) -->
    <div class="flex-1 min-w-[160px] relative ml-auto">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8E8E93"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
      >
        <circle
          cx="11"
          cy="11"
          r="8"
        />
        <line
          x1="21"
          y1="21"
          x2="16.65"
          y2="16.65"
        />
      </svg>
      <input
        :value="filters.search"
        type="text"
        placeholder="Search endpoints..."
        class="w-full rounded-full pl-9 pr-3.5 py-1.5 text-xs bg-[#F2F2F7] text-[#1C1C1E] border-none outline-none placeholder-[#8E8E93] focus:ring-2 focus:ring-[#007AFF]/30"
        @input="updateSearch"
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FilterState } from '@/types/api-monitor'

const props = defineProps<{
  filters: FilterState
}>()

const emit = defineEmits<{
  (_e: 'update:filters', _value: FilterState): void
}>()

const statusOptions = [
  { value: 'all' as const, label: 'All' },
  { value: 'healthy' as const, label: 'Healthy' },
  { value: 'warning' as const, label: 'Warning' },
  { value: 'error' as const, label: 'Error' },
]

const categoryOptions = [
  { value: 'all' as const, label: 'All' },
  { value: 'system' as const, label: 'System' },
  { value: 'auth' as const, label: 'Auth' },
  { value: 'conversation' as const, label: 'Business' },
  { value: 'integration' as const, label: 'Integration' },
]

function updateFilter(key: 'status' | 'category', value: string) {
  emit('update:filters', { ...props.filters, [key]: value })
}

function updateSearch(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:filters', { ...props.filters, search: target.value })
}
</script>
