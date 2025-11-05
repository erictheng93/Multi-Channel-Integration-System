<template>
  <div class="team-list-skeleton">
    <div
      v-for="index in count"
      :key="`team-skeleton-${index}`"
      class="team-skeleton-card"
      :style="{ animationDelay: `${index * 0.08}s` }"
    >
      <!-- 团队图标 -->
      <div class="team-skeleton-icon" />

      <!-- 团队信息 -->
      <div class="team-skeleton-info">
        <!-- 团队名称 -->
        <div
          class="team-skeleton-name"
          :style="{ width: getRandomWidth(60, 85) }"
        />
        <!-- 成员数量 -->
        <div
          class="team-skeleton-count"
          :style="{ width: getRandomWidth(40, 60) }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  count?: number
}

withDefaults(defineProps<Props>(), {
  count: 3
})

// 生成随机宽度避免过于统一的感觉
const getRandomWidth = (min: number, max: number) => {
  const width = Math.floor(Math.random() * (max - min + 1)) + min
  return `${width}%`
}
</script>

<style scoped>
.team-list-skeleton {
  display: grid;
  gap: var(--space-2);
}

.team-skeleton-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: white;
  animation: skeleton-fade-in 0.5s ease-out forwards;
  opacity: 0;
}

@keyframes skeleton-fade-in {
  to {
    opacity: 1;
  }
}

.team-skeleton-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, #e0e7ff 0px, #c7d2fe 40px, #e0e7ff 80px);
  background-size: 400px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

.team-skeleton-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.team-skeleton-name,
.team-skeleton-count {
  height: 16px;
  background: linear-gradient(90deg, #f0f0f0 0px, #e0e0e0 40px, #f0f0f0 80px);
  background-size: 400px;
  border-radius: 4px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.team-skeleton-name {
  height: 18px;
  font-weight: 600;
}

.team-skeleton-count {
  height: 14px;
}

/* Shimmer 动画效果 */
@keyframes skeleton-shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .team-skeleton-icon,
  .team-skeleton-name,
  .team-skeleton-count {
    animation: none;
  }

  .team-skeleton-card {
    animation: none;
    opacity: 1;
  }
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .team-skeleton-card {
    background: var(--gray-800);
    border-color: var(--gray-700);
  }

  .team-skeleton-icon {
    background: linear-gradient(90deg, #4338ca 0px, #6366f1 40px, #4338ca 80px);
    background-size: 400px;
  }

  .team-skeleton-name,
  .team-skeleton-count {
    background: linear-gradient(90deg, #374151 0px, #4b5563 40px, #374151 80px);
    background-size: 400px;
  }
}
</style>
