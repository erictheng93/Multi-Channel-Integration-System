<template>
  <div class="sort-mode-toggle">
    <button
      class="mode-button"
      :class="{ 'is-active': mode === 'auto' }"
      @click="emit('change', 'auto')"
      :disabled="disabled"
    >
      <AutoSortIcon class="mode-icon" />
      <span class="mode-label">自動排序</span>
    </button>
    <button
      class="mode-button"
      :class="{ 'is-active': mode === 'custom' }"
      @click="emit('change', 'custom')"
      :disabled="disabled"
    >
      <DragIcon class="mode-icon" />
      <span class="mode-label">自訂順序</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SortMode } from '@/composables/useListSorting'

// Props
interface Props {
  mode: SortMode
  disabled?: boolean
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  (_e: 'change', _mode: SortMode): void
}>()

// Icons
const AutoSortIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="11" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="9" y2="18"/><polyline points="15 9 18 6 21 9"/><polyline points="15 15 18 18 21 15"/></svg>`
}

const DragIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`
}
</script>

<style scoped>
.sort-mode-toggle {
  display: inline-flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.mode-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-button:hover:not(:disabled) {
  color: #475569;
  background: rgba(255, 255, 255, 0.5);
}

.mode-button.is-active {
  background: white;
  color: #4f46e5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mode-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.mode-label {
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 640px) {
  .mode-label {
    display: none;
  }

  .mode-button {
    padding: 0.5rem;
  }
}
</style>
