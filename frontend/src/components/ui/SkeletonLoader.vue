<template>
  <div 
    class="skeleton-loader"
    :data-variant="variant"
    :class="{ 'animated': animated }"
  >
    <div 
      v-for="index in count" 
      :key="`skeleton-${index}`"
      class="skeleton-conversation-item"
      :style="{ animationDelay: `${index * 0.1}s` }"
    >
      <!-- 頭像區域 -->
      <div class="skeleton-avatar" />
      
      <!-- 內容區域 -->
      <div class="skeleton-content">
        <!-- 標題行 -->
        <div class="skeleton-header">
          <div
            class="skeleton-name"
            :style="{ width: getRandomWidth(60, 80) }"
          />
          <div
            class="skeleton-time"
            :style="{ width: getRandomWidth(40, 60) }"
          />
        </div>
        
        <!-- 訊息預覽 -->
        <div
          class="skeleton-message"
          :style="{ width: getRandomWidth(70, 90) }"
        />
        
        <!-- 標籤和狀態 -->
        <div class="skeleton-tags">
          <div
            class="skeleton-tag"
            :style="{ width: getRandomWidth(30, 50) }"
          />
          <div
            v-if="Math.random() > 0.5"
            class="skeleton-badge"
          />
        </div>
      </div>
      
      <!-- 右側狀態 -->
      <div class="skeleton-status">
        <div class="skeleton-dot" />
        <div
          v-if="Math.random() > 0.6"
          class="skeleton-count"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

interface Props {
  count?: number
  variant?: 'list' | 'grid'
  animated?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  count: 5,
  variant: 'list',
  animated: true
})

// Ensure props is recognized as used (TypeScript doesn't detect template usage)
if (typeof props !== 'undefined') { /* noop */ }

// 生成隨機寬度避免過於統一的感覺
const getRandomWidth = (min: number, max: number) => {
  const width = Math.floor(Math.random() * (max - min + 1)) + min
  return `${width}%`
}
</script>

<style scoped>
.skeleton-loader {
  @apply space-y-1;
}

.skeleton-conversation-item {
  @apply flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-100;
  animation: skeleton-fade-in 0.6s ease-out forwards;
  opacity: 0;
}

@keyframes skeleton-fade-in {
  to {
    opacity: 1;
  }
}

.skeleton-avatar {
  @apply w-12 h-12 rounded-full bg-gradient-to-r from-gray-200 to-gray-300;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

.skeleton-content {
  @apply flex-1 space-y-2;
}

.skeleton-header {
  @apply flex items-center justify-between;
}

.skeleton-name,
.skeleton-time,
.skeleton-message,
.skeleton-tag {
  @apply h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-name {
  @apply h-5 font-medium;
}

.skeleton-time {
  @apply h-3;
}

.skeleton-message {
  @apply h-4;
}

.skeleton-tags {
  @apply flex items-center gap-2;
}

.skeleton-tag {
  @apply h-5;
}

.skeleton-badge {
  @apply w-6 h-6 rounded-full bg-gradient-to-r from-red-200 to-red-300;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-status {
  @apply flex flex-col items-end gap-2;
  flex-shrink: 0;
}

.skeleton-dot {
  @apply w-3 h-3 rounded-full bg-gradient-to-r from-green-200 to-green-300;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-count {
  @apply w-8 h-6 rounded-full bg-gradient-to-r from-blue-200 to-blue-300;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

/* Shimmer 動畫效果 */
@keyframes skeleton-shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.skeleton-avatar,
.skeleton-name,
.skeleton-time,
.skeleton-message,
.skeleton-tag,
.skeleton-badge,
.skeleton-dot,
.skeleton-count {
  background: linear-gradient(90deg, #f0f0f0 0px, #e0e0e0 40px, #f0f0f0 80px);
  background-size: 400px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

/* 響應式調整 */
@media (max-width: 640px) {
  .skeleton-conversation-item {
    @apply p-3 gap-2;
  }
  
  .skeleton-avatar {
    @apply w-10 h-10;
  }
  
  .skeleton-header {
    @apply flex-col items-start gap-1;
  }
}

/* 暗色主題支援 */
@media (prefers-color-scheme: dark) {
  .skeleton-conversation-item {
    @apply bg-gray-800 border-gray-700;
  }
  
  .skeleton-avatar,
  .skeleton-name,
  .skeleton-time,
  .skeleton-message,
  .skeleton-tag,
  .skeleton-badge,
  .skeleton-dot,
  .skeleton-count {
    background: linear-gradient(90deg, #374151 0px, #4b5563 40px, #374151 80px);
    background-size: 400px;
  }
}

/* 減少動畫偏好 */
@media (prefers-reduced-motion: reduce) {
  .skeleton-avatar,
  .skeleton-name,
  .skeleton-time,
  .skeleton-message,
  .skeleton-tag,
  .skeleton-badge,
  .skeleton-dot,
  .skeleton-count {
    animation: none;
  }
  
  .skeleton-conversation-item {
    animation: none;
    opacity: 1;
  }
}

/* 網格變體 */
.skeleton-loader[data-variant="grid"] .skeleton-conversation-item {
  @apply flex-col text-center;
}

.skeleton-loader[data-variant="grid"] .skeleton-content {
  @apply items-center;
}
</style>