<template>
  <div
    ref="dropdownRef"
    class="dropdown"
  >
    <div
      :tabindex="disabled ? -1 : 0"
      :aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-disabled="disabled"
      class="dropdown-trigger"
      :class="{ 'dropdown-disabled': disabled }"
      @click="toggle"
      @keydown.enter="toggle"
      @keydown.space.prevent="toggle"
      @keydown.arrow-down.prevent="openAndFocusFirst"
      @keydown.arrow-up.prevent="openAndFocusLast"
    >
      <slot
        name="trigger"
        :is-open="isOpen"
        :toggle="toggle"
      >
        <button class="btn btn-secondary">
          {{ label }}
          <ChevronDownIcon :class="isOpen ? 'rotate-180' : ''" />
        </button>
      </slot>
    </div>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="dropdown-menu"
        :class="[positionClass, { 'dropdown-menu-full-width': fullWidth }]"
        :style="menuStyles"
        role="menu"
        :aria-labelledby="`dropdown-${uid}`"
        @keydown.escape="close"
        @keydown.tab="handleTab"
        @keydown.arrow-down.prevent="focusNext"
        @keydown.arrow-up.prevent="focusPrevious"
        @keydown.home.prevent="focusFirst"
        @keydown.end.prevent="focusLast"
      >
        <div
          v-if="$slots.header"
          class="dropdown-header"
        >
          <slot name="header" />
        </div>

        <div class="dropdown-content">
          <slot
            :close="close"
            :is-open="isOpen"
          />
        </div>

        <div
          v-if="$slots.footer"
          class="dropdown-footer"
        >
          <slot name="footer" />
        </div>
      </div>
    </Teleport>

    <!-- 背景遮罩 -->
    <div
      v-if="isOpen && showOverlay"
      class="dropdown-overlay"
      @click="close"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { ChevronDownIcon } from '@/components/icons'

interface Props {
  label?: string
  disabled?: boolean
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'left' | 'right'
  fullWidth?: boolean
  showOverlay?: boolean
  closeOnClick?: boolean
  offset?: number
}

interface Emits {
  (e: 'open'): void
  (e: 'close'): void
  (e: 'select', value: unknown): void
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Dropdown',
  disabled: false,
  placement: 'bottom-start',
  fullWidth: false,
  showOverlay: false,
  closeOnClick: true,
  offset: 8
})

const emit = defineEmits<Emits>()

const dropdownRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()
const isOpen = ref(false)
const menuStyles = ref({})
const uid = Math.random().toString(36).substr(2, 9)

const positionClass = computed(() => `dropdown-${props.placement}`)

let focusIndex = -1

const toggle = () => {
  if (props.disabled) {return}
  
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

const open = async () => {
  if (props.disabled) {return}
  
  isOpen.value = true
  emit('open')
  
  await nextTick()
  calculatePosition()
  
  // 監聽點擊外部
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('scroll', handleScroll)
  window.addEventListener('resize', handleResize)
}

const close = () => {
  isOpen.value = false
  focusIndex = -1
  emit('close')
  
  // 清理監聽器
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleResize)
  
  // 返回焦點到觸發器
  if (dropdownRef.value) {
    dropdownRef.value.focus()
  }
}

const calculatePosition = () => {
  if (!dropdownRef.value || !menuRef.value) {return}
  
  const trigger = dropdownRef.value.getBoundingClientRect()
  const menu = menuRef.value.getBoundingClientRect()
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  }
  
  let left = 0
  let top = 0
  
  switch (props.placement) {
    case 'bottom-start':
      left = trigger.left
      top = trigger.bottom + props.offset
      break
    case 'bottom-end':
      left = trigger.right - menu.width
      top = trigger.bottom + props.offset
      break
    case 'top-start':
      left = trigger.left
      top = trigger.top - menu.height - props.offset
      break
    case 'top-end':
      left = trigger.right - menu.width
      top = trigger.top - menu.height - props.offset
      break
    case 'left':
      left = trigger.left - menu.width - props.offset
      top = trigger.top
      break
    case 'right':
      left = trigger.right + props.offset
      top = trigger.top
      break
  }
  
  // 防止超出視窗邊界
  if (left < 0) {left = 8}
  if (left + menu.width > viewport.width) {left = viewport.width - menu.width - 8}
  if (top < 0) {top = 8}
  if (top + menu.height > viewport.height) {top = viewport.height - menu.height - 8}
  
  menuStyles.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 1000,
    minWidth: props.fullWidth ? `${trigger.width}px` : 'auto'
  }
}

const handleClickOutside = (event: Event) => {
  const target = event.target as Element
  if (!dropdownRef.value?.contains(target) && !menuRef.value?.contains(target)) {
    close()
  }
}

const handleScroll = () => {
  calculatePosition()
}

const handleResize = () => {
  calculatePosition()
}

// 鍵盤導航
const getFocusableItems = (): HTMLElement[] => {
  if (!menuRef.value) {return []}
  return Array.from(menuRef.value.querySelectorAll(
    '[role="menuitem"], button, input, select, textarea, a[href]'
  )) as HTMLElement[]
}

const focusFirst = () => {
  const items = getFocusableItems()
  if (items.length > 0) {
    focusIndex = 0
    items[0]?.focus()
  }
}

const focusLast = () => {
  const items = getFocusableItems()
  if (items.length > 0) {
    focusIndex = items.length - 1
    items[focusIndex]?.focus()
  }
}

const focusNext = () => {
  const items = getFocusableItems()
  if (items.length === 0) {return}
  
  focusIndex = (focusIndex + 1) % items.length
  items[focusIndex]?.focus()
}

const focusPrevious = () => {
  const items = getFocusableItems()
  if (items.length === 0) {return}
  
  focusIndex = focusIndex <= 0 ? items.length - 1 : focusIndex - 1
  items[focusIndex]?.focus()
}

const openAndFocusFirst = () => {
  if (!isOpen.value) {
    open()
    nextTick(() => focusFirst())
  } else {
    focusFirst()
  }
}

const openAndFocusLast = () => {
  if (!isOpen.value) {
    open()
    nextTick(() => focusLast())
  } else {
    focusLast()
  }
}

const handleTab = (event: KeyboardEvent) => {
  // Tab鍵關閉下拉選單
  event.preventDefault()
  close()
}

onMounted(() => {
  // 如果需要的話，可以在這裡添加初始化邏輯
})

onUnmounted(() => {
  // 清理監聽器
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleResize)
})

defineExpose({
  open,
  close,
  toggle,
  isOpen
})
</script>

<style scoped>
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-trigger {
  cursor: pointer;
  outline: none;
}

.dropdown-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dropdown-trigger:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}

.dropdown-menu {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--gray-200);
  overflow: hidden;
  animation: dropdownEnter 0.15s ease-out;
}

.dropdown-menu-full-width {
  min-width: 100%;
}

.dropdown-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-50);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
}

.dropdown-content {
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--gray-200);
  background: var(--gray-50);
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  background: transparent;
}

/* 位置相關樣式 */
.dropdown-bottom-start,
.dropdown-bottom-end {
  transform-origin: top;
}

.dropdown-top-start,
.dropdown-top-end {
  transform-origin: bottom;
}

.dropdown-left {
  transform-origin: right;
}

.dropdown-right {
  transform-origin: left;
}

@keyframes dropdownEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 圖標旋轉動畫 */
.rotate-180 {
  transform: rotate(180deg);
}

.dropdown-trigger svg {
  transition: transform var(--transition-fast);
}

/* 響應式設計 */
@media (max-width: 640px) {
  .dropdown-menu {
    max-width: calc(100vw - 16px);
    max-height: 60vh;
  }
}
</style>