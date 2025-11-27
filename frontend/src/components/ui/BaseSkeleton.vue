<template>
  <div
    class="base-skeleton"
    :class="[
      `skeleton-${variant}`,
      { 'skeleton-animated': animated }
    ]"
    :style="computedStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  // 骨架類型
  variant?: 'text' | 'circle' | 'rect' | 'card' | 'avatar' | 'button'
  // 寬度 (支援 px, %, rem 等)
  width?: string | number
  // 高度 (支援 px, %, rem 等)
  height?: string | number
  // 圓角 (僅 rect 和 card 類型)
  borderRadius?: string | number
  // 是否啟用動畫
  animated?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  width: '100%',
  height: 'auto',
  borderRadius: undefined,
  animated: true
})

const computedStyle = computed(() => {
  const style: Record<string, string> = {}

  // 處理寬度
  if (props.width !== undefined) {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }

  // 處理高度
  if (props.height !== 'auto') {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  // 處理圓角 (覆蓋預設值)
  if (props.borderRadius !== undefined) {
    style.borderRadius = typeof props.borderRadius === 'number'
      ? `${props.borderRadius}px`
      : props.borderRadius
  }

  return style
})
</script>

<style scoped>
.base-skeleton {
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 400% 100%;
}

/* 啟用動畫 */
.skeleton-animated {
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* 文字骨架 */
.skeleton-text {
  height: 1rem;
  border-radius: 4px;
}

/* 圓形骨架 (頭像等) */
.skeleton-circle {
  border-radius: 50%;
  aspect-ratio: 1;
}

/* 矩形骨架 */
.skeleton-rect {
  border-radius: 8px;
}

/* 卡片骨架 */
.skeleton-card {
  border-radius: 16px;
  min-height: 100px;
}

/* 頭像骨架 */
.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 按鈕骨架 */
.skeleton-button {
  height: 40px;
  border-radius: 8px;
}

/* 減少動畫偏好 */
@media (prefers-reduced-motion: reduce) {
  .skeleton-animated {
    animation: none;
    background: #e5e7eb;
  }
}

/* 暗色主題支援 */
@media (prefers-color-scheme: dark) {
  .base-skeleton {
    background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
    background-size: 400% 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .base-skeleton {
      background: #374151;
    }
  }
}
</style>
