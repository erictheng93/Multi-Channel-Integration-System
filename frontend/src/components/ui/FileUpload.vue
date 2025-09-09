<template>
  <div class="file-upload">
    <!-- File Input (Hidden) -->
    <input
      :id="inputId"
      ref="fileInput"
      type="file"
      :multiple="multiple"
      :accept="acceptedTypes"
      class="file-input"
      @change="handleFileSelect"
    >

    <!-- Upload Button -->
    <button
      v-if="!isDragActive && !showDropZone"
      type="button"
      :disabled="disabled || uploading"
      class="upload-button"
      :class="{ 'uploading': uploading }"
      @click="openFileDialog"
    >
      <UploadIcon v-if="!uploading" />
      <HamsterLoader
        v-else
        message="上傳中..."
      />
      <span>{{ buttonText }}</span>
    </button>

    <!-- Drag & Drop Zone -->
    <div
      v-if="showDropZone"
      :class="[
        'drop-zone',
        { 'drag-active': isDragActive },
        { 'has-error': hasError }
      ]"
      @drop.prevent="handleFileDrop"
      @dragover.prevent="isDragActive = true"
      @dragenter.prevent="isDragActive = true"
      @dragleave.prevent="isDragActive = false"
      @click="openFileDialog"
    >
      <div class="drop-zone-content">
        <UploadCloudIcon class="drop-icon" />
        <h3 class="drop-title">
          拖放檔案至此處
        </h3>
        <p class="drop-subtitle">
          或點擊選擇檔案
        </p>
        <div class="file-constraints">
          <span>最大檔案大小：{{ maxSizeText }}</span>
          <span v-if="acceptedTypesText">支援格式：{{ acceptedTypesText }}</span>
        </div>
      </div>
    </div>

    <!-- File Preview List -->
    <div
      v-if="selectedFiles.length > 0"
      class="file-list"
    >
      <h4 class="file-list-title">
        已選擇的檔案 ({{ selectedFiles.length }})
      </h4>
      <div class="file-items">
        <div
          v-for="(file, index) in selectedFiles"
          :key="file.id || `${file.name}-${index}`"
          class="file-item"
          :class="{ 
            'error': file.error,
            'uploading': file.uploading,
            'uploaded': file.uploaded
          }"
        >
          <div class="file-icon">
            <FileIcon />
          </div>
          <div class="file-info">
            <div
              class="file-name"
              :title="file.name"
            >
              {{ file.name }}
            </div>
            <div class="file-meta">
              <span class="file-size">{{ formatFileSize(file.size || 0) }}</span>
              <span
                v-if="file.error"
                class="file-error"
              >{{ file.error }}</span>
              <span
                v-else-if="file.progress !== undefined"
                class="file-progress"
              >
                {{ file.progress }}%
              </span>
              <span
                v-if="file.uploaded"
                class="file-success"
              >✓ 已上傳</span>
            </div>
          </div>
          <div class="file-actions">
            <button
              v-if="file.error && !file.uploading"
              class="retry-btn"
              type="button"
              title="重試上傳"
              @click="retryUpload(file)"
            >
              <RefreshIcon />
            </button>
            <button
              v-if="!file.uploading && !file.uploaded"
              class="remove-btn"
              type="button"
              title="移除檔案"
              @click="removeFile(index)"
            >
              <XIcon />
            </button>
            <div
              v-else-if="file.uploading"
              class="upload-progress"
            >
              <HamsterLoader message="上傳中..." />
            </div>
            <div
              v-else-if="file.uploaded"
              class="upload-success"
            >
              <CheckIcon />
            </div>
          </div>

          <!-- Enhanced Progress Bar -->
          <div
            v-if="file.progress !== undefined && file.uploading"
            class="progress-bar"
          >
            <div
              class="progress-fill"
              :style="{ width: `${file.progress}%` }"
              :class="{
                'success': file.uploaded,
                'error': file.error && !file.uploading
              }"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Error Messages -->
    <div
      v-if="errorMessages.length > 0"
      class="error-messages"
    >
      <div
        v-for="(error, index) in errorMessages"
        :key="`error-${index}`"
        class="error-message"
      >
        <AlertCircleIcon />
        <span>{{ error }}</span>
        <button
          class="error-dismiss"
          @click="removeError(index)"
        >
          <XIcon />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import HamsterLoader from './HamsterLoader.vue'
import {
  UploadIcon,
  UploadCloudIcon,
  FileIcon,
  XIcon,
  CheckIcon,
  AlertCircleIcon,
  RefreshIcon
} from '@/components/icons'
import type { FileUploadItem } from '@/types/file-upload'

interface Props {
  modelValue?: FileUploadItem[];
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  acceptedTypes?: string;
  disabled?: boolean;
  showDropZone?: boolean;
  buttonText?: string;
  uploadFunction?: (_file: globalThis.File) => Promise<{ url: string; filename: string }>;
}

/* eslint-disable no-unused-vars */
interface Emits {
  (e: 'update:modelValue', files: FileUploadItem[]): void;
  (e: 'upload-complete', file: FileUploadItem): void;
  (e: 'upload-error', file: FileUploadItem, error: string): void;
  (e: 'file-select', files: globalThis.File[]): void;
}
/* eslint-enable no-unused-vars */

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  multiple: false,
  maxSize: 10 * 1024 * 1024, // 10MB default
  maxFiles: 5,
  acceptedTypes: '',
  disabled: false,
  showDropZone: true,
  buttonText: '選擇檔案',
  uploadFunction: undefined
})

const emit = defineEmits<Emits>()

// State
const fileInput = ref<HTMLInputElement>()
const selectedFiles = ref<FileUploadItem[]>([...props.modelValue])
const isDragActive = ref(false)
const uploading = ref(false)
const errorMessages = ref<string[]>([])

// Generate unique input ID
const inputId = `file-input-${Math.random().toString(36).substring(2, 11)}`

// Computed
const hasError = computed(() => errorMessages.value.length > 0)

const maxSizeText = computed(() => {
  const mb = props.maxSize / (1024 * 1024)
  return mb >= 1 ? `${mb}MB` : `${Math.round(props.maxSize / 1024)}KB`
})

const acceptedTypesText = computed(() => {
  if (!props.acceptedTypes) {return ''}
  return props.acceptedTypes
    .split(',')
    .map(type => type.trim().replace('.', ''))
    .join(', ')
    .toUpperCase()
})

// Methods
const openFileDialog = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

const clearErrors = () => {
  errorMessages.value = []
}

const addError = (message: string) => {
  if (!errorMessages.value.includes(message)) {
    errorMessages.value.push(message)
    // Auto-remove after 5 seconds
    setTimeout(() => {
      const index = errorMessages.value.indexOf(message)
      if (index > -1) {
        errorMessages.value.splice(index, 1)
      }
    }, 5000)
  }
}

const removeError = (index: number) => {
  errorMessages.value.splice(index, 1)
}

const validateFile = (file: globalThis.File): string | null => {
  // Check file size
  if (file.size > props.maxSize) {
    return `檔案過大，最大允許 ${maxSizeText.value}`
  }

  // Check file type if specified
  if (props.acceptedTypes) {
    const allowedTypes = props.acceptedTypes.split(',').map(t => t.trim())
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const fileType = fileExtension ? `.${fileExtension}` : ''
    const mimeType = file.type.toLowerCase()
    
    const isAllowed = allowedTypes.some(type => {
      const normalizedType = type.toLowerCase().trim()
      return normalizedType === fileType || 
             normalizedType === mimeType || 
             (normalizedType.includes('*') && file.type.startsWith(normalizedType.replace('*', '')))
    })

    if (!isAllowed) {
      return `不支援的檔案格式，只允許：${acceptedTypesText.value}`
    }
  }

  return null
}

const processFiles = (files: globalThis.File[]) => {
  clearErrors()

  if (!props.multiple) {
    files = files.slice(0, 1)
    selectedFiles.value = []
  }

  // Check max files limit
  if (selectedFiles.value.length + files.length > props.maxFiles) {
    addError(`最多只能上傳 ${props.maxFiles} 個檔案`)
    return
  }

  const newFiles: FileUploadItem[] = []

  for (const file of files) {
    const error = validateFile(file)
    
    const fileItem: FileUploadItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      progress: 0,
      uploading: false,
      uploaded: false,
      error: error || undefined,
      retryCount: 0
    }

    if (error) {
      addError(error)
    }

    newFiles.push(fileItem)
  }

  selectedFiles.value = [...selectedFiles.value, ...newFiles]
  emit('file-select', files)
  updateModelValue()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  
  if (files.length > 0) {
    processFiles(files)
  }

  // Reset input value to allow selecting same file again
  target.value = ''
}

const handleFileDrop = (event: globalThis.DragEvent) => {
  isDragActive.value = false
  
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length > 0) {
    processFiles(files)
  }
}

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1)
  updateModelValue()
}

const updateModelValue = () => {
  emit('update:modelValue', [...selectedFiles.value])
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {return '0 Bytes'}

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`
}

// Enhanced upload functionality with retry mechanism
const uploadFile = async (fileItem: FileUploadItem, retryCount = 0) => {
  if (!fileItem.file || !props.uploadFunction) {return}

  fileItem.uploading = true
  fileItem.progress = 0
  fileItem.error = undefined
  fileItem.retryCount = retryCount

  let progressInterval: NodeJS.Timeout | null = null

  try {
    // Enhanced progress simulation
    progressInterval = setInterval(() => {
      if (fileItem.progress !== undefined && fileItem.progress < 90) {
        const increment = Math.random() * 10 + 2 // Variable speed (2-12%)
        fileItem.progress = Math.min(fileItem.progress + increment, 90)
      }
    }, 150 + Math.random() * 100) // Variable interval

    const result = await props.uploadFunction(fileItem.file)
    
    if (progressInterval) {
      clearInterval(progressInterval)
    }
    
    fileItem.progress = 100
    fileItem.uploading = false
    fileItem.uploaded = true
    fileItem.url = result.url

    emit('upload-complete', fileItem)
  } catch (error: unknown) {
    if (progressInterval) {
      clearInterval(progressInterval)
    }
    
    fileItem.uploading = false
    fileItem.progress = undefined
    
    // Enhanced retry logic
    const maxRetries = 3
    if (retryCount < maxRetries && isRetryableError(error)) {
      fileItem.error = `上傳失敗，正在重試... (${retryCount + 1}/${maxRetries})`
      
      const delay = 1000 * Math.pow(2, retryCount) // Exponential backoff
      setTimeout(() => {
        uploadFile(fileItem, retryCount + 1)
      }, delay)
    } else {
      fileItem.error = (error as Error)?.message || '上傳失敗'
      if (fileItem.error) {
        emit('upload-error', fileItem, fileItem.error)
      }
    }
  }

  updateModelValue()
}

const isRetryableError = (error: unknown): boolean => {
  // Determine if error is retryable (network issues, temporary server errors)
  const retryableMessages = ['network', 'timeout', '503', '502', '500', 'fetch']
  const errorMessage = (error as Error)?.message?.toLowerCase() || ''
  return retryableMessages.some(msg => errorMessage.includes(msg))
}

const retryUpload = (fileItem: FileUploadItem) => {
  uploadFile(fileItem, 0)
}

const uploadAll = async () => {
  if (!props.uploadFunction) {return}

  uploading.value = true
  
  const filesToUpload = selectedFiles.value.filter(f => 
    !f.uploaded && !f.uploading && !f.error && f.file
  )

  for (const fileItem of filesToUpload) {
    await uploadFile(fileItem)
  }

  uploading.value = false
}

// Watch for changes from parent
watch(() => props.modelValue, (newValue) => {
  selectedFiles.value = [...newValue]
}, { deep: true })

// Cleanup on unmount
onUnmounted(() => {
  // Clear any pending timeouts/intervals
  selectedFiles.value.forEach(file => {
    if (file.uploading) {
      file.uploading = false
    }
  })
})

// Expose methods
defineExpose({
  openFileDialog,
  clearErrors,
  uploadAll,
  uploadFile,
  retryUpload
})
</script>

<style scoped>
.file-upload {
  width: 100%;
}

.file-input {
  display: none;
}

.upload-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-300);
  background-color: white;
  color: var(--gray-700);
  border-radius: var(--radius-lg);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.upload-button:hover:not(:disabled) {
  background-color: var(--gray-50);
  border-color: var(--primary-300);
  color: var(--primary-700);
}

.upload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-button.uploading {
  background-color: var(--primary-50);
  border-color: var(--primary-300);
  color: var(--primary-700);
}

.drop-zone {
  border: 2px dashed var(--gray-300);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  text-align: center;
  background-color: var(--gray-50);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.drop-zone.drag-active {
  border-color: var(--primary-500);
  background-color: var(--primary-50);
  transform: scale(1.02);
}

.drop-zone.has-error {
  border-color: var(--red-300);
  background-color: var(--red-50);
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.drop-icon {
  width: 48px;
  height: 48px;
  color: var(--gray-400);
  transition: all var(--transition-fast);
}

.drop-zone.drag-active .drop-icon {
  color: var(--primary-500);
  transform: scale(1.1);
}

.drop-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.drop-subtitle {
  color: var(--gray-600);
  margin: 0;
}

.file-constraints {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.75rem;
  color: var(--gray-500);
}

/* File List */
.file-list {
  margin-top: var(--space-6);
}

.file-list-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-4) 0;
}

.file-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.file-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background-color: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.file-item:hover {
  border-color: var(--gray-300);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.file-item.error {
  border-color: var(--red-300);
  background-color: var(--red-50);
}

.file-item.uploading {
  border-color: var(--primary-300);
  background-color: var(--primary-50);
}

.file-item.uploaded {
  border-color: var(--green-300);
  background-color: var(--green-50);
}

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--gray-100);
  border-radius: var(--radius-md);
  color: var(--gray-500);
  flex-shrink: 0;
}

.file-item.uploading .file-icon {
  background-color: var(--primary-100);
  color: var(--primary-600);
}

.file-item.uploaded .file-icon {
  background-color: var(--green-100);
  color: var(--green-600);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: var(--space-1);
}

.file-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
}

.file-size {
  color: var(--gray-500);
}

.file-error {
  color: var(--red-600);
  font-weight: 500;
}

.file-progress {
  color: var(--primary-600);
  font-weight: 500;
}

.file-success {
  color: var(--green-600);
  font-weight: 500;
}

.file-actions {
  flex-shrink: 0;
  display: flex;
  gap: var(--space-1);
}

.remove-btn,
.retry-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--gray-400);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.remove-btn:hover {
  background-color: var(--red-100);
  color: var(--red-600);
}

.retry-btn:hover {
  background-color: var(--primary-100);
  color: var(--primary-600);
}

.upload-progress,
.upload-success {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-success {
  color: var(--green-600);
}

/* Enhanced Progress Bar */
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: var(--gray-200);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-400), var(--primary-600));
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  transition: width var(--transition-normal);
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmer 1.5s infinite;
}

.progress-fill.success {
  background: linear-gradient(90deg, var(--green-400), var(--green-600));
}

.progress-fill.error {
  background: linear-gradient(90deg, var(--red-400), var(--red-600));
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* Error Messages */
.error-messages {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background-color: var(--red-50);
  border: 1px solid var(--red-200);
  border-radius: var(--radius-md);
  color: var(--red-700);
  font-size: 0.875rem;
  animation: slideIn 0.3s ease-out;
}

.error-message svg {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.error-dismiss {
  margin-left: auto;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: var(--red-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.error-dismiss:hover {
  background-color: var(--red-100);
  color: var(--red-600);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .drop-zone {
    padding: var(--space-6);
  }
  
  .file-item {
    padding: var(--space-3);
  }
  
  .file-constraints {
    font-size: 0.625rem;
  }
  
  .file-actions {
    flex-direction: column;
  }
}
</style>