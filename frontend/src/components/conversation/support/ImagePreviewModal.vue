<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="image-preview-overlay"
      @click="handleOverlayClick"
    >
      <div
        class="image-preview-modal"
        @click.stop
      >
        <!-- Header -->
        <div class="preview-header">
          <div class="preview-title">
            <h3>{{ imageName || '图片预览' }}</h3>
            <span
              v-if="imageSize"
              class="preview-meta"
            >
              {{ formattedSize }}
            </span>
          </div>
          <div class="preview-actions">
            <button
              class="preview-btn"
              title="下载"
              @click="handleDownload"
            >
              <DownloadIcon />
            </button>
            <button
              class="preview-btn close"
              title="关闭 (ESC)"
              @click="handleClose"
            >
              <XIcon />
            </button>
          </div>
        </div>

        <!-- Image Content -->
        <div class="preview-content">
          <div class="image-wrapper">
            <img
              :src="imageUrl"
              :alt="imageName || '图片'"
              class="preview-image"
              :style="{ transform: `scale(${currentZoom})` }"
              loading="lazy"
              @wheel="handleWheel"
            >
          </div>
        </div>

        <!-- Zoom Controls -->
        <div class="preview-controls">
          <button
            class="zoom-btn"
            title="缩小 (-)"
            :disabled="currentZoom <= minZoom"
            @click="zoomOut"
          >
            <span>-</span>
          </button>
          <span class="zoom-level">{{ Math.round(currentZoom * 100) }}%</span>
          <button
            class="zoom-btn"
            title="放大 (+)"
            :disabled="currentZoom >= maxZoom"
            @click="zoomIn"
          >
            <span>+</span>
          </button>
          <button
            class="zoom-btn reset"
            title="重置 (1:1)"
            @click="resetZoom"
          >
            <span>重置</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatFileSize } from '@/utils/message/formatting'
import { DownloadIcon, XIcon } from '@/components/icons'

interface Props {
  show: boolean
  imageUrl: string
  imageName?: string
  imageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  imageName: '',
  imageSize: 0
})

interface Emits {
  (e: 'close'): void
  (e: 'download'): void
}

const emit = defineEmits<Emits>()

const currentZoom = ref(1)
const minZoom = 0.5
const maxZoom = 3
const zoomStep = 1.2

const formattedSize = computed(() => {
  return props.imageSize ? formatFileSize(props.imageSize) : ''
})

const zoomIn = () => {
  currentZoom.value = Math.min(currentZoom.value * zoomStep, maxZoom)
}

const zoomOut = () => {
  currentZoom.value = Math.max(currentZoom.value / zoomStep, minZoom)
}

const resetZoom = () => {
  currentZoom.value = 1
}

const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  if (event.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const handleClose = () => {
  emit('close')
}

const handleOverlayClick = () => {
  emit('close')
}

const handleDownload = () => {
  emit('download')
}

const handleEscKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.show) {
    handleClose()
  }
}

watch(() => props.show, (newShow) => {
  if (newShow) {
    currentZoom.value = 1
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKey)
})
</script>

<style scoped>
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.image-preview-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.preview-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 500px;
}

.preview-meta {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  color: #6b7280;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.preview-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  background: #e5e7eb;
  color: #374151;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-btn:hover {
  background: #d1d5db;
  transform: translateY(-1px);
}

.preview-btn:active {
  transform: translateY(0);
}

.preview-btn.close {
  background: #fee2e2;
  color: #dc2626;
}

.preview-btn.close:hover {
  background: #fecaca;
}

.preview-btn svg {
  width: 20px;
  height: 20px;
}

.preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background: #f9fafb;
}

.image-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.2s ease;
  cursor: move;
}

.preview-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.zoom-btn {
  min-width: 40px;
  height: 40px;
  padding: 0 16px;
  border: none;
  background: white;
  color: #374151;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid #e5e7eb;
}

.zoom-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.zoom-btn:active:not(:disabled) {
  transform: translateY(0);
}

.zoom-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.zoom-btn.reset {
  padding: 0 20px;
}

.zoom-level {
  min-width: 60px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

@media (max-width: 768px) {
  .image-preview-modal {
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
  }

  .preview-header {
    padding: 16px;
  }

  .preview-title h3 {
    font-size: 16px;
    max-width: 200px;
  }

  .preview-content {
    padding: 16px;
  }

  .preview-controls {
    padding: 16px;
    gap: 8px;
  }

  .zoom-btn {
    min-width: 36px;
    height: 36px;
    font-size: 14px;
  }

  .zoom-btn.reset {
    padding: 0 16px;
  }
}
</style>
