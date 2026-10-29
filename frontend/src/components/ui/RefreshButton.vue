<template>
  <button
    class="btn btn-secondary btn-sm refresh-btn"
    :class="{ 'loading': loading }"
    :disabled="loading"
    @click="handleRefresh"
  >
    <svg
      class="refresh-icon"
      :class="{ 'spinning': loading }"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
    <span class="refresh-text">{{ loading ? '重新整理中…' : '重新整理' }}</span>
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
/* Look comes from the global .btn-secondary .btn-sm; only the icon motion lives here */
.refresh-icon {
  flex-shrink: 0;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

.refresh-text {
  white-space: nowrap;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .refresh-icon.spinning {
    animation: none;
  }
}
</style>
