<template>
  <Transition name="fade-overlay">
    <div
      v-if="isVisible"
      class="drag-drop-overlay"
    >
      <div class="drag-drop-content">
        <div class="drag-drop-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49" />
          </svg>
        </div>
        <div class="drag-drop-text">
          <span class="drag-drop-title">{{ title }}</span>
          <span class="drag-drop-hint">{{ hint }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Drag and Drop Overlay Component
 *
 * 全屏拖放覆盖层，显示拖放文件的视觉反馈
 *
 * @component DragDropOverlay
 * @example
 * ```vue
 * <DragDropOverlay
 *   :is-visible="isDragging"
 *   title="放開以上傳檔案"
 *   hint="支援圖片、PDF、Word 等格式（單檔最大 10MB）"
 * />
 * ```
 */

interface Props {
  /**
   * 是否显示覆盖层
   */
  isVisible: boolean

  /**
   * 标题文本
   * @default '放開以上傳檔案'
   */
  title?: string

  /**
   * 提示文本
   * @default '支援圖片、PDF、Word 等格式（單檔最大 10MB）'
   */
  hint?: string
}

withDefaults(defineProps<Props>(), {
  title: '放開以上傳檔案',
  hint: '支援圖片、PDF、Word 等格式（單檔最大 10MB）',
})
</script>

<style scoped>
/* ====== Drag-and-Drop Overlay Styles ====== */
.drag-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  background: rgba(99, 102, 241, 0.08);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px dashed #6366f1;
  border-radius: 12px;
  margin: 8px;
  pointer-events: none; /* 允许拖放事件穿透到父元素 */
}

.drag-drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  background: white;
  border-radius: 20px;
  box-shadow:
    0 20px 60px rgba(99, 102, 241, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.08);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow:
      0 20px 60px rgba(99, 102, 241, 0.15),
      0 8px 24px rgba(0, 0, 0, 0.08);
  }
  50% {
    box-shadow:
      0 20px 60px rgba(99, 102, 241, 0.25),
      0 8px 24px rgba(0, 0, 0, 0.12),
      0 0 0 4px rgba(99, 102, 241, 0.1);
  }
}

.drag-drop-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-radius: 50%;
  color: #6366f1;
  animation: bounce-gentle 1.5s ease-in-out infinite;
}

@keyframes bounce-gentle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.drag-drop-icon svg {
  filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3));
}

.drag-drop-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.drag-drop-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: -0.02em;
}

.drag-drop-hint {
  font-size: 0.875rem;
  color: #64748b;
  max-width: 280px;
  line-height: 1.5;
}

/* Fade overlay transition */
.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
}

.fade-overlay-enter-from .drag-drop-content,
.fade-overlay-leave-to .drag-drop-content {
  transform: scale(0.9);
  opacity: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .drag-drop-content {
    padding: 24px;
    margin: 16px;
  }

  .drag-drop-icon {
    width: 72px;
    height: 72px;
  }

  .drag-drop-icon svg {
    width: 40px;
    height: 40px;
  }

  .drag-drop-title {
    font-size: 1.25rem;
  }

  .drag-drop-hint {
    font-size: 0.75rem;
  }
}
</style>
