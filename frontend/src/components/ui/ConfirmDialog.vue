<template>
  <Teleport to="body">
    <Transition
      name="dialog-overlay"
      appear
    >
      <div 
        v-if="visible"
        class="dialog-overlay"
        @click="handleOverlayClick"
      >
        <Transition
          name="dialog"
          appear
        >
          <div 
            class="dialog-container"
            :class="dialogClasses"
            @click.stop
          >
            <!-- Icon -->
            <div class="dialog-icon">
              <component :is="iconComponent" />
            </div>
            
            <!-- Content -->
            <div class="dialog-content">
              <h3 class="dialog-title">
                {{ title }}
              </h3>
              <p
                v-if="message"
                class="dialog-message"
              >
                {{ message }}
              </p>
            </div>
            
            <!-- Actions -->
            <div class="dialog-actions">
              <button 
                class="dialog-btn dialog-btn-secondary"
                :disabled="loading"
                @click="handleCancel"
              >
                {{ cancelText }}
              </button>
              <button 
                class="dialog-btn dialog-btn-primary"
                :class="{ [`dialog-btn-${type}`]: type !== 'default' }"
                :disabled="loading"
                @click="handleConfirm"
              >
                <LoadingSpinner
                  v-if="loading"
                  class="btn-spinner"
                />
                <span v-else>{{ confirmText }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<ConfirmDialogProps>(), {
  message: undefined,
  type: 'default',
  confirmText: '確定',
  cancelText: '取消',
  loading: false,
  closeOnOverlay: true,
  onConfirm: undefined,
  onCancel: undefined
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  close: []
}>()

// Loading Spinner Component
const LoadingSpinner = {
  template: `
    <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"/>
      <path fill="currentColor" class="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  `
}

// Icons
const QuestionIcon = {
  template: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `
}

const WarningIcon = {
  template: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" fill="none"/>
      <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
}

const DangerIcon = {
  template: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
      <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
}

const InfoIcon = {
  template: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M12 16v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `
}

export interface ConfirmDialogProps {
  title: string
  message?: string
  type?: 'default' | 'warning' | 'danger' | 'info'
  confirmText?: string
  cancelText?: string
  loading?: boolean
  closeOnOverlay?: boolean
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}

// 狀態
const visible = ref(true)

// 計算屬性
const dialogClasses = computed(() => ({
  [`dialog-${props.type}`]: props.type !== 'default'
}))

const iconComponent = computed(() => {
  switch (props.type) {
    case 'warning': return WarningIcon
    case 'danger': return DangerIcon
    case 'info': return InfoIcon
    default: return QuestionIcon
  }
})

// 方法
const close = () => {
  visible.value = false
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !props.loading) {
    handleCancel()
  }
}

const handleCancel = () => {
  if (props.loading) {return}
  
  emit('cancel')
  props.onCancel?.()
  close()
}

const handleConfirm = async () => {
  if (props.loading) {return}
  
  emit('confirm')
  
  if (props.onConfirm) {
    const result = props.onConfirm()
    if (result instanceof Promise) {
      await result
    }
  }
  
  close()
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.dialog-container {
  background: white;
  border-radius: 16px;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 420px;
  width: 100%;
  padding: 24px;
  text-align: center;
  border: 1px solid var(--gray-200, #e5e7eb);
}

.dialog-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-600, #6b7280);
  background: var(--gray-100, #f3f4f6);
}

.dialog-content {
  margin-bottom: 24px;
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.dialog-message {
  font-size: 0.95rem;
  color: var(--gray-600, #6b7280);
  line-height: 1.5;
  margin: 0;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.dialog-btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.dialog-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dialog-btn-secondary {
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-700, #374151);
  border-color: var(--gray-200, #e5e7eb);
}

.dialog-btn-secondary:hover:not(:disabled) {
  background: var(--gray-200, #e5e7eb);
  color: var(--gray-800, #1f2937);
}

.dialog-btn-primary {
  background: var(--blue-600, #2563eb);
  color: white;
}

.dialog-btn-primary:hover:not(:disabled) {
  background: var(--blue-700, #1d4ed8);
}

/* Type-specific styles */
.dialog-warning .dialog-icon {
  background: #fef3c7;
  color: #d97706;
}

.dialog-warning .dialog-btn-primary {
  background: #d97706;
}

.dialog-warning .dialog-btn-primary:hover:not(:disabled) {
  background: #b45309;
}

.dialog-danger .dialog-icon {
  background: #fee2e2;
  color: #dc2626;
}

.dialog-danger .dialog-btn-primary {
  background: #dc2626;
}

.dialog-danger .dialog-btn-primary:hover:not(:disabled) {
  background: #b91c1c;
}

.dialog-info .dialog-icon {
  background: #dbeafe;
  color: #2563eb;
}

.btn-spinner {
  width: 16px;
  height: 16px;
}

/* Animations */
.dialog-overlay-enter-active {
  transition: all 0.2s ease-out;
}

.dialog-overlay-leave-active {
  transition: all 0.15s ease-in;
}

.dialog-overlay-enter-from,
.dialog-overlay-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-leave-active {
  transition: all 0.2s ease-out;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-16px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Responsive */
@media (max-width: 480px) {
  .dialog-container {
    max-width: none;
    margin: 16px;
    padding: 20px;
  }
  
  .dialog-actions {
    flex-direction: column;
  }
  
  .dialog-btn {
    flex: none;
  }
}

/* CSS Animation for spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>