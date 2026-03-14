<template>
  <div class="sticker-message">
    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="sticker-loading"
    >
      <div class="sticker-skeleton" />
      <div class="loading-spinner">
        <div class="spinner-ring" />
      </div>
      <div class="loading-text">
        載入貼圖中...
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="hasError"
      class="sticker-placeholder error"
    >
      <div class="sticker-icon-large">
        <div class="sticker-emoji">
          
        </div>
      </div>
      <div class="sticker-fallback-content">
        <div class="sticker-text">
          {{ fallbackText || '貼圖' }}
        </div>
        <div class="sticker-error-hint">
          貼圖載入失敗
        </div>
      </div>
    </div>

    <!-- Sticker Display -->
    <div
      v-else
      class="sticker-container"
    >
      <img
        :src="stickerUrl"
        alt="LINE Sticker"
        class="sticker-image"
        loading="lazy"
        @load="handleLoad"
        @error="handleError"
      >

      <!-- CDN Fallback Indicator -->
      <div
        v-if="cdnFallbackIndex > 0"
        class="cdn-fallback-indicator"
        :title="`使用備用CDN源 #${cdnFallbackIndex + 1}`"
      >
        
      </div>
    </div>

    <!-- Sticker Metadata (optional) -->
    <div
      v-if="showMetadata && stickerMetadata"
      class="sticker-info"
    >
      <span class="sticker-id-info">
         {{ stickerMetadata.packageId }} ·  {{ stickerMetadata.stickerId }}
      </span>
      <span
        v-if="cdnFallbackIndex > 0"
        class="cdn-info"
      >
        · CDN {{ cdnFallbackIndex + 1 }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Message } from '@/types'

/**
 * StickerMessage Component
 *
 * Renders LINE stickers with:
 * - Loading state
 * - Error handling with fallback
 * - CDN fallback mechanism
 * - Optional metadata display
 *
 * @component
 */

interface Props {
  /** The message object */
  message: Message
  /** Sticker image URL */
  stickerUrl: string
  /** Fallback text to display on error */
  fallbackText?: string
  /** Sticker metadata (package ID, sticker ID) */
  stickerMetadata?: {
    packageId: string
    stickerId: string
  }
  /** Whether to show metadata */
  showMetadata?: boolean
  /** Current CDN fallback index */
  cdnFallbackIndex?: number
  /** Whether this is an outgoing message */
  isOutgoing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fallbackText: '',
  stickerMetadata: undefined,
  showMetadata: false,
  cdnFallbackIndex: 0,
  isOutgoing: false
})

const emit = defineEmits<Emits>()

interface Emits {
  /** Emitted when sticker loads successfully */
  (_e: 'sticker-load', _message: Message): void
  /** Emitted when sticker fails to load */
  (_e: 'sticker-error', _message: Message): void
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
 * Handle successful sticker load
 */
const handleLoad = () => {
  isLoading.value = false
  hasError.value = false
  emit('sticker-load', props.message)
}

/**
 * Handle sticker load error
 */
const handleError = () => {
  isLoading.value = false
  hasError.value = true
  emit('sticker-error', props.message)
}
</script>

<style scoped>
.sticker-message {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Sticker Container */
.sticker-container {
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sticker-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Loading State */
.sticker-loading {
  width: 160px;
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  position: relative;
}

.sticker-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    #f3f4f6 0%,
    #e5e7eb 50%,
    #f3f4f6 100%
  );
  background-size: 200% 100%;
  border-radius: 12px;
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
  position: relative;
  z-index: 1;
}

.spinner-ring {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
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
  position: relative;
  z-index: 1;
  font-size: 12px;
  color: #6b7280;
}

/* Error State */
.sticker-placeholder {
  width: 160px;
  height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #fef2f2;
  border: 2px dashed #f87171;
  border-radius: 12px;
  padding: 16px;
}

.sticker-icon-large {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sticker-emoji {
  font-size: 48px;
  opacity: 0.5;
}

.sticker-fallback-content {
  text-align: center;
}

.sticker-text {
  font-size: 14px;
  color: #374151;
  margin-bottom: 4px;
}

.sticker-error-hint {
  font-size: 12px;
  color: #dc2626;
}

/* CDN Fallback Indicator */
.cdn-fallback-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background: rgba(59, 130, 246, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: help;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Sticker Metadata */
.sticker-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: #f3f4f6;
  border-radius: 12px;
  font-size: 11px;
  color: #6b7280;
}

.sticker-id-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cdn-info {
  color: #3b82f6;
  font-weight: 500;
}

/* Responsive Design */
@media (max-width: 480px) {
  .sticker-container,
  .sticker-loading,
  .sticker-placeholder {
    width: 120px;
    height: 120px;
  }

  .sticker-emoji {
    font-size: 36px;
  }

  .sticker-text {
    font-size: 12px;
  }

  .sticker-error-hint {
    font-size: 11px;
  }
}
</style>
