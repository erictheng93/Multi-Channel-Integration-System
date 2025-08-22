<template>
  <div 
    class="empty-state"
    :class="[size || 'medium']"
  >
    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-spinner"
    >
      <svg
        class="spinner"
        viewBox="0 0 50 50"
      >
        <circle
          class="path"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-miterlimit="10"
        />
      </svg>
    </div>

    <!-- Normal State -->
    <template v-else>
      <div class="empty-icon">
        <slot name="icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line
              x1="9"
              y1="9"
              x2="9.01"
              y2="9"
            />
            <line
              x1="15"
              y1="9"
              x2="15.01"
              y2="9"
            />
          </svg>
        </slot>
      </div>
      
      <div class="empty-content">
        <h3
          v-if="title"
          class="empty-title"
        >
          {{ title }}
        </h3>
        <p
          v-if="description"
          class="empty-description"
        >
          {{ description }}
        </p>
        
        <!-- Default slot for custom content -->
        <div
          v-if="$slots.default"
          class="empty-custom"
        >
          <slot />
        </div>
        
        <!-- Action button -->
        <div
          v-if="actionText || $slots.action"
          class="empty-actions"
        >
          <slot name="action">
            <button 
              v-if="actionText"
              class="empty-action"
              :disabled="loading"
              @click="$emit('action')"
            >
              {{ actionText }}
            </button>
          </slot>
        </div>
      </div>
    </template>

    <!-- Loading text -->
    <div
      v-if="loading && loadingText"
      class="loading-text"
    >
      {{ loadingText }}
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  description?: string
  actionText?: string
  loading?: boolean
  loadingText?: string
  size?: 'small' | 'medium' | 'large'
}

withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  actionText: '',
  loading: false,
  loadingText: '載入中...',
  size: 'medium'
})

defineEmits<{
  action: []
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
}

.empty-state.small {
  padding: var(--space-8);
}

.empty-state.medium {
  padding: var(--space-12);
}

.empty-state.large {
  padding: var(--space-16);
}

.empty-icon {
  margin-bottom: var(--space-6);
  color: var(--gray-400);
}

.empty-content {
  max-width: 400px;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
}

.empty-description {
  font-size: 0.875rem;
  color: var(--gray-600);
  line-height: 1.5;
  margin-bottom: var(--space-6);
}

.empty-custom {
  margin-bottom: var(--space-6);
}

.empty-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  flex-wrap: wrap;
}

.empty-action {
  padding: var(--space-2) var(--space-4);
  background: var(--primary-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.empty-action:hover:not(:disabled) {
  background: var(--primary-600);
  transform: translateY(-1px);
}

.empty-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-spinner {
  margin-bottom: var(--space-6);
}

.spinner {
  width: 40px;
  height: 40px;
  animation: rotate 2s linear infinite;
  color: var(--primary-500);
}

.path {
  stroke-dasharray: 90, 150;
  stroke-dashoffset: 0;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin-top: var(--space-4);
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
</style>