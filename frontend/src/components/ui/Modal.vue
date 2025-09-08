<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="modal-overlay"
      @click="handleOverlayClick"
    >
      <div 
        class="modal-container" 
        :class="[sizeClass, { 'modal-fullscreen': fullscreen }]"
        @click.stop
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
import { computed, watch, onMounted, onUnmounted } from 'vue'
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

const sizeClass = computed(() => `modal-${props.size}`)

const handleClose = () => {
  emit('close')
  emit('update:show', false)
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    handleClose()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    handleClose()
  }
}

// 鎖定body滾動
watch(() => props.show, (show) => {
  if (typeof document !== 'undefined') {
    if (show) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
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
  z-index: 1000;
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