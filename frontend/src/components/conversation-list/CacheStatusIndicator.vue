<!--
  Cache Status Indicator Component

  显示缓存命中率的视觉指示器

  @example
  <CacheStatusIndicator :hit-rate="85.5" />
-->
<template>
  <div
    class="cache-status-indicator"
    :title="`快取命中率: ${hitRate.toFixed(1)}%`"
  >
    <div class="cache-icon text-sm">
      ⚡
    </div>
    <span class="font-bold tracking-wider">{{ hitRate.toFixed(0) }}%</span>
  </div>
</template>

<script setup lang="ts">
export interface CacheStatusIndicatorProps {
  /** 缓存命中率（百分比 0-100） */
  hitRate?: number
}

withDefaults(defineProps<CacheStatusIndicatorProps>(), {
  hitRate: 0
})
</script>

<style scoped>
/* Cache Status Indicator - Gradient and effects */
.cache-status-indicator {
  @apply flex items-center gap-1 py-1 px-2 text-white rounded-full text-xs font-semibold;
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  transition: all 0.3s ease;
}

.cache-status-indicator:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

.cache-icon {
  animation: cache-pulse 2s ease-in-out infinite;
}

@keyframes cache-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}
</style>
