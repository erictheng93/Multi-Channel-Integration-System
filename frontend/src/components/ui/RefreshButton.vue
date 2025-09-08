<template>
  <button
    class="btn btn-ghost refresh-btn"
    :class="{ 'loading': loading }"
    :disabled="loading"
    @click="handleRefresh"
  >
    <svg
      class="refresh-icon"
      :class="{ 'spinning': loading }"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
    <span class="refresh-text">{{ loading ? '刷新中...' : '刷新' }}</span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  loading?: boolean
}

/* eslint-disable no-unused-vars */
interface Emits {
  (e: 'refresh'): void
}
/* eslint-enable no-unused-vars */

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

const handleRefresh = () => {
  if (!props.loading) {
    emit('refresh')
  }
}
</script>

<style scoped>
.refresh-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  font-size: 1rem;
  min-height: 44px;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.refresh-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  background-color: var(--gray-100);
}

.refresh-btn:active:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.refresh-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.refresh-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  stroke-width: 2.2;
}

.refresh-btn:hover:not(:disabled) .refresh-icon {
  transform: scale(1.05);
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

.refresh-text {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  letter-spacing: 0.025em;
}

.refresh-btn.loading .refresh-text {
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
.refresh-btn.loading::before {
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
</style>