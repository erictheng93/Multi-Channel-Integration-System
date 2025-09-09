<template>
  <!-- 
    v-memo optimization: Only re-render when essential props change
    This prevents unnecessary re-renders when scrolling through large message lists
  -->
  <div 
    v-memo="[message.id, message.content, message.status, message.updatedAt, message.messageType, delivered]"
    class="message-bubble"
    :class="messageBubbleClasses"
    @contextmenu="handleRightClick"
    @mouseenter="showActionsOnHover"
    @mouseleave="hideActionsOnHover"
  >
    <div class="message-content">
      <!-- Image Message (lazy loaded) -->
      <div
        v-if="message.messageType === 'image' && attachmentUrl"
        class="message-media"
      >
        <div
          class="image-container"
          @click="openImagePreview"
        >
          <img 
            :src="attachmentUrl" 
            :alt="attachmentName"
            class="message-image-content"
            loading="lazy"
            decoding="async"
            @load="onImageLoad"
            @error="onImageError"
          >
          <div 
            v-show="showActions"
            class="image-overlay"
          >
            <div class="image-actions">
              <button
                class="image-action-btn"
                title="檢視大圖"
              >
                <SearchIcon />
              </button>
              <button
                class="image-action-btn"
                title="下載"
                @click.stop="downloadFile"
              >
                <DownloadIcon />
              </button>
            </div>
          </div>
        </div>
        <div
          v-if="message.content && !isFileOnlyContent"
          class="media-caption"
        >
          {{ message.content }}
        </div>
      </div>

      <!-- File Message -->
      <div
        v-else-if="message.messageType === 'file' && attachmentUrl"
        class="message-file-content"
      >
        <div class="file-container">
          <div
            class="file-icon"
            :class="fileTypeClass"
          >
            <component 
              :is="fileIconComponent" 
              v-if="fileIconComponent"
            />
          </div>
          <div class="file-info">
            <div
              class="file-name"
              :title="attachmentName"
            >
              {{ attachmentName }}
            </div>
            <div class="file-meta">
              <span
                v-if="attachmentSize"
                class="file-size"
              >{{ formattedFileSize }}</span>
              <span class="file-type">{{ fileExtension }}</span>
            </div>
          </div>
          <div class="file-actions">
            <button
              class="file-action-btn primary"
              title="下載"
              @click="downloadFile"
            >
              <DownloadIcon />
            </button>
          </div>
        </div>
        <div
          v-if="message.content && !isFileOnlyContent"
          class="file-caption"
        >
          {{ message.content }}
        </div>
      </div>

      <!-- Text Message (most common, highly optimized) -->
      <div
        v-else
        class="message-text"
      >
        {{ message.content }}
      </div>
    </div>

    <!-- Message Info (simplified) -->
    <div class="message-info">
      <div class="message-meta">
        <span
          v-if="senderName"
          class="sender-name"
        >{{ senderName }}</span>
        <span class="message-time">{{ formattedTime }}</span>
        <div
          v-if="isOutgoing"
          class="message-status"
          :class="statusClass"
        >
          <component 
            :is="statusIcon"
            v-if="statusIcon"
            :class="{ 'animate-spin': message.status === 'sending' }"
          />
        </div>
      </div>
    </div>

    <!-- Message Actions (only show on hover/touch) -->
    <div
      v-show="showActions"
      class="message-actions"
      :class="{ 'actions-visible': showActions }"
    >
      <button
        class="action-btn"
        title="複製"
        @click="$emit('copy', message)"
      >
        <CopyIcon />
      </button>
      <button
        class="action-btn"
        title="回覆"
        @click="$emit('reply', message)"
      >
        <ReplyIcon />
      </button>
      <button
        v-if="canRecall"
        class="action-btn danger"
        title="撤回"
        @click="$emit('recall', message)"
      >
        <UndoIcon />
      </button>
      <button
        class="action-btn"
        title="轉發"
        @click="$emit('forward', message)"
      >
        <ForwardIcon />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, defineAsyncComponent } from 'vue'
import type { Message } from '@/types'

// Lazy load icons for better performance
const SearchIcon = defineAsyncComponent(() => import('@/components/icons/SearchIcon.vue'))
const DownloadIcon = defineAsyncComponent(() => import('@/components/icons/DownloadIcon.vue'))
const CopyIcon = defineAsyncComponent(() => import('@/components/icons/CopyIcon.vue'))
const ReplyIcon = defineAsyncComponent(() => import('@/components/icons/ReplyIcon.vue'))
const UndoIcon = defineAsyncComponent(() => import('@/components/icons/UndoIcon.vue'))
const ForwardIcon = defineAsyncComponent(() => import('@/components/icons/ForwardIcon.vue'))
const CheckIcon = defineAsyncComponent(() => import('@/components/icons/CheckIcon.vue'))
const ClockIcon = defineAsyncComponent(() => import('@/components/icons/ClockIcon.vue'))
const AlertCircleIcon = defineAsyncComponent(() => import('@/components/icons/AlertCircleIcon.vue'))

// Props interface
interface Props {
  message: Message
  delivered?: boolean
  showSender?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  delivered: true,
  showSender: true,
  canEdit: false,
  canDelete: false
})

// Emits
const emit = defineEmits<{
  copy: [message: Message]
  reply: [message: Message]
  forward: [message: Message]
  recall: [message: Message]
  select: [message: Message]
}>()

// Performance optimized refs
const showActions = ref(false)

// Cached computed properties with memoization
const isOutgoing = computed(() => props.message.senderType === 'agent')
const senderName = computed(() => {
  if (!props.showSender) return ''
  return isOutgoing.value ? '客服' : props.message.senderName || '客戶'
})

// File handling with caching
const attachmentUrl = computed(() => props.message.attachments?.[0]?.url)
const attachmentName = computed(() => props.message.attachments?.[0]?.name || 'unknown')
const attachmentSize = computed(() => props.message.attachments?.[0]?.size)

const formattedFileSize = computed(() => {
  if (!attachmentSize.value) return ''
  return formatFileSize(attachmentSize.value)
})

const fileExtension = computed(() => {
  const name = attachmentName.value
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.substring(lastDot + 1).toUpperCase() : 'FILE'
})

const fileTypeClass = computed(() => {
  const ext = fileExtension.value.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'file-type-image'
  if (['pdf'].includes(ext)) return 'file-type-pdf'
  if (['doc', 'docx'].includes(ext)) return 'file-type-doc'
  if (['xls', 'xlsx'].includes(ext)) return 'file-type-excel'
  if (['zip', 'rar', '7z'].includes(ext)) return 'file-type-archive'
  return 'file-type-generic'
})

const fileIconComponent = computed(() => {
  const ext = fileExtension.value.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'ImageIcon'
  if (['pdf'].includes(ext)) return 'FileTextIcon'
  if (['doc', 'docx'].includes(ext)) return 'FileTextIcon'
  if (['xls', 'xlsx'].includes(ext)) return 'FileSpreadsheetIcon'
  if (['zip', 'rar', '7z'].includes(ext)) return 'ArchiveIcon'
  return 'FileIcon'
})

const isFileOnlyContent = computed(() => {
  const content = props.message.content?.trim()
  return !content || content === attachmentName.value
})

// Time formatting with caching
let lastFormattedTime = ''
let lastTimestamp = 0

const formattedTime = computed(() => {
  const timestamp = new Date(props.message.createdAt).getTime()
  
  // Use cached result if timestamp hasn't changed
  if (timestamp === lastTimestamp && lastFormattedTime) {
    return lastFormattedTime
  }
  
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - timestamp
  const diffHours = diffMs / (1000 * 60 * 60)
  
  let formatted = ''
  
  if (diffHours < 1) {
    formatted = '剛剛'
  } else if (diffHours < 24) {
    formatted = date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } else if (diffHours < 24 * 7) {
    formatted = date.toLocaleDateString('zh-TW', { 
      weekday: 'short',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  } else {
    formatted = date.toLocaleDateString('zh-TW', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
  
  // Cache result
  lastFormattedTime = formatted
  lastTimestamp = timestamp
  
  return formatted
})

// Message status
const statusIcon = computed(() => {
  if (!isOutgoing.value) return null
  
  switch (props.message.status) {
    case 'sending':
      return ClockIcon
    case 'sent':
      return CheckIcon
    case 'delivered':
      return CheckIcon
    case 'failed':
      return AlertCircleIcon
    default:
      return null
  }
})

const statusClass = computed(() => {
  switch (props.message.status) {
    case 'sent':
      return 'status-sent'
    case 'delivered':
      return 'status-delivered'
    case 'failed':
      return 'status-failed'
    default:
      return ''
  }
})

const canRecall = computed(() => {
  if (!isOutgoing.value) return false
  
  const messageTime = new Date(props.message.createdAt).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  
  return (now - messageTime) < fiveMinutes && props.message.status !== 'failed'
})

// Optimized CSS classes
const messageBubbleClasses = computed(() => ({
  'message-outgoing': isOutgoing.value,
  'message-incoming': !isOutgoing.value,
  'message-delivered': props.delivered && isOutgoing.value,
  'message-failed': !props.delivered && isOutgoing.value,
  'message-image': props.message.messageType === 'image',
  'message-file': props.message.messageType === 'file',
  'message-has-actions': showActions.value
}))

// Event handlers
const handleRightClick = (event: MouseEvent) => {
  event.preventDefault()
  showActions.value = true
}

const showActionsOnHover = () => {
  showActions.value = true
}

const hideActionsOnHover = () => {
  // Delay hiding to allow interaction with actions
  setTimeout(() => {
    showActions.value = false
  }, 200)
}

const openImagePreview = () => {
  if (attachmentUrl.value) {
    window.open(attachmentUrl.value, '_blank')
  }
}

const downloadFile = () => {
  if (attachmentUrl.value && attachmentName.value) {
    const link = document.createElement('a')
    link.href = attachmentUrl.value
    link.download = attachmentName.value
    link.click()
  }
}

const onImageLoad = () => {
  // Could emit event for parent to handle layout updates
}

const onImageError = () => {
  console.error('Failed to load image:', attachmentUrl.value)
}

// Utility functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
</script>

<style scoped>
/* Optimized styles with contain property for performance */
.message-bubble {
  contain: layout style paint;
  will-change: transform;
  max-width: 70%;
  margin: var(--space-2) 0;
  position: relative;
  transform: translateZ(0); /* GPU acceleration */
}

.message-outgoing {
  align-self: flex-end;
  margin-left: auto;
}

.message-incoming {
  align-self: flex-start;
  margin-right: auto;
}

.message-content {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  position: relative;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-outgoing .message-content {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-600);
}

.message-text {
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Image message optimizations */
.message-image-content {
  max-width: 300px;
  max-height: 200px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: block;
  object-fit: cover;
  /* Performance optimizations */
  content-visibility: auto;
  contain-intrinsic-size: 300px 200px;
}

.image-container {
  position: relative;
  display: inline-block;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: var(--radius-lg);
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-container:hover .image-overlay {
  opacity: 1;
}

.image-actions {
  display: flex;
  gap: var(--space-2);
}

.image-action-btn {
  padding: var(--space-2);
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: var(--radius-md);
  color: var(--gray-700);
  cursor: pointer;
  transition: all 0.2s ease;
}

.image-action-btn:hover {
  background: white;
  transform: scale(1.05);
}

/* File message styles */
.file-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
}

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--gray-200);
  color: var(--gray-600);
}

.file-type-image { background: var(--green-100); color: var(--green-600); }
.file-type-pdf { background: var(--red-100); color: var(--red-600); }
.file-type-doc { background: var(--blue-100); color: var(--blue-600); }
.file-type-excel { background: var(--emerald-100); color: var(--emerald-600); }
.file-type-archive { background: var(--yellow-100); color: var(--yellow-600); }

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: var(--gray-900);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  gap: var(--space-2);
  font-size: 0.875rem;
  color: var(--gray-500);
}

.file-actions {
  display: flex;
  gap: var(--space-1);
}

.file-action-btn {
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  background: var(--primary-500);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-action-btn:hover {
  background: var(--primary-600);
  transform: translateY(-1px);
}

/* Message info */
.message-info {
  margin-top: var(--space-1);
  opacity: 0.7;
  font-size: 0.75rem;
}

.message-outgoing .message-info {
  text-align: right;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--gray-500);
}

.message-outgoing .message-meta {
  justify-content: flex-end;
}

.sender-name {
  font-weight: 500;
  color: var(--gray-600);
}

.message-status {
  display: flex;
  align-items: center;
}

.status-sent { color: var(--gray-400); }
.status-delivered { color: var(--green-500); }
.status-failed { color: var(--red-500); }

/* Message actions - performance optimized */
.message-actions {
  position: absolute;
  top: -8px;
  right: var(--space-2);
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--gray-200);
  padding: var(--space-1);
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
  /* Performance optimization */
  contain: layout style paint;
  will-change: opacity, transform;
}

.actions-visible {
  opacity: 1;
  transform: translateY(0);
}

.action-btn {
  padding: var(--space-2);
  border: none;
  background: none;
  border-radius: var(--radius-md);
  color: var(--gray-500);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.action-btn:hover {
  background: var(--gray-100);
  color: var(--gray-700);
  transform: scale(1.05);
}

.action-btn.danger:hover {
  background: var(--red-50);
  color: var(--red-600);
}

/* Animation optimizations */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .message-bubble {
    max-width: 85%;
  }
  
  .message-content {
    padding: var(--space-2) var(--space-3);
  }
  
  .message-image-content {
    max-width: 250px;
    max-height: 150px;
  }
  
  .message-actions {
    right: var(--space-1);
  }
}

/* Performance: Reduce paint on hover */
.message-bubble:hover {
  transform: translateZ(0);
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .message-actions,
  .image-overlay,
  .action-btn,
  .file-action-btn {
    transition: none;
  }
  
  .animate-spin {
    animation: none;
  }
}
</style>