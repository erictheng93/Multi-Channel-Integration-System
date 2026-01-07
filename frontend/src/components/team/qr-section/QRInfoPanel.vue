<template>
  <div class="qr-info-panel">
    <!-- Header with Title and Actions -->
    <div class="qr-info-header">
      <h4>LINE 官方帳號連結</h4>
      <div class="qr-actions">
        <button
          class="btn-icon-sm"
          title="重新生成 QR Code"
          :disabled="regenerating"
          @click="$emit('regenerate')"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0115-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 01-15 6.7L3 16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- LIFF URL Display -->
    <div class="url-display">
      <div class="url-text">
        <span class="url-label">LIFF 連結</span>
        <code class="url-value">{{ liffUrl }}</code>
      </div>
      <button
        class="btn-copy"
        :class="{ 'copied': urlCopied }"
        @click="handleCopyUrl"
      >
        <svg
          v-if="!urlCopied"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect
            x="9"
            y="9"
            width="13"
            height="13"
            rx="2"
            ry="2"
          />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {{ urlCopied ? '已複製' : '複製' }}
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="qr-stats-mini">
      <div class="qr-stat-item">
        <span class="qr-stat-label">掃描次數</span>
        <span class="qr-stat-value">
          {{ scanCount }}
          <span class="qr-stat-max">次</span>
        </span>
      </div>
      <div class="qr-stat-item">
        <span class="qr-stat-label">成功分配</span>
        <span class="qr-stat-value">
          {{ assignmentCount }}
          <span class="qr-stat-max">人</span>
        </span>
      </div>
      <div class="qr-stat-item">
        <span class="qr-stat-label">建立時間</span>
        <span class="qr-stat-value">{{ formatDate(createdAt) }}</span>
      </div>
      <div class="qr-stat-item">
        <span class="qr-stat-label">類型</span>
        <span class="qr-stat-value">
          <span style="color: #06c755; font-weight: 500;">LIFF永久</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * QRInfoPanel Component
 *
 * Extracted from TeamCard.vue (lines 390-493, 1888-2056)
 * Displays QR Code information panel with stats and actions
 *
 * Features:
 * - LIFF URL display with copy functionality
 * - Statistics grid (scans, assignments, etc.)
 * - Regenerate action button
 * - Date formatting
 */

import { ref } from 'vue'

interface Props {
  /** LIFF URL for LINE official account */
  liffUrl: string

  /** Number of times QR Code has been scanned */
  scanCount: number

  /** Number of successful customer assignments */
  assignmentCount: number

  /** QR Code creation timestamp */
  createdAt: string

  /** Regeneration in progress */
  regenerating?: boolean
}

interface Emits {
  /** Emitted when regenerate button is clicked */
  (_e: 'regenerate'): void

  /** Emitted when copy URL button is clicked */
  (_e: 'copy-url'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const urlCopied = ref(false)

const handleCopyUrl = () => {
  emit('copy-url')
  urlCopied.value = true
  setTimeout(() => {
    urlCopied.value = false
  }, 2000)
}

const formatDate = (dateString: string | Date | undefined): string => {
  if (!dateString) {
    return '無期限'
  }
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) {
    return '無效日期'
  }
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<style scoped>
.qr-info-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

.qr-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.qr-info-header h4 {
  color: #1e293b;
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qr-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-icon-sm {
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748b;
  flex-shrink: 0;
}

.btn-icon-sm:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
  transform: translateY(-1px);
}

.btn-icon-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.url-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  min-width: 0;
  overflow: hidden;
}

.url-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.url-label {
  color: #94a3b8;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.url-value {
  color: #475569;
  font-size: 0.8125rem;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  background: none;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border: 1px solid #667eea;
  background: linear-gradient(135deg, #667eea10, #764ba210);
  color: #667eea;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-copy:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-copy.copied {
  background: linear-gradient(135deg, #10b981, #059669);
  border-color: #10b981;
  color: white;
}

.qr-stats-mini {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.qr-stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  min-width: 0;
  overflow: hidden;
}

.qr-stat-label {
  color: #94a3b8;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.qr-stat-value {
  color: #1e293b;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qr-stat-max {
  color: #94a3b8;
  font-weight: 500;
}

/* ============================================
   Responsive - RWD
   ============================================ */

/* Mobile */
@media (max-width: 640px) {
  .qr-info-header {
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }

  .qr-info-header h4 {
    text-align: center;
  }

  .url-display {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .btn-copy {
    justify-content: center;
  }

  .qr-stats-mini {
    grid-template-columns: 1fr 1fr;
  }
}

/* Small Mobile */
@media (max-width: 375px) {
  .qr-stats-mini {
    grid-template-columns: 1fr;
  }
}
</style>
