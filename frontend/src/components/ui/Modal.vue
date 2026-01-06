<template>
  <Teleport to="body">
    <div
      v-if="show"
      ref="overlayRef"
      class="modal-overlay"
    >
      <div
        ref="containerRef"
        class="modal-container"
        :class="[sizeClass, { 'modal-fullscreen': fullscreen }]"
      >
        <div
          v-if="showHeader"
          class="modal-header"
        >
          <div class="modal-title">
            <slot name="header">
              <h3>{{ title }}</h3>
            </slot>
          </div>
          <button
            v-if="showCloseButton"
            class="modal-close-btn"
            :aria-label="closeButtonLabel"
            @click="handleClose"
          >
            <XIcon />
          </button>
        </div>

        <div
          class="modal-body"
          :class="{ 'no-padding': noPadding }"
        >
          <slot />
        </div>

        <div
          v-if="$slots.footer"
          class="modal-footer"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { XIcon } from '@/components/icons'

interface Props {
  show: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fullscreen?: boolean
  closeOnOverlay?: boolean
  showHeader?: boolean
  showCloseButton?: boolean
  noPadding?: boolean
  closeButtonLabel?: string
}

/* eslint-disable no-unused-vars */
interface Emits {
  (e: 'close'): void
  (e: 'update:show', value: boolean): void
}
/* eslint-enable no-unused-vars */

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
  fullscreen: false,
  closeOnOverlay: true,
  showHeader: true,
  showCloseButton: true,
  noPadding: false,
  closeButtonLabel: '關閉'
})

const emit = defineEmits<Emits>()

// Refs
const overlayRef = ref<HTMLElement>()
const containerRef = ref<HTMLElement>()

const sizeClass = computed(() => `modal-${props.size}`)

const handleClose = () => {
  emit('close')
  emit('update:show', false)
}

// 新方案: 精确的外部点击检测
const handleClickOutside = (event: MouseEvent) => {
  if (!props.closeOnOverlay || !props.show) {
    return
  }

  const target = event.target

  // 检查点击是否在 modal-container 外部
  if (containerRef.value && target instanceof HTMLElement && !containerRef.value.contains(target)) {
    handleClose()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    handleClose()
  }
}

// 监听 show 变化，管理事件监听器
watch(() => props.show, (show) => {
  if (typeof document !== 'undefined') {
    if (show) {
      // Modal 打开时
      document.body.style.overflow = 'hidden'
      // 添加 ESC 键监听
      document.addEventListener('keydown', handleKeydown)
      // 添加外部点击监听 (延迟添加避免立即触发)
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
    } else {
      // Modal 关闭时
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('click', handleClickOutside)
    }
  }
})

onUnmounted(() => {
  // 组件卸载时清理所有监听器和样式
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleClickOutside)
  // 清理body樣式
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000; /* 新方案: 提升到最高层级 */
  padding: var(--space-4);
  backdrop-filter: blur(4px);
}

.modal-container {
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 100%;
  animation: modalEnter 0.2s ease-out;
}

.modal-sm {
  max-width: 400px;
}

.modal-md {
  max-width: 600px;
}

.modal-lg {
  max-width: 800px;
}

.modal-xl {
  max-width: 1200px;
}

.modal-fullscreen {
  max-width: none;
  max-height: none;
  height: 100vh;
  width: 100vw;
  border-radius: 0;
  margin: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-200);
  flex-shrink: 0;
}

.modal-title h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.modal-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.modal-close-btn:hover {
  background-color: var(--gray-100);
  color: var(--gray-700);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.modal-body.no-padding {
  padding: 0;
}

.modal-footer {
  padding: var(--space-6);
  border-top: 1px solid var(--gray-200);
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  flex-shrink: 0;
}

@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 響應式設計 */
@media (max-width: 640px) {
  .modal-overlay {
    padding: var(--space-2);
    align-items: flex-end;
  }
  
  .modal-container {
    max-height: 95vh;
    width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    animation: modalSlideUp 0.2s ease-out;
  }
  
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: var(--space-4);
  }
}

@keyframes modalSlideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>