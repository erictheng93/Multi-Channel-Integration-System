<template>
  <div
    :role="role"
    :tabindex="disabled ? -1 : 0"
    class="dropdown-item"
    :class="{
      'dropdown-item-disabled': disabled,
      'dropdown-item-danger': variant === 'danger',
      'dropdown-item-active': active,
      'dropdown-item-divider': isDivider
    }"
    @click="handleClick"
    @keydown.enter.prevent="handleKeydown"
    @keydown.space.prevent="handleKeydown"
  >
    <div
      v-if="!isDivider"
      class="dropdown-item-content"
    >
      <div
        v-if="$slots.icon || icon"
        class="dropdown-item-icon"
      >
        <slot name="icon">
          <component
            :is="icon"
            v-if="icon"
          />
        </slot>
      </div>
      
      <div class="dropdown-item-text">
        <div
          v-if="$slots.default"
          class="dropdown-item-label"
        >
          <slot />
        </div>
        <div
          v-else-if="label"
          class="dropdown-item-label"
        >
          {{ label }}
        </div>
        
        <div
          v-if="description"
          class="dropdown-item-description"
        >
          {{ description }}
        </div>
      </div>
      
      <div
        v-if="shortcut"
        class="dropdown-item-shortcut"
      >
        {{ shortcut }}
      </div>
      
      <div
        v-if="$slots.suffix"
        class="dropdown-item-suffix"
      >
        <slot name="suffix" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Remove unused import

interface Props {
  label?: string
  description?: string
  icon?: string | null
  shortcut?: string
  disabled?: boolean
  active?: boolean
  variant?: 'default' | 'danger'
  value?: unknown
  href?: string
  target?: string
  role?: string
  isDivider?: boolean
}

/* eslint-disable no-unused-vars */
interface Emits {
  (e: 'click', event: MouseEvent | KeyboardEvent, value?: unknown): void
  (e: 'select', value?: unknown): void
}
/* eslint-enable no-unused-vars */

const props = withDefaults(defineProps<Props>(), {
  label: '',
  description: '',
  icon: null,
  shortcut: '',
  variant: 'default',
  role: 'menuitem',
  disabled: false,
  active: false,
  isDivider: false,
  value: undefined,
  href: '',
  target: '_self'
})

const emit = defineEmits<Emits>()

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.isDivider) {return}
  
  emit('click', event, props.value)
  emit('select', props.value)
  
  // 如果有href，處理導航
  if (props.href) {
    if (props.target === '_blank') {
      window.open(props.href, props.target)
    } else {
      window.location.href = props.href
    }
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled || props.isDivider) {return}
  
  emit('click', event, props.value)
  emit('select', props.value)
  
  // 如果有href，處理導航
  if (props.href) {
    if (props.target === '_blank') {
      window.open(props.href, props.target)
    } else {
      window.location.href = props.href
    }
  }
}
</script>

<style scoped>
.dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  cursor: pointer;
  transition: all var(--transition-fast);
  outline: none;
}

.dropdown-item:not(.dropdown-item-divider):not(.dropdown-item-disabled):hover {
  background-color: var(--gray-50);
}

.dropdown-item:not(.dropdown-item-divider):not(.dropdown-item-disabled):focus {
  background-color: var(--primary-50);
  outline: none;
}

.dropdown-item-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dropdown-item-active {
  background-color: var(--primary-50);
  color: var(--primary-700);
}

.dropdown-item-danger:not(.dropdown-item-disabled):hover {
  background-color: var(--red-50);
  color: var(--red-700);
}

.dropdown-item-danger:not(.dropdown-item-disabled):focus {
  background-color: var(--red-100);
  color: var(--red-800);
}

.dropdown-item-divider {
  height: 1px;
  background-color: var(--gray-200);
  margin: var(--space-2) 0;
  cursor: default;
}

.dropdown-item-content {
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  min-height: 40px;
}

.dropdown-item-icon {
  display: flex;
  align-items: center;
  margin-right: var(--space-3);
  color: var(--gray-500);
  width: 16px;
  height: 16px;
}

.dropdown-item-text {
  flex: 1;
  min-width: 0;
}

.dropdown-item-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-900);
  line-height: 1.2;
}

.dropdown-item-description {
  font-size: 0.75rem;
  color: var(--gray-600);
  margin-top: var(--space-1);
  line-height: 1.3;
}

.dropdown-item-shortcut {
  font-size: 0.75rem;
  color: var(--gray-500);
  background: var(--gray-100);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: 500;
  margin-left: var(--space-3);
  white-space: nowrap;
}

.dropdown-item-suffix {
  margin-left: var(--space-3);
  color: var(--gray-500);
}

/* Active狀態下的文字顏色 */
.dropdown-item-active .dropdown-item-label {
  color: var(--primary-700);
}

.dropdown-item-active .dropdown-item-icon {
  color: var(--primary-600);
}

/* Danger變體的文字顏色 */
.dropdown-item-danger .dropdown-item-label {
  color: var(--red-600);
}

.dropdown-item-danger .dropdown-item-icon {
  color: var(--red-500);
}

/* 響應式設計 */
@media (max-width: 640px) {
  .dropdown-item-content {
    padding: var(--space-4);
  }
  
  .dropdown-item-shortcut {
    display: none;
  }
}
</style>