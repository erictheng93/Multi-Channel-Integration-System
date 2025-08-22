<template>
  <div
    class="loading-spinner"
    :class="sizeClass"
  >
    <div
      class="spinner"
      :class="variantClass"
    />
    <span
      v-if="text"
      class="loading-text"
    >{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'white'
  text?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'primary',
  text: ''
})

const sizeClass = computed(() => `loading-${props.size}`)
const variantClass = computed(() => `spinner-${props.variant}`)
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.spinner {
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-xs .spinner {
  width: 12px;
  height: 12px;
  border-width: 1px;
}

.loading-sm .spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

.loading-md .spinner {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

.loading-lg .spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.spinner-primary {
  border: 2px solid var(--gray-200);
  border-top: 2px solid var(--primary-600);
}

.spinner-secondary {
  border: 2px solid var(--gray-300);
  border-top: 2px solid var(--gray-600);
}

.spinner-white {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
  
  .spinner::after {
    content: '⏳';
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
  }
}
</style>