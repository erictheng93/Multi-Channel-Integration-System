<template>
  <div class="file-uploader">
    <div class="uploader-header">
      <h3 class="uploader-title">
        <UploadCloudIcon />
        檔案上傳
      </h3>
      <p class="uploader-subtitle">
        支援圖片、影片、音頻和文件，最大 10MB
      </p>
    </div>

    <!-- 拖拽上傳區域 -->
    <div
      class="upload-zone"
      :class="{
        'dragging': isDragging,
        'has-files': selectedFiles.length > 0,
        'uploading': uploading
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        :accept="acceptedTypes"
        class="file-input"
        @change="handleFileSelect"
      >
      
      <div
        v-if="!selectedFiles.length"
        class="upload-prompt"
      >
        <div class="upload-icon">
          <UploadCloudIcon size="xl" />
        </div>
        <div class="upload-text">
          <p class="primary-text">
            點擊或拖拽檔案到此處
          </p>
          <p class="secondary-text">
            支援 {{ allowedTypesText }}
          </p>
          <p class="size-limit">
            檔案大小限制：10MB
          </p>
        </div>
      </div>

      <div
        v-else
        class="selected-files"
      >
        <div
          v-for="(file, index) in selectedFiles"
          :key="index"
          class="file-item"
          :class="{ 'error': file.error }"
        >
          <div
            class="file-preview"
            style="width: 48px; height: 48px;"
          >
            <img
              v-if="file.preview && isImageFile(file)"
              :src="file.preview"
              :alt="file.name"
              class="image-preview"
              style="width: 100%; height: 100%; object-fit: cover;"
              loading="lazy"
            >
            <div
              v-else
              class="file-icon"
            >
              <component :is="getFileIcon(file)" />
            </div>
          </div>
          
          <div class="file-info">
            <div
              class="file-name"
              :title="file.name"
            >
              {{ file.name }}
            </div>
            <div class="file-meta">
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
              <span class="file-type">{{ file.type || '未知格式' }}</span>
            </div>
            <div
              v-if="file.error"
              class="file-error"
            >
              {{ file.error }}
            </div>
            <div
              v-else-if="file.uploadProgress !== undefined"
              class="upload-progress"
            >
              <div class="progress-bar">
                <div 
                  class="progress-fill"
                  :style="{ width: `${file.uploadProgress}%` }"
                />
              </div>
              <span class="progress-text">{{ file.uploadProgress }}%</span>
            </div>
          </div>

          <div class="file-actions">
            <button
              v-if="!file.uploading && !file.uploaded"
              class="btn btn-sm btn-ghost"
              :disabled="uploading"
              @click.stop="removeFile(index)"
            >
              <XIcon />
            </button>
            <div
              v-else-if="file.uploaded"
              class="upload-success"
            >
              <CheckIcon />
            </div>
            <div
              v-else-if="file.uploading"
              class="upload-spinner"
            >
              <HamsterLoader message="上傳中..." />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上傳選項 -->
    <div
      v-if="selectedFiles.length > 0"
      class="upload-options"
    >
      <div class="options-row">
        <label class="checkbox-label">
          <input
            v-model="uploadOptions.generateThumbnail"
            type="checkbox"
            class="checkbox"
          >
          <span>生成縮圖（圖片檔案）</span>
        </label>
        <label class="checkbox-label">
          <input
            v-model="uploadOptions.compress"
            type="checkbox"
            class="checkbox"
          >
          <span>壓縮檔案</span>
        </label>
      </div>
    </div>

    <!-- 上傳按鈕 -->
    <div
      v-if="selectedFiles.length > 0"
      class="upload-actions"
    >
      <button
        class="btn btn-primary"
        :disabled="uploading || !hasValidFiles"
        @click="startUpload"
      >
        <HamsterLoader
          v-if="uploading"
          message="檔案上傳中..."
        />
        <UploadIcon v-else />
        {{ uploading ? '上傳中...' : `上傳 ${validFilesCount} 個檔案` }}
      </button>
      <button
        class="btn btn-ghost"
        :disabled="uploading"
        @click="clearFiles"
      >
        清除全部
      </button>
    </div>

    <!-- 上傳結果 -->
    <div
      v-if="uploadResults.length > 0"
      class="upload-results"
    >
      <h4 class="results-title">
        上傳結果
      </h4>
      <div class="results-list">
        <div
          v-for="result in uploadResults"
          :key="result.fileName"
          class="result-item"
          :class="{ 'success': result.success, 'error': !result.success }"
        >
          <div class="result-icon">
            <CheckIcon v-if="result.success" />
            <XCircleIcon v-else />
          </div>
          <div class="result-content">
            <div class="result-name">
              {{ result.fileName }}
            </div>
            <div class="result-message">
              <span v-if="result.success">
                上傳成功 - 
                <a
                  :href="result.url"
                  target="_blank"
                  class="file-link"
                >
                  查看檔案
                </a>
              </span>
              <span
                v-else
                class="error-text"
              >
                {{ result.error }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  UploadCloudIcon,
  UploadIcon,
  XIcon,
  CheckIcon,
  XCircleIcon,
  ImageIcon,
  FileIcon,
  VideoIcon,
  MusicIcon
} from '@/components/icons'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import { apiClient } from '@/api/base'

interface FileWithPreview extends globalThis.File {
  preview?: string
  error?: string
  uploading?: boolean
  uploaded?: boolean
  uploadProgress?: number
}

interface UploadOptions {
  generateThumbnail: boolean
  compress: boolean
  maxSize: number
}

interface UploadResult {
  fileName: string
  success: boolean
  url?: string
  fileId?: string
  error?: string
}

const emit = defineEmits<{
  'upload-complete': [results: UploadResult[]]
  'upload-progress': [progress: number]
}>()

const fileInput = ref<HTMLInputElement>()
const selectedFiles = ref<FileWithPreview[]>([])
const isDragging = ref(false)
const uploading = ref(false)
const uploadResults = ref<UploadResult[]>([])

const uploadOptions = ref<UploadOptions>({
  generateThumbnail: true,
  compress: false,
  maxSize: 10 * 1024 * 1024 // 10MB
})

// 允許的檔案類型
const allowedTypes = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]

const acceptedTypes = allowedTypes.join(',')

const allowedTypesText = computed(() => {
  return '圖片、影片、音頻、PDF、Word文件'
})

const validFilesCount = computed(() => {
  return selectedFiles.value.filter(file => !file.error).length
})

const hasValidFiles = computed(() => {
  return validFilesCount.value > 0
})

const triggerFileInput = () => {
  if (!uploading.value) {
    fileInput.value?.click()
  }
}

const handleDragEnter = (e: globalThis.DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragOver = (e: globalThis.DragEvent) => {
  e.preventDefault()
}

const handleDragLeave = (e: globalThis.DragEvent) => {
  e.preventDefault()
  if (!e.relatedTarget || !(e.currentTarget as globalThis.Element).contains(e.relatedTarget as globalThis.Node)) {
    isDragging.value = false
  }
}

const handleDrop = (e: globalThis.DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  
  const files = Array.from(e.dataTransfer?.files || [])
  processFiles(files)
}

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  processFiles(files)
}

const processFiles = async (files: globalThis.File[]) => {
  if (uploading.value) {return}
  
  const processedFiles: FileWithPreview[] = []
  
  for (const file of files) {
    const processedFile = file as FileWithPreview
    
    // 檔案驗證
    const validationError = validateFile(file)
    if (validationError) {
      processedFile.error = validationError
    }
    
    // 生成預覽（圖片檔案）
    if (isImageFile(file) && !validationError) {
      try {
        processedFile.preview = await generatePreview(file)
      } catch (error) {
        console.warn('Failed to generate preview:', error)
      }
    }
    
    processedFiles.push(processedFile)
  }
  
  selectedFiles.value = [...selectedFiles.value, ...processedFiles]
}

const validateFile = (file: globalThis.File): string | null => {
  // 檢查檔案類型
  if (!allowedTypes.includes(file.type)) {
    return '不支援的檔案格式'
  }
  
  // 檢查檔案大小
  if (file.size > uploadOptions.value.maxSize) {
    return `檔案過大，最大限制 ${formatFileSize(uploadOptions.value.maxSize)}`
  }
  
  // 檢查檔案名
  if (file.name.length > 255) {
    return '檔案名過長'
  }
  
  return null
}

const generatePreview = (file: globalThis.File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new globalThis.FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const isImageFile = (file: globalThis.File): boolean => {
  return file.type.startsWith('image/')
}

const getFileIcon = (file: globalThis.File) => {
  if (file.type.startsWith('image/')) {return ImageIcon}
  if (file.type.startsWith('video/')) {return VideoIcon}
  if (file.type.startsWith('audio/')) {return MusicIcon}
  return FileIcon
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {return '0 B'}
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100  } ${  sizes[i]}`
}

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1)
}

const clearFiles = () => {
  selectedFiles.value = []
  uploadResults.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const startUpload = async () => {
  if (uploading.value || !hasValidFiles.value) {return}
  
  uploading.value = true
  uploadResults.value = []
  
  const validFiles = selectedFiles.value.filter(file => !file.error)
  let completedCount = 0
  
  try {
    // 並行上傳檔案
    const uploadPromises = validFiles.map(async (file) => {
      file.uploading = true
      file.uploadProgress = 0
      
      try {
        const result = await uploadSingleFile(file, (progress) => {
          file.uploadProgress = progress
          // 計算總體進度
          const totalProgress = Math.round(
            (completedCount + progress / 100) / validFiles.length * 100
          )
          emit('upload-progress', totalProgress)
        })
        
        file.uploaded = true
        file.uploading = false
        completedCount++
        
        uploadResults.value.push({
          fileName: file.name,
          success: true,
          url: result.url,
          fileId: result.fileId
        })
        
        return result
      } catch (error) {
        file.uploading = false
        file.error = error instanceof Error ? error.message : '上傳失敗'
        completedCount++
        
        uploadResults.value.push({
          fileName: file.name,
          success: false,
          error: file.error
        })
        
        throw error
      }
    })
    
    await Promise.allSettled(uploadPromises)
    
    emit('upload-complete', uploadResults.value)
    emit('upload-progress', 100)
    
  } catch (error) {
    console.error('Upload error:', error)
  } finally {
    uploading.value = false
  }
}

const uploadSingleFile = async (
  file: globalThis.File,
  onProgress: (_progress: number) => void
): Promise<{ url: string; fileId: string }> => {
  const formData = new globalThis.FormData()
  formData.append('file', file)
  formData.append('generateThumbnail', String(uploadOptions.value.generateThumbnail))
  formData.append('compress', String(uploadOptions.value.compress))
  
  // 模擬進度更新（實際應該使用 XMLHttpRequest 來追蹤上傳進度）
  let uploadProgress = 0
  const progressInterval = setInterval(() => {
    if (uploadProgress < 90) {
      uploadProgress += Math.random() * 10
      onProgress(Math.min(uploadProgress, 90))
    }
  }, 200)
  
  try {
    const response = await apiClient.uploadFile('/files/upload', formData)
    
    clearInterval(progressInterval)
    onProgress(100)
    
    if (!response.success) {
      throw new Error(response.error || '上傳失敗')
    }
    
    interface UploadResponseData {
      url?: string
      fileId?: string
    }
    
    const data = response.data as UploadResponseData
    return {
      url: data?.url || '',
      fileId: data?.fileId || ''
    }
  } catch (error) {
    clearInterval(progressInterval)
    throw error
  }
}
</script>

<style scoped>
.file-uploader {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
}

.uploader-header {
  margin-bottom: var(--space-8);
  text-align: center;
}

.uploader-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.uploader-subtitle {
  color: var(--gray-600);
  margin: 0;
  font-size: 0.875rem;
}

.upload-zone {
  border: 2px dashed var(--gray-300);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-zone:hover {
  border-color: var(--primary-400);
  background: var(--primary-25);
}

.upload-zone.dragging {
  border-color: var(--primary-500);
  background: var(--primary-50);
  transform: scale(1.02);
}

.upload-zone.has-files {
  padding: var(--space-6);
  align-items: stretch;
  min-height: auto;
}

.upload-zone.uploading {
  pointer-events: none;
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.upload-icon {
  color: var(--gray-400);
}

.upload-text {
  text-align: center;
}

.primary-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.secondary-text {
  color: var(--gray-600);
  margin: 0 0 var(--space-1) 0;
}

.size-limit {
  color: var(--gray-500);
  font-size: 0.8125rem;
  margin: 0;
}

.selected-files {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: white;
  transition: all var(--transition-fast);
}

.file-item:hover {
  box-shadow: 0 2px 8px 0 rgb(0 0 0 / 0.1);
}

.file-item.error {
  border-color: var(--red-300);
  background: var(--red-25);
}

.file-preview {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-100);
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-icon {
  color: var(--gray-500);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 600;
  color: var(--gray-900);
  truncate;
  margin-bottom: var(--space-1);
}

.file-meta {
  display: flex;
  gap: var(--space-3);
  font-size: 0.8125rem;
  color: var(--gray-600);
}

.file-error {
  color: var(--red-600);
  font-size: 0.8125rem;
  margin-top: var(--space-1);
}

.upload-progress {
  margin-top: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-500);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary-600);
  min-width: 40px;
}

.file-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.upload-success {
  color: var(--green-600);
}

.upload-spinner {
  color: var(--primary-600);
}

.upload-options {
  margin: var(--space-6) 0;
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: var(--gray-25);
}

.options-row {
  display: flex;
  gap: var(--space-6);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.875rem;
  color: var(--gray-700);
  cursor: pointer;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary-500);
}

.upload-actions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-6);
  padding-top: var(--space-6);
  border-top: 1px solid var(--gray-100);
}

.upload-results {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--gray-100);
}

.results-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-4) 0;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.result-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  align-items: flex-start;
}

.result-item.success {
  background: var(--green-25);
  border: 1px solid var(--green-200);
}

.result-item.error {
  background: var(--red-25);
  border: 1px solid var(--red-200);
}

.result-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.result-item.success .result-icon {
  color: var(--green-600);
}

.result-item.error .result-icon {
  color: var(--red-600);
}

.result-content {
  flex: 1;
}

.result-name {
  font-weight: 600;
  margin-bottom: var(--space-1);
}

.result-item.success .result-name {
  color: var(--green-900);
}

.result-item.error .result-name {
  color: var(--red-900);
}

.result-message {
  font-size: 0.875rem;
}

.result-item.success .result-message {
  color: var(--green-700);
}

.error-text {
  color: var(--red-700);
}

.file-link {
  color: var(--green-600);
  text-decoration: underline;
  font-weight: 500;
}

.file-link:hover {
  color: var(--green-700);
}

@media (max-width: 768px) {
  .file-uploader {
    padding: var(--space-6);
  }
  
  .upload-zone {
    padding: var(--space-6);
    min-height: 150px;
  }
  
  .file-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .file-actions {
    align-self: flex-end;
  }
  
  .options-row {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .upload-actions {
    flex-direction: column;
  }
}
</style>