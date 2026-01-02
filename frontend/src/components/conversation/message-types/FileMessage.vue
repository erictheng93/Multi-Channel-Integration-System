<template>
  <div class="file-message">
    <div class="file-container">
      <!-- File Icon -->
      <div
        class="file-icon"
        :class="fileTypeClass"
      >
        <component :is="fileIconComponent" />
      </div>

      <!-- File Info -->
      <div class="file-info">
        <div
          class="file-name"
          :title="fileName"
        >
          {{ fileName }}
        </div>
        <div class="file-meta">
          <span
            v-if="fileSize"
            class="file-size"
          >{{ formattedFileSize }}</span>
          <span class="file-type">{{ fileExtension }}</span>
        </div>

        <!-- Upload Progress (optional) -->
        <div
          v-if="uploadProgress !== undefined && uploadProgress < 100"
          class="file-progress"
        >
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${uploadProgress}%` }"
            />
          </div>
          <span class="progress-text">{{ uploadProgress }}%</span>
        </div>
      </div>

      <!-- File Actions -->
      <div class="file-actions">
        <button
          class="file-action-btn primary"
          :disabled="!fileUrl || isUploading"
          @click="handleDownload"
        >
          <DownloadIcon />
          下載
        </button>
      </div>
    </div>

    <!-- File Caption -->
    <div
      v-if="caption"
      class="file-caption"
    >
      {{ caption }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/types'
import { formatFileSize, getFileExtension, getFileTypeClass } from '@/utils/message/formatting'
import { FileIcon, ImageIcon, DownloadIcon } from '@/components/icons'

/**
 * FileMessage Component
 *
 * Renders file attachments with:
 * - File type icon
 * - File name and metadata
 * - Upload progress (optional)
 * - Download functionality
 * - Optional caption
 *
 * @component
 */

interface Props {
  /** The message object */
  message: Message
  /** File URL for download */
  fileUrl: string
  /** File name to display */
  fileName: string
  /** File size in bytes (optional) */
  fileSize?: number
  /** Upload progress 0-100 (optional) */
  uploadProgress?: number
  /** Optional caption text */
  caption?: string
  /** Whether this is an outgoing message */
  isOutgoing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fileSize: 0,
  uploadProgress: undefined,
  caption: '',
  isOutgoing: false
})

interface Emits {
  /** Emitted when user clicks download button */
  (e: 'download', url: string, filename: string): void
}

const emit = defineEmits<Emits>()

// ═══════════════════════════════════════════════════════════════
// Computed Properties
// ═══════════════════════════════════════════════════════════════

/**
 * Formatted file size string
 */
const formattedFileSize = computed(() => {
  return props.fileSize ? formatFileSize(props.fileSize) : ''
})

/**
 * File extension (uppercase)
 */
const fileExtension = computed(() => {
  return getFileExtension(props.fileName)
})

/**
 * CSS class for file type styling
 */
const fileTypeClass = computed(() => {
  return getFileTypeClass(props.fileName)
})

/**
 * Icon component based on file type
 */
const fileIconComponent = computed(() => {
  const ext = props.fileName.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']

  return imageExts.includes(ext || '') ? ImageIcon : FileIcon
})

/**
 * Whether file is currently uploading
 */
const isUploading = computed(() => {
  return props.uploadProgress !== undefined && props.uploadProgress < 100
})

// ═══════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════

/**
 * Handle download button click
 */
const handleDownload = () => {
  if (props.fileUrl && !isUploading.value) {
    emit('download', props.fileUrl, props.fileName)
  }
}
</script>

<style scoped>
.file-message {
  width: 100%;
  max-width: 400px;
}

/* File Container */
.file-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.file-container:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* File Icon */
.file-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #e5e7eb;
  color: #6b7280;
}

.file-icon svg {
  width: 24px;
  height: 24px;
}

/* File type specific colors */
.file-icon.file-type-image {
  background: #dbeafe;
  color: #3b82f6;
}

.file-icon.file-type-document,
.file-icon.pdf {
  background: #fee2e2;
  color: #ef4444;
}

.file-icon.file-type-code {
  background: #d1fae5;
  color: #10b981;
}

.file-icon.file-type-archive {
  background: #fef3c7;
  color: #f59e0b;
}

/* File Info */
.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.file-size::after {
  content: '•';
  margin-left: 8px;
}

.file-type {
  text-transform: uppercase;
  font-weight: 500;
}

/* Upload Progress */
.file-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  font-weight: 500;
  color: #3b82f6;
  min-width: 35px;
  text-align: right;
}

/* File Actions */
.file-actions {
  flex-shrink: 0;
}

.file-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-action-btn:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

.file-action-btn:active:not(:disabled) {
  transform: translateY(0);
}

.file-action-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  opacity: 0.6;
}

.file-action-btn svg {
  width: 16px;
  height: 16px;
}

/* File Caption */
.file-caption {
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
  .file-message {
    max-width: 100%;
  }

  .file-container {
    gap: 8px;
    padding: 10px;
  }

  .file-icon {
    width: 40px;
    height: 40px;
  }

  .file-icon svg {
    width: 20px;
    height: 20px;
  }

  .file-name {
    font-size: 13px;
  }

  .file-meta {
    font-size: 11px;
  }

  .file-action-btn {
    padding: 6px 12px;
    font-size: 13px;
  }
}
</style>
