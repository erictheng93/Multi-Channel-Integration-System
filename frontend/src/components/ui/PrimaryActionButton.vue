<template>
  <component
    :is="to ? 'router-link' : 'button'"
    :to="to"
    class="btn btn-ghost primary-action-btn"
    :class="{ 'loading': loading }"
    :disabled="loading || disabled"
    @click="handleClick"
  >
    <component
      :is="icon"
      v-if="icon"
      class="action-icon"
      :class="{ 'spinning': loading && spinIcon }"
    />
    <span class="action-text">{{ loading && loadingText ? loadingText : text }}</span>
  </component>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  text: string
  icon?: Component
  to?: string
  loading?: boolean
  loadingText?: string
  spinIcon?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  to: undefined,
  loading: false,
  loadingText: '載入中...',
  spinIcon: false,
  disabled: false
})

const emit = defineEmits<Emits>()

const handleClick = () => {
  if (!props.loading && !props.disabled && !props.to) {
    emit('click')
  }
}
</script>

<style scoped>
.primary-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  font-size: 1.05rem;
  min-height: 48px;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
  text-decoration: none;
  border: none;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.025em;
}

.primary-action-btn:hover:not(:disabled) {
  transform: translateY(-2.5px);
  box-shadow: 0 7px 22px rgba(0, 0, 0, 0.15);
  background-color: var(--gray-100);
}

.primary-action-btn:active:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.primary-action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.action-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  stroke-width: 2.2;
}

/* 確保 SVG 圖標樣式一致 */
.action-icon :deep(svg) {
  stroke-width: 2.2;
  width: 26px;
  height: 26px;
}

.primary-action-btn:hover:not(:disabled) .action-icon {
  transform: scale(1.05);
}

.action-icon.spinning {
  animation: spin 1s linear infinite;
}

.action-text {
  font-weight: 600;
  font-size: 1rem;
  white-space: nowrap;
  letter-spacing: 0.025em;
}

.primary-action-btn.loading .action-text {
  color: var(--primary-600);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 添加微妙的脈衝效果 */
.primary-action-btn.loading::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 確保 router-link 樣式一致 */
.primary-action-btn[href] {
  color: inherit;
  text-decoration: none;
}

.primary-action-btn[href]:hover {
  color: inherit;
  text-decoration: none;
}
</style>