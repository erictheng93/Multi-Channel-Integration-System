<template>
  <div
    class="file-attachment-card"
    :class="[
      `file-type-${fileTypeInfo.type}`,
      { 'card-compact': compact }
    ]"
  >
    <!-- Header with icon and type label -->
    <div
      class="card-header"
      :style="{ backgroundColor: fileTypeInfo.headerColor }"
    >
      <span class="file-icon">{{ fileTypeInfo.icon }}</span>
      <span class="file-type-label">{{ fileTypeInfo.label }}</span>
    </div>

    <!-- Body with file details -->
    <div class="card-body">
      <div
        class="file-name"
        :title="filename"
      >
        {{ truncatedFilename }}
      </div>
      <div class="file-meta">
        <span class="file-type-name">{{ fileTypeInfo.typeName }}</span>
        <span
          v-if="formattedSize"
          class="file-size"
        >{{ formattedSize }}</span>
      </div>

      <!-- Image Preview (for image types) -->
      <div
        v-if="isImage && previewUrl"
        class="image-preview"
      >
        <img
          :src="previewUrl"
          :alt="filename"
          class="preview-image"
          loading="lazy"
          @click="$emit('preview', attachment)"
          @error="imageLoadError = true"
        >
        <div
          class="preview-overlay"
          @click="$emit('preview', attachment)"
        >
          <span class="preview-icon" />
        </div>
      </div>

      <div class="card-divider" />

      <div class="card-hint">
        點擊下方按鈕下載或開啟檔案
      </div>
    </div>

    <!-- Footer with action button -->
    <div class="card-footer">
      <a
        :href="fileUrl"
        :download="filename"
        class="action-button"
        :style="{ backgroundColor: fileTypeInfo.buttonColor }"
        target="_blank"
        rel="noopener noreferrer"
        @click.stop
      >
        <span class="button-icon" />
        <span class="button-text">打開此文件</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface FileAttachment {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  fileUrl: string
  r2Key?: string
}

interface Props {
  attachment: FileAttachment
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

defineEmits<{
  preview: [attachment: FileAttachment]
}>()

const imageLoadError = ref(false)

// Computed properties
const filename = computed(() => props.attachment.filename || '未命名檔案')
const fileUrl = computed(() => props.attachment.fileUrl || '')
const fileSize = computed(() => props.attachment.fileSize || 0)
const mimeType = computed(() => props.attachment.mimeType || '')

const isImage = computed(() => {
  const type = mimeType.value.toLowerCase()
  return type.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].some(ext =>
      filename.value.toLowerCase().endsWith(`.${ext}`)
    )
})

const previewUrl = computed(() => {
  if (isImage.value && !imageLoadError.value) {
    return fileUrl.value
  }
  return null
})

const truncatedFilename = computed(() => {
  const name = filename.value
  const maxLength = props.compact ? 20 : 30

  if (name.length <= maxLength) {return name}

  const extension = name.split('.').pop() || ''
  const nameWithoutExt = name.substring(0, name.lastIndexOf('.'))
  const availableLength = maxLength - extension.length - 4

  return `${nameWithoutExt.substring(0, availableLength)  }...${  extension ? `.${  extension}` : ''}`
})

const formattedSize = computed(() => {
  const bytes = fileSize.value
  if (!bytes || bytes === 0) {return ''}

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))  } ${  units[i]}`
})

const fileTypeInfo = computed(() => {
  const mime = mimeType.value.toLowerCase()
  const ext = filename.value.split('.').pop()?.toLowerCase() || ''

  // PDF
  if (mime.includes('pdf') || ext === 'pdf') {
    return {
      type: 'pdf',
      icon: '',
      label: 'PDF 文件',
      typeName: 'PDF 文檔',
      headerColor: '#E53935',
      buttonColor: '#E53935'
    }
  }

  // Excel (must check BEFORE Word because xlsx MIME contains "document")
  // xlsx MIME: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  if (mime.includes('excel') || mime.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      type: 'excel',
      icon: '',
      label: 'Excel 文件',
      typeName: 'Excel 表格',
      headerColor: '#4CAF50',
      buttonColor: '#4CAF50'
    }
  }

  // PowerPoint (must check BEFORE Word because pptx MIME contains "document")
  // pptx MIME: application/vnd.openxmlformats-officedocument.presentationml.presentation
  if (mime.includes('powerpoint') || mime.includes('presentation') || ['ppt', 'pptx'].includes(ext)) {
    return {
      type: 'ppt',
      icon: '',
      label: 'PPT 文件',
      typeName: 'PowerPoint 簡報',
      headerColor: '#FF9800',
      buttonColor: '#FF9800'
    }
  }

  // Word (check after Excel and PowerPoint to avoid false matches)
  // docx MIME: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  if (mime.includes('word') || mime.includes('wordprocessing') || ['doc', 'docx'].includes(ext)) {
    return {
      type: 'word',
      icon: '',
      label: 'Word 文件',
      typeName: 'Word 文檔',
      headerColor: '#2196F3',
      buttonColor: '#2196F3'
    }
  }

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return {
      type: 'image',
      icon: '',
      label: '圖片',
      typeName: '圖片檔案',
      headerColor: '#00BCD4',
      buttonColor: '#00BCD4'
    }
  }

  // Video
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return {
      type: 'video',
      icon: '',
      label: '影片',
      typeName: '影片檔案',
      headerColor: '#9C27B0',
      buttonColor: '#9C27B0'
    }
  }

  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
    return {
      type: 'audio',
      icon: '',
      label: '音訊',
      typeName: '音訊檔案',
      headerColor: '#E91E63',
      buttonColor: '#E91E63'
    }
  }

  // Archive
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') ||
      ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      type: 'archive',
      icon: '',
      label: '壓縮檔',
      typeName: '壓縮檔案',
      headerColor: '#795548',
      buttonColor: '#795548'
    }
  }

  // Text files
  if (mime.includes('text') || ['txt', 'md', 'json', 'xml', 'log'].includes(ext)) {
    return {
      type: 'text',
      icon: '',
      label: '文字檔',
      typeName: '文字文件',
      headerColor: '#607D8B',
      buttonColor: '#607D8B'
    }
  }

  // Code files
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'vue', 'jsx', 'tsx'].includes(ext)) {
    return {
      type: 'code',
      icon: '',
      label: '程式碼',
      typeName: '程式檔案',
      headerColor: '#3F51B5',
      buttonColor: '#3F51B5'
    }
  }

  // Default
  return {
    type: 'file',
    icon: '',
    label: '檔案',
    typeName: '檔案',
    headerColor: '#9C27B0',
    buttonColor: '#9C27B0'
  }
})
</script>

<style scoped>
.file-attachment-card {
  width: 100%;
  max-width: 280px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  background: white;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.file-attachment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
}

/* Compact mode */
.card-compact {
  max-width: 240px;
}

.card-compact .card-header {
  padding: 10px 12px;
}

.card-compact .file-icon {
  font-size: 1.25rem;
}

.card-compact .file-type-label {
  font-size: 0.875rem;
}

.card-compact .card-body {
  padding: 10px 12px;
}

.card-compact .file-name {
  font-size: 0.8125rem;
}

/* Header */
.card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  color: white;
}

.file-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.file-type-label {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* Body */
.card-body {
  padding: 14px 16px;
}

.file-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #333;
  word-break: break-word;
  line-height: 1.4;
  margin-bottom: 6px;
}

.file-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.file-type-name {
  font-size: 0.8125rem;
  color: #888;
}

.file-size {
  font-size: 0.8125rem;
  color: #888;
}

/* Image Preview */
.image-preview {
  position: relative;
  margin: 10px 0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.preview-image {
  width: 100%;
  height: auto;
  max-height: 150px;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.image-preview:hover .preview-image {
  transform: scale(1.02);
}

.preview-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-preview:hover .preview-overlay {
  opacity: 1;
}

.preview-icon {
  font-size: 1.5rem;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.card-divider {
  height: 1px;
  background: #eee;
  margin: 10px 0;
}

.card-hint {
  font-size: 0.75rem;
  color: #aaa;
  text-align: center;
}

/* Footer */
.card-footer {
  padding: 10px 14px 14px;
  background: #f8f9fa;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 16px;
  border-radius: 8px;
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
}

.action-button:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.action-button:active {
  transform: translateY(0);
}

.button-icon {
  font-size: 1rem;
}

.button-text {
  letter-spacing: 0.5px;
}

/* File type specific styles */
.file-type-pdf .card-header { background: #E53935; }
.file-type-word .card-header { background: #2196F3; }
.file-type-excel .card-header { background: #4CAF50; }
.file-type-ppt .card-header { background: #FF9800; }
.file-type-image .card-header { background: #00BCD4; }
.file-type-video .card-header { background: #9C27B0; }
.file-type-audio .card-header { background: #E91E63; }
.file-type-archive .card-header { background: #795548; }
.file-type-text .card-header { background: #607D8B; }
.file-type-code .card-header { background: #3F51B5; }

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .file-attachment-card {
    background: #2a2a2a;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .file-name {
    color: #e0e0e0;
  }

  .file-type-name,
  .file-size {
    color: #999;
  }

  .card-divider {
    background: #444;
  }

  .card-hint {
    color: #777;
  }

  .card-footer {
    background: #333;
  }
}

/* Responsive */
@media (max-width: 480px) {
  .file-attachment-card {
    max-width: 100%;
  }

  .card-header {
    padding: 12px;
  }

  .file-icon {
    font-size: 1.25rem;
  }

  .file-type-label {
    font-size: 0.9375rem;
  }

  .card-body {
    padding: 12px;
  }

  .file-name {
    font-size: 0.875rem;
  }

  .action-button {
    padding: 8px 12px;
    font-size: 0.875rem;
  }
}
</style>
