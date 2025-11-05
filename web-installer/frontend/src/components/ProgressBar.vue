<template>
  <div class="progress-bar">
    <div class="progress-info">
      <span class="progress-label">{{ label }}</span>
      <span class="progress-percentage">{{ displayProgress }}%</span>
    </div>
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: `${displayProgress}%` }"
        :class="{ 'progress-complete': isComplete, 'progress-error': hasError }"
      >
        <div class="progress-shimmer"></div>
      </div>
    </div>
    <div v-if="stepText" class="progress-step">
      {{ stepText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// ========================================
// PROPS
// ========================================

interface Props {
  progress: number;
  label?: string;
  stepText?: string;
  isComplete?: boolean;
  hasError?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  progress: 0,
  label: 'Progress',
  stepText: '',
  isComplete: false,
  hasError: false
});

// ========================================
// COMPUTED
// ========================================

const displayProgress = computed(() => {
  return Math.min(Math.max(props.progress, 0), 100);
});
</script>

<style scoped>
.progress-bar {
  width: 100%;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.progress-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-gray-700);
}

.progress-percentage {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
}

.progress-track {
  position: relative;
  width: 100%;
  height: 12px;
  background: var(--color-gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  position: relative;
  height: 100%;
  background: var(--gradient-primary);
  border-radius: var(--radius-full);
  transition: width 0.5s ease;
  overflow: hidden;
}

.progress-fill.progress-complete {
  background: var(--gradient-success);
}

.progress-fill.progress-error {
  background: var(--gradient-error);
}

.progress-shimmer {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

.progress-step {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-gray-600);
  font-style: italic;
}
</style>
