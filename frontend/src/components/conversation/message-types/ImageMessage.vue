<template>
  <div class="image-message">
    <div
      class="image-container"
      @click="handlePreviewClick"
    >
      <!-- Image loading state -->
      <div
        v-if="isLoading"
        class="image-placeholder loading"
      >
        <div class="loading-spinner" />
        <span class="loading-text">加載中...</span>
      </div>

      <!-- Image error state -->
      <div
        v-else-if="hasError"
        class="image-placeholder error"
      >
        <div class="error-icon">
          📷
        </div>
        <span class="error-text">圖片載入失敗</span>
      </div>

      <!-- Image display -->
      <div
        v-else
        class="image-wrapper"
      >
        <img
          :src="imageUrl"
          :alt="imageName || '圖片'"
          class="message-image-content"
          loading="lazy"
          @load="handleImageLoad"
          @error="handleImageError"
        >

        <!-- Image overlay with actions -->
        <div class="image-overlay">
          <div class="image-actions">
            <button
              class="image-action-btn preview-btn"
              title="檢視大圖"
              @click.stop="handlePreviewClick"
            >
              <SearchIcon />
            </button>
            <button
              class="image-action-btn download-btn"
              title="下載"
              @click.stop="handleDownloadClick"
            >
              <DownloadIcon />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Image caption -->
    <div
      v-if="caption"
      class="image-caption"
    >
      {{ caption }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Message } from '@/types'
import { SearchIcon, DownloadIcon } from '@/components/icons'

/**
 * ImageMessage Component
 *
 * Renders image messages with:
 * - Lazy loading
 * - Preview functionality
 * - Download capability
 * - Loading and error states
 * - Optional caption display
 *
 * @component
 */

interface Props {
  /** The message object */
  message: Message
  /** Image URL to display */
  imageUrl: string
  /** Image file name (for alt text and download) */
  imageName?: string
  /** Optional caption text */
  caption?: string
  /** Whether this is an outgoing message */
  isOutgoing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  imageName: '',
  caption: '',
  isOutgoing: false
})

const emit = defineEmits<Emits>()

interface Emits {
  /** Emitted when user clicks to preview image */
  (_e: 'preview', _message: Message): void
  /** Emitted when user clicks to download image */
  (_e: 'download', _url: string, _filename: string): void
  /** Emitted when image loads successfully */
  (_e: 'image-load', _message: Message): void
  /** Emitted when image fails to load */
  (_e: 'image-error', _message: Message): void
}

// ═══════════════════════════════════════════════════════════════
// State Management
// ═══════════════════════════════════════════════════════════════

const isLoading = ref(true)
const hasError = ref(false)

// ═══════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════

/**
 * Handle successful image load
 */
const handleImageLoad = () => {
  isLoading.value = false
  hasError.value = false
  emit('image-load', props.message)
}

/**
 * Handle image load error
 */
const handleImageError = () => {
  isLoading.value = false
  hasError.value = true
  emit('image-error', props.message)
}

/**
 * Handle preview button click
 */
const handlePreviewClick = () => {
  if (!hasError.value) {
    emit('preview', props.message)
  }
}

/**
 * Handle download button click
 */
const handleDownloadClick = () => {
  const filename = props.imageName || `image_${props.message.id}.jpg`
  emit('download', props.imageUrl, filename)
}
</script>

<style scoped>
.image-message {
  width: 100%;
  max-width: 300px;
}

.image-container {
  position: relative;
  width: 100%;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  /* 🔧 CLS FIX: 使用 aspect-ratio 預留空間，防止圖片載入後版面位移 */
  aspect-ratio: 4 / 3;
  max-height: 400px;
}

/* Image Wrapper */
.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.message-image-content {
  width: 100%;
  height: 100%;
  max-height: 400px;
  object-fit: contain;
  display: block;
}

/* Image Overlay */
.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.3s ease;
}

.image-container:hover .image-overlay {
  background: rgba(0, 0, 0, 0.3);
  opacity: 1;
}

/* Image Actions */
.image-actions {
  display: flex;
  gap: 12px;
  padding: 8px;
}

.image-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.95);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.image-action-btn:hover {
  background: white;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.image-action-btn:active {
  transform: scale(0.95);
}

.image-action-btn svg {
  width: 20px;
  height: 20px;
  color: #374151;
}

/* Loading State */
/* 🔧 CLS FIX: 載入狀態使用與圖片容器相同的 aspect-ratio */
.image-placeholder {
  width: 100%;
  aspect-ratio: 4 / 3;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  box-sizing: border-box;
}

.image-placeholder.loading {
  background: linear-gradient(
    90deg,
    #f3f4f6 0%,
    #e5e7eb 50%,
    #f3f4f6 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  color: #6b7280;
}

/* Error State */
.image-placeholder.error {
  background: #fef2f2;
  border: 1px dashed #f87171;
}

.error-icon {
  font-size: 48px;
  opacity: 0.5;
}

.error-text {
  font-size: 14px;
  color: #dc2626;
}

/* Image Caption */
.image-caption {
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: #374151;
  background: #f9fafb;
  border-radius: 6px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Responsive Design */
@media (max-width: 480px) {
  .image-message {
    max-width: 100%;
  }

  .image-wrapper {
    max-height: 300px;
  }

  .message-image-content {
    max-height: 300px;
  }

  .image-action-btn {
    width: 36px;
    height: 36px;
  }

  .image-action-btn svg {
    width: 18px;
    height: 18px;
  }
}
</style>
