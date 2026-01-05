<template>
  <div class="stats-overview">
    <div class="stats-grid">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// 纯容器组件，使用 slot 来接收 StatCard 子组件
</script>

<style scoped>
.stats-overview {
  margin-bottom: var(--space-12);
}

.stats-grid {
  display: grid;
  /* 根据屏幕宽度动态调整列数和最小宽度 */
  grid-template-columns: repeat(auto-fit, minmax(clamp(240px, 20vw, 300px), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
