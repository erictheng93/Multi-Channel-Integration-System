<template>
  <div class="flex-bubble">
    <div class="bubble-body">
      <!-- LIFF QR Code Image -->
      <div class="qr-image-wrapper">
        <img
          v-if="!loading"
          :src="qrCodeUrl"
          alt="LINE LIFF QR Code"
          class="qr-image"
          @error="handleImageError"
        >
        <div
          v-else
          class="qr-loading-placeholder"
        >
          <div class="spinner" />
        </div>
      </div>

      <!-- Text Content -->
      <h2 class="bubble-title">
        {{ teamName }}
      </h2>
      <p class="bubble-subtitle">
        掃描加入 LINE 官方帳號
      </p>
    </div>

    <div class="bubble-footer">
      <button
        class="bubble-btn"
        :disabled="loading"
        @click="$emit('download')"
      >
        下載 QR Code
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * QRFlexBubbleCard Component
 *
 * Extracted from TeamCard.vue (lines 354-388, 1807-1887)
 * Displays QR Code in Flex Bubble design (matches QRcodeDesign.html)
 *
 * Features:
 * - iOS/Apple design language
 * - Professional card styling
 * - Download button
 * - Loading state support
 */

interface Props {
  /** QR Code image URL from R2 storage */
  qrCodeUrl: string

  /** Team name to display as title */
  teamName: string

  /** Loading state for QR Code image */
  loading?: boolean
}

interface Emits {
  /** Emitted when download button is clicked */
  (_e: 'download'): void

  /** Emitted when QR Code image fails to load */
  (_e: 'image-error'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleImageError = () => {
  console.error('QR Code image failed to load')
  emit('image-error')
}
</script>

<style scoped>
/* ============================================
   Flex Bubble Card - QRcodeDesign.html Style
   ============================================ */
.flex-bubble {
  background-color: #FFFFFF;
  width: 260px;
  min-width: 260px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  flex-shrink: 0;
}

.bubble-body {
  padding: 35px 30px 20px 30px;
}

.bubble-footer {
  padding: 0 20px 20px 20px;
}

/* QR Code Image - The Hero */
.qr-image-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 140px;
}

.qr-image {
  width: 140px;
  height: 140px;
  margin: 0 auto;
  display: block;
  object-fit: contain;
}

.qr-loading-placeholder {
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F2F2F7;
  border-radius: 12px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #E5E5EA;
  border-top-color: #007AFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Typography - iOS/Apple Style */
.bubble-title {
  color: #000000;
  font-size: 19px;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 0;
  letter-spacing: -0.5px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.bubble-subtitle {
  color: #8E8E93;
  font-size: 13px;
  margin-top: 8px;
  margin-bottom: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Footer Button - iOS Secondary Style */
.bubble-btn {
  display: block;
  width: 100%;
  text-decoration: none;
  line-height: 40px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  background-color: #F2F2F7;
  color: #007AFF;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.bubble-btn:hover:not(:disabled) {
  background-color: #E5E5EA;
}

.bubble-btn:active {
  background-color: #D1D1D6;
}

.bubble-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ============================================
   Responsive - RWD
   ============================================ */

/* Tablet */
@media (max-width: 768px) {
  .flex-bubble {
    width: 100%;
    max-width: 300px;
    min-width: auto;
  }
}

/* Mobile */
@media (max-width: 640px) {
  .flex-bubble {
    width: 100%;
    max-width: 280px;
    border-radius: 16px;
  }

  .bubble-body {
    padding: 28px 24px 16px 24px;
  }

  .bubble-footer {
    padding: 0 16px 16px 16px;
  }

  .qr-image {
    width: 120px;
    height: 120px;
  }

  .bubble-title {
    font-size: 17px;
    margin-top: 20px;
  }

  .bubble-subtitle {
    font-size: 12px;
    margin-top: 6px;
  }

  .bubble-btn {
    font-size: 14px;
    line-height: 36px;
  }
}

/* Small Mobile */
@media (max-width: 375px) {
  .flex-bubble {
    max-width: 100%;
    border-radius: 14px;
  }

  .bubble-body {
    padding: 24px 20px 14px 20px;
  }

  .bubble-footer {
    padding: 0 14px 14px 14px;
  }

  .qr-image {
    width: 110px;
    height: 110px;
  }

  .bubble-title {
    font-size: 16px;
    margin-top: 18px;
  }

  .bubble-subtitle {
    font-size: 11px;
  }

  .bubble-btn {
    font-size: 13px;
    line-height: 34px;
    border-radius: 8px;
  }
}
</style>
