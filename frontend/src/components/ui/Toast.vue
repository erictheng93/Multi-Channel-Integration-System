<template>
  <Teleport to="body">
    <Transition
      name="toast"
      appear
    >
      <div
        v-if="visible"
        class="toast-container"
        :class="toastClasses"
        @click="handleClick"
      >
        <div class="toast-content">
          <!-- Icon -->
          <div class="toast-icon">
            <component :is="iconComponent" />
          </div>
          
          <!-- Message -->
          <div class="toast-message">
            <div class="toast-title">
              {{ title }}
            </div>
            <div
              v-if="description"
              class="toast-description"
            >
              {{ description }}
            </div>
          </div>
          
          <!-- Timer Progress Bar -->
          <div
            v-if="showProgress"
            class="toast-progress"
          >
            <div 
              class="toast-progress-bar" 
              :style="{ width: `${progressPercentage}%` }"
            />
          </div>
          
          <!-- Close Button (Optional) -->
          <button 
            v-if="showCloseButton"
            class="toast-close"
            aria-label="關閉通知"
            @click.stop="close"
          >
            <CloseIcon />
          </button>
        </div>
        
        <!-- Action Button (Optional) -->
        <div
          v-if="actionText"
          class="toast-actions"
        >
          <button 
            class="toast-action-btn"
            @click.stop="handleAction"
          >
            {{ actionText }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// 導出類型供外部使用
export interface ToastProps {
  title: string
  description?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number // 持續時間（毫秒）
  showProgress?: boolean
  showCloseButton?: boolean
  actionText?: string
  onAction?: () => void
  onClose?: () => void
}

const props = withDefaults(defineProps<ToastProps>(), {
  type: 'success',
  duration: 4000, // 4秒
  showProgress: true,
  showCloseButton: false
})

const emit = defineEmits<{
  close: []
  action: []
}>()

// Icons - 您可以替換為項目中使用的圖標庫
const CheckCircleIcon = { template: `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
` }

const AlertCircleIcon = { template: `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
` }

const InfoIcon = { template: `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
    <path d="m9,12 l3,-3 l3,3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
` }

const CloseIcon = { template: `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
` }

// 狀態管理
const visible = ref(true)
const progressPercentage = ref(100)
let timer: NodeJS.Timeout | null = null
let progressTimer: NodeJS.Timeout | null = null

// 計算屬性
const toastClasses = computed(() => ({
  [`toast-${props.type}`]: true
}))

const iconComponent = computed(() => {
  switch (props.type) {
    case 'success': return CheckCircleIcon
    case 'error': return AlertCircleIcon
    case 'warning': return AlertCircleIcon
    case 'info': return InfoIcon
    default: return CheckCircleIcon
  }
})

// 方法
const close = () => {
  visible.value = false
  clearTimers()
  emit('close')
  props.onClose?.()
}

const handleClick = () => {
  if (props.actionText) {
    handleAction()
  } else {
    close()
  }
}

const handleAction = () => {
  emit('action')
  props.onAction?.()
  close()
}

const clearTimers = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

const startTimer = () => {
  if (props.duration <= 0) {return}

  // 主計時器
  timer = setTimeout(() => {
    close()
  }, props.duration)

  // 進度條計時器
  if (props.showProgress) {
    const interval = 50 // 50ms 更新一次
    const totalSteps = props.duration / interval
    let currentStep = 0

    progressTimer = setInterval(() => {
      currentStep++
      progressPercentage.value = Math.max(0, 100 - (currentStep / totalSteps) * 100)
      
      if (currentStep >= totalSteps) {
        clearInterval(progressTimer!)
        progressTimer = null
      }
    }, interval)
  }
}

// 生命週期
onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  clearTimers()
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  min-width: 320px;
  max-width: 480px;
  background: white;
  border-radius: 12px;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--gray-200, #e5e7eb);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toast-container:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 25px 30px -5px rgba(0, 0, 0, 0.15),
    0 15px 15px -5px rgba(0, 0, 0, 0.06);
}

.toast-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  position: relative;
}

.toast-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.toast-message {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
  color: var(--gray-900, #111827);
}

.toast-description {
  font-size: 13px;
  line-height: 1.4;
  margin-top: 4px;
  color: var(--gray-600, #6b7280);
}

.toast-close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: var(--gray-400, #9ca3af);
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.toast-close:hover {
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-600, #6b7280);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--gray-100, #f3f4f6);
}

.toast-progress-bar {
  height: 100%;
  transition: width 0.05s linear;
  border-radius: 0 0 12px 12px;
}

.toast-actions {
  padding: 0 16px 16px;
  display: flex;
  justify-content: flex-end;
}

.toast-action-btn {
  background: none;
  border: 1px solid var(--gray-300, #d1d5db);
  color: var(--gray-700, #374151);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toast-action-btn:hover {
  background: var(--gray-50, #f9fafb);
  border-color: var(--gray-400, #9ca3af);
}

/* 類型樣式 */
.toast-success .toast-icon {
  color: #10b981;
}

.toast-success .toast-progress-bar {
  background: #10b981;
}

.toast-error .toast-icon {
  color: #ef4444;
}

.toast-error .toast-progress-bar {
  background: #ef4444;
}

.toast-warning .toast-icon {
  color: #f59e0b;
}

.toast-warning .toast-progress-bar {
  background: #f59e0b;
}

.toast-info .toast-icon {
  color: #3b82f6;
}

.toast-info .toast-progress-bar {
  background: #3b82f6;
}

/* 動畫 */
.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition: all 0.2s ease-out;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 響應式設計 */
@media (max-width: 640px) {
  .toast-container {
    left: 16px;
    right: 16px;
    top: 16px;
    min-width: auto;
    max-width: none;
  }
  
  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(-100%);
  }
}
</style>