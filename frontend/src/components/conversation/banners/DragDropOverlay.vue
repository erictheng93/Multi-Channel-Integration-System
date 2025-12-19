<template>
  <div
    v-if="isVisible"
    class="drag-drop-overlay"
    @dragover.prevent
    @drop.prevent="$emit('drop', $event)"
  >
    <div class="overlay-content">
      <div class="upload-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </div>
      <div class="upload-text">
        <strong>放開以上傳檔案</strong>
        <span class="upload-hint">支援圖片、影片、文件等格式</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DragDropOverlay - 拖放上傳覆蓋層組件
 *
 * 當用戶拖拽檔案到對話區域時顯示的全屏覆蓋層。
 *
 * 使用示例：
 * <DragDropOverlay
 *   :is-visible="isDragging"
 *   @drop="handleFileDrop"
 * />
 */

// ===== Props =====
defineProps<{
  isVisible: boolean
}>()

// ===== Emits =====
defineEmits<{
  drop: [event: DragEvent]
}>()
</script>

<style scoped>
.drag-drop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(59, 130, 246, 0.95);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.overlay-content {
  text-align: center;
  color: white;
  pointer-events: none;
}

.upload-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  margin: 0 auto 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  animation: bounce 1s infinite, pulseGlow 2s infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
  }
  50% {
    box-shadow: 0 0 0 20px rgba(255, 255, 255, 0);
  }
}

.upload-icon svg {
  width: 48px;
  height: 48px;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-text strong {
  font-size: 24px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.upload-hint {
  font-size: 16px;
  opacity: 0.9;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .upload-icon {
    width: 80px;
    height: 80px;
    margin-bottom: 16px;
  }

  .upload-icon svg {
    width: 40px;
    height: 40px;
  }

  .upload-text strong {
    font-size: 20px;
  }

  .upload-hint {
    font-size: 14px;
  }
}
</style>
