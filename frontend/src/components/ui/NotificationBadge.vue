<template>
  <span
    v-if="count > 0"
    class="notification-badge"
    :class="[sizeClass, variantClass, { 'notification-badge-pulse': pulse }]"
    :title="`${displayCount} 則未讀通知`"
  >
    {{ displayCount }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  count: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'danger' | 'warning'
  pulse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  max: 99,
  size: 'md',
  variant: 'danger',
  pulse: false
})

const displayCount = computed(() => {
  if (props.count > props.max) {
    return `${props.max}+`
  }
  return props.count.toString()
})

const sizeClass = computed(() => `notification-badge-${props.size}`)
const variantClass = computed(() => `notification-badge-${props.variant}`)
</script>

<style scoped>
.notification-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-radius: 9999px;
  white-space: nowrap;
  line-height: 1;
}

/* Size variants */
.notification-badge-sm {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
}

.notification-badge-md {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
}

.notification-badge-lg {
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
}

/* Color variants */
.notification-badge-primary {
  background-color: var(--primary-500);
  color: white;
}

.notification-badge-danger {
  background-color: var(--red-500);
  color: white;
}

.notification-badge-warning {
  background-color: var(--yellow-500);
  color: var(--gray-900);
}

/* Pulse animation */
.notification-badge-pulse {
  animation: badge-pulse 2s infinite;
}

@keyframes badge-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 currentColor;
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 4px transparent;
  }
}
</style>
