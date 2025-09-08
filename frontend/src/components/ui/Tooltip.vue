<template>
  <div
    ref="containerRef"
    class="tooltip-container"
  >
    <div
      ref="triggerRef"
      class="tooltip-trigger"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @focus="handleFocus"
      @blur="handleBlur"
      @click="handleClick"
    >
      <slot />
    </div>

    <Teleport to="body">
      <div
        v-if="isVisible"
        ref="tooltipRef"
        :style="tooltipStyles"
        class="tooltip"
        :class="[
          `tooltip-${placement}`,
          `tooltip-${variant}`,
          { 'tooltip-arrow': showArrow }
        ]"
        role="tooltip"
        :aria-hidden="!isVisible"
      >
        <div class="tooltip-content">
          <slot name="content">
            {{ content }}
          </slot>
        </div>
        <div
          v-if="showArrow"
          class="tooltip-arrow-element"
          :class="`arrow-${placement}`"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted } from 'vue'

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
type Trigger = 'hover' | 'focus' | 'click' | 'manual'
type Variant = 'dark' | 'light' | 'primary' | 'danger'

interface Props {
  content?: string
  placement?: Placement
  trigger?: Trigger | Trigger[]
  variant?: Variant
  disabled?: boolean
  delay?: number
  hideDelay?: number
  showArrow?: boolean
  offset?: number
  maxWidth?: string
}

/* eslint-disable no-unused-vars */
interface Emits {
  (e: 'show'): void
  (e: 'hide'): void
}
/* eslint-enable no-unused-vars */

const props = withDefaults(defineProps<Props>(), {
  content: '',
  placement: 'top',
  trigger: 'hover',
  variant: 'dark',
  disabled: false,
  delay: 100,
  hideDelay: 100,
  showArrow: true,
  offset: 8,
  maxWidth: '200px'
})

const emit = defineEmits<Emits>()

const containerRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const tooltipRef = ref<HTMLElement>()
const isVisible = ref(false)
const tooltipStyles = ref({})

let showTimer: NodeJS.Timeout | null = null
let hideTimer: NodeJS.Timeout | null = null

const triggers = computed(() => {
  return Array.isArray(props.trigger) ? props.trigger : [props.trigger]
})

const clearTimers = () => {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const show = () => {
  if (props.disabled) {return}
  
  clearTimers()
  showTimer = setTimeout(async () => {
    isVisible.value = true
    emit('show')
    
    await nextTick()
    calculatePosition()
  }, props.delay)
}

const hide = () => {
  clearTimers()
  hideTimer = setTimeout(() => {
    isVisible.value = false
    emit('hide')
  }, props.hideDelay)
}

const calculatePosition = () => {
  if (!triggerRef.value || !tooltipRef.value) {return}
  
  const trigger = triggerRef.value.getBoundingClientRect()
  const tooltip = tooltipRef.value.getBoundingClientRect()
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  }
  
  let left = 0
  let top = 0
  
  // 基礎位置計算
  switch (props.placement) {
    case 'top':
      left = trigger.left + trigger.width / 2 - tooltip.width / 2
      top = trigger.top - tooltip.height - props.offset
      break
    case 'top-start':
      left = trigger.left
      top = trigger.top - tooltip.height - props.offset
      break
    case 'top-end':
      left = trigger.right - tooltip.width
      top = trigger.top - tooltip.height - props.offset
      break
    case 'bottom':
      left = trigger.left + trigger.width / 2 - tooltip.width / 2
      top = trigger.bottom + props.offset
      break
    case 'bottom-start':
      left = trigger.left
      top = trigger.bottom + props.offset
      break
    case 'bottom-end':
      left = trigger.right - tooltip.width
      top = trigger.bottom + props.offset
      break
    case 'left':
      left = trigger.left - tooltip.width - props.offset
      top = trigger.top + trigger.height / 2 - tooltip.height / 2
      break
    case 'right':
      left = trigger.right + props.offset
      top = trigger.top + trigger.height / 2 - tooltip.height / 2
      break
  }
  
  // 邊界檢查和調整
  const padding = 8
  left = Math.max(padding, Math.min(left, viewport.width - tooltip.width - padding))
  top = Math.max(padding, Math.min(top, viewport.height - tooltip.height - padding))
  
  tooltipStyles.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 1050,
    maxWidth: props.maxWidth
  }
}

// 事件處理
const handleMouseEnter = () => {
  if (triggers.value.includes('hover')) {
    show()
  }
}

const handleMouseLeave = () => {
  if (triggers.value.includes('hover')) {
    hide()
  }
}

const handleFocus = () => {
  if (triggers.value.includes('focus')) {
    show()
  }
}

const handleBlur = () => {
  if (triggers.value.includes('focus')) {
    hide()
  }
}

const handleClick = () => {
  if (triggers.value.includes('click')) {
    if (isVisible.value) {
      hide()
    } else {
      show()
    }
  }
}

// 手動控制方法
const showTooltip = () => show()
const hideTooltip = () => hide()
const toggleTooltip = () => {
  if (isVisible.value) {
    hide()
  } else {
    show()
  }
}

// 清理
onUnmounted(() => {
  clearTimers()
})

// 暴露方法
defineExpose({
  show: showTooltip,
  hide: hideTooltip,
  toggle: toggleTooltip
})
</script>

<style scoped>
.tooltip-container {
  display: inline-block;
}

.tooltip-trigger {
  display: inline-block;
}

.tooltip {
  position: fixed;
  z-index: 1050;
  font-size: 0.875rem;
  line-height: 1.4;
  word-wrap: break-word;
  animation: tooltipFadeIn 0.15s ease-out;
}

.tooltip-content {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  white-space: nowrap;
  max-width: 100%;
  word-break: break-word;
  white-space: normal;
}

/* 變體樣式 */
.tooltip-dark .tooltip-content {
  background-color: var(--gray-900);
  color: white;
  box-shadow: var(--shadow-lg);
}

.tooltip-light .tooltip-content {
  background-color: white;
  color: var(--gray-900);
  border: 1px solid var(--gray-200);
  box-shadow: var(--shadow-lg);
}

.tooltip-primary .tooltip-content {
  background-color: var(--primary-600);
  color: white;
  box-shadow: var(--shadow-lg);
}

.tooltip-danger .tooltip-content {
  background-color: var(--red-600);
  color: white;
  box-shadow: var(--shadow-lg);
}

/* 箭頭樣式 */
.tooltip-arrow-element {
  position: absolute;
  width: 0;
  height: 0;
}

.tooltip-dark .arrow-top,
.tooltip-dark .arrow-top-start,
.tooltip-dark .arrow-top-end {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--gray-900);
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-dark .arrow-bottom,
.tooltip-dark .arrow-bottom-start,
.tooltip-dark .arrow-bottom-end {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid var(--gray-900);
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-dark .arrow-left {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid var(--gray-900);
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
}

.tooltip-dark .arrow-right {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid var(--gray-900);
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
}

/* 其他變體的箭頭（類似結構，顏色不同） */
.tooltip-light .arrow-top,
.tooltip-light .arrow-top-start,
.tooltip-light .arrow-top-end {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid white;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.tooltip-primary .arrow-top,
.tooltip-primary .arrow-top-start,
.tooltip-primary .arrow-top-end {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--primary-600);
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-danger .arrow-top,
.tooltip-danger .arrow-top-start,
.tooltip-danger .arrow-top-end {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid var(--red-600);
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 響應式設計 */
@media (max-width: 640px) {
  .tooltip {
    font-size: 0.8125rem;
  }
  
  .tooltip-content {
    max-width: calc(100vw - 16px);
    padding: var(--space-3) var(--space-4);
  }
}
</style>