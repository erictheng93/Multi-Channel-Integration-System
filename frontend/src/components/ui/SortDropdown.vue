<template>
  <div class="sort-dropdown">
    <button
      class="sort-button"
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
    >
      <SortIcon class="sort-icon" />
      <span class="sort-label">{{ currentLabel }}</span>
      <span class="sort-order-badge" :class="sortOrder">
        {{ sortOrder === 'asc' ? '↑' : '↓' }}
      </span>
      <ChevronDownIcon class="chevron-icon" :class="{ 'is-open': isOpen }" />
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-menu">
        <div class="dropdown-header">排序方式</div>
        <button
          v-for="option in options"
          :key="option.field"
          class="dropdown-item"
          :class="{ 'is-active': currentField === option.field }"
          @click="selectOption(option.field)"
        >
          <span class="item-label">{{ option.label }}</span>
          <span
            v-if="currentField === option.field"
            class="item-order"
            @click.stop="toggleOrder"
          >
            {{ sortOrder === 'asc' ? '升序 ↑' : '降序 ↓' }}
          </span>
        </button>
      </div>
    </Transition>

    <!-- Backdrop -->
    <div
      v-if="isOpen"
      class="dropdown-backdrop"
      @click="closeDropdown"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SortOption, SortOrder } from '@/composables/useListSorting'

// Props
interface Props {
  options: SortOption[]
  currentField: string
  currentLabel: string
  sortOrder: SortOrder
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  (_e: 'select', _field: string): void
  (_e: 'toggle-order'): void
}>()

// Icons
const SortIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="11" y2="6"/><line x1="4" y1="12" x2="9" y2="12"/><line x1="4" y1="18" x2="7" y2="18"/><polyline points="15 15 18 18 21 15"/><line x1="18" y1="6" x2="18" y2="18"/></svg>`
}

const ChevronDownIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
}

// State
const isOpen = ref(false)

// Methods
function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function closeDropdown() {
  isOpen.value = false
}

function selectOption(field: string) {
  emit('select', field)
  closeDropdown()
}

function toggleOrder() {
  emit('toggle-order')
}
</script>

<style scoped>
.sort-dropdown {
  position: relative;
  display: inline-block;
}

.sort-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-button:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.sort-button.is-open {
  background: #f1f5f9;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.sort-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
}

.sort-label {
  color: #1e293b;
}

.sort-order-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  transition: all 0.2s;
}

.sort-order-badge.asc {
  background: #dbeafe;
  color: #2563eb;
}

.sort-order-badge.desc {
  background: #fce7f3;
  color: #db2777;
}

.chevron-icon {
  width: 14px;
  height: 14px;
  color: #94a3b8;
  transition: transform 0.2s;
}

.chevron-icon.is-open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 180px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
}

.dropdown-header {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  font-size: 0.875rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-item:hover {
  background: #f1f5f9;
}

.dropdown-item.is-active {
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 500;
}

.item-label {
  flex: 1;
  text-align: left;
}

.item-order {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.item-order:hover {
  background: #c7d2fe;
}

.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
