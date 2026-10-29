<template>
  <div class="sort-dropdown">
    <button
      class="sort-button"
      :class="{ 'is-open': isOpen, 'is-custom': isCustomMode }"
      @click="toggleDropdown"
    >
      <SortIcon class="sort-icon" />
      <span class="sort-label">{{ currentLabel }}</span>
      <span
        v-if="!isCustomMode"
        class="sort-order-badge"
        :class="sortOrder"
      >
        {{ sortOrder === 'asc' ? '↑' : '↓' }}
      </span>
      <span
        v-else
        class="custom-badge"
      >
        ⋮⋮
      </span>
      <ChevronDownIcon
        class="chevron-icon"
        :class="{ 'is-open': isOpen }"
      />
    </button>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="dropdown-menu"
      >
        <!-- Custom Mode Header - Show reset option -->
        <div
          v-if="isCustomMode"
          class="custom-mode-header"
        >
          <span class="custom-mode-text">目前為拖拽自訂順序</span>
          <button
            class="reset-button"
            @click.stop="resetToAuto"
          >
            <ResetIcon />
            恢復自動
          </button>
        </div>

        <div class="dropdown-header">
          排序方式
        </div>
        <button
          v-for="option in options"
          :key="option.field"
          class="dropdown-item"
          :class="{ 'is-active': !isCustomMode && currentField === option.field }"
          @click="selectOption(option.field)"
        >
          <span class="item-label">{{ option.label }}</span>
          <span
            v-if="!isCustomMode && currentField === option.field"
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
  isCustomMode?: boolean
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  (_e: 'select', _field: string): void
  (_e: 'toggle-order'): void
  (_e: 'reset-to-auto'): void
}>()

// Icons
const SortIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="11" y2="6"/><line x1="4" y1="12" x2="9" y2="12"/><line x1="4" y1="18" x2="7" y2="18"/><polyline points="15 15 18 18 21 15"/><line x1="18" y1="6" x2="18" y2="18"/></svg>`
}

const ChevronDownIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
}

const ResetIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`
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

function resetToAuto() {
  emit('reset-to-auto')
  closeDropdown()
}
</script>

<style scoped>
.sort-dropdown {
  position: relative;
  display: inline-block;
}

.sort-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.sort-button:hover,
.sort-button.is-open {
  background: var(--ui-fill-strong);
}

.sort-button.is-custom {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.sort-icon {
  width: 15px;
  height: 15px;
  color: var(--ui-ink-2);
}

.sort-label {
  color: inherit;
}

.sort-order-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.custom-badge {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -2px;
}

.chevron-icon {
  width: 13px;
  height: 13px;
  color: var(--ui-faint);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.chevron-icon.is-open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 100;
  min-width: 220px;
  overflow: hidden;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
}

.custom-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: var(--ui-orange-soft);
}

.custom-mode-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-orange-ink);
}

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-orange-ink);
  cursor: pointer;
}

.reset-button svg {
  width: 12px;
  height: 12px;
}

.dropdown-header {
  padding: 10px 14px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 14px;
  border: 0;
  background: none;
  font-size: 13.5px;
  color: var(--ui-ink);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.dropdown-item:hover {
  background: var(--ui-fill);
}

.dropdown-item.is-active {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
  font-weight: 600;
}

.item-label {
  flex: 1;
  text-align: left;
}

.item-order {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--ui-surface);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity var(--ui-dur) var(--ui-ease),
    transform var(--ui-dur) var(--ui-ease);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
