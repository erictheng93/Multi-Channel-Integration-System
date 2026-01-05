<template>
  <div
    class="message-bubble"
    :class="messageBubbleClasses"
    @contextmenu="handleRightClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
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
          <div
            class="image-placeholder"
            style="width: 300px; height: 200px; aspect-ratio: 3/2;"
          >
            <img 
              :src="attachmentUrl" 
              :alt="attachmentName"
              class="message-image-content"
              style="width: 100%; height: 100%; object-fit: cover; display: block;"
              loading="lazy"
              decoding="async"
              @load="onImageLoad"
              @error="onImageError"
            >
          </div>
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

      <!-- 🔴 Module 2.3: Multiple File Attachments (New Version) -->
      <div
        v-else-if="imageAttachments.length > 0 || nonImageAttachments.length > 0"
        class="message-attachments-container"
      >
        <!-- 圖片附件：簡單顯示，不使用 Flex Message Card -->
        <div
          v-for="attachment in imageAttachments"
          :key="attachment.id"
          class="message-media attachment-image"
        >
          <div
            class="image-container"
            @click="handleAttachmentPreview(attachment)"
          >
            <div
              class="image-placeholder"
              style="width: 300px; max-height: 400px;"
            >
              <img
                :src="attachment.fileUrl"
                :alt="attachment.filename"
                class="message-image-content"
                width="300"
                style="width: 100%; height: auto; max-height: 400px; object-fit: contain; display: block;"
                loading="lazy"
                @load="onImageLoad"
                @error="onImageError"
              >
            </div>
            <div class="image-overlay">
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
                  @click.stop="downloadAttachment(attachment)"
                >
                  <DownloadIcon />
                </button>
              </div>
            </div>
          </div>
          <!-- 🆕 圖片附件發送狀態指示器 -->
          <div
            class="attachment-status-indicator image-status"
            :class="getAttachmentStatusClass(attachment)"
          >
            <template v-if="isAttachmentPending(attachment)">
              <span class="status-spinner" />
              <span class="status-text">傳送中...</span>
            </template>
            <template v-else-if="messageStatus === MESSAGE_STATUS.FAILED">
              <span class="status-icon failed">✕</span>
              <span class="status-text failed">發送失敗</span>
            </template>
            <template v-else>
              <span class="status-icon success">✓</span>
              <span class="status-text success">已發送</span>
            </template>
          </div>
        </div>

        <!-- 非圖片附件：使用 Flex Message Card 顯示 -->
        <div
          v-if="nonImageAttachments.length > 0"
          class="message-file-attachments"
        >
          <div
            v-for="attachment in nonImageAttachments"
            :key="attachment.id"
            class="attachment-wrapper"
          >
            <FileAttachmentCard
              :attachment="{
                id: attachment.id,
                filename: attachment.filename,
                mimeType: attachment.mimeType || '',
                fileSize: attachment.fileSize || 0,
                fileUrl: attachment.fileUrl
              }"
              :compact="nonImageAttachments.length > 1"
              @preview="handleAttachmentPreview"
            />
            <!-- 🆕 附件發送狀態指示器 -->
            <div
              class="attachment-status-indicator"
              :class="getAttachmentStatusClass(attachment)"
            >
              <template v-if="isAttachmentPending(attachment)">
                <span class="status-spinner" />
                <span class="status-text">傳送中...</span>
              </template>
              <template v-else-if="messageStatus === MESSAGE_STATUS.FAILED">
                <span class="status-icon failed">✕</span>
                <span class="status-text failed">發送失敗</span>
              </template>
              <template v-else>
                <span class="status-icon success">✓</span>
                <span class="status-text success">已發送</span>
              </template>
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

      <!-- File Message (Single Attachment - Legacy) -->
      <div
        v-else-if="message.messageType === 'file' && attachmentUrl && !hasMultipleAttachments"
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
            <div
              v-if="uploadProgress !== undefined"
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

      <!-- 🔴 Module 2.2: Sticker Message -->
      <div
        v-else-if="actualMessageType === 'sticker'"
        class="message-sticker"
      >
        <!-- Comprehensive Sticker Renderer (Primary) -->
        <SafeHtmlRenderer
          v-if="processedMessageContent && processedMessageContent !== message.content"
          :html="processedMessageContent"
          class="sticker-rendered-content"
        />

        <!-- Fallback: Enhanced sticker display with loading states -->
        <template v-else>
          <!-- Loading state -->
          <div
            v-if="stickerLoading && !stickerLoadError"
            class="sticker-loading"
          >
            <div class="sticker-loading-container">
              <div class="sticker-skeleton" />
              <div class="loading-spinner">
                <div class="spinner-ring" />
              </div>
            </div>
            <div class="loading-text">
              載入貼圖中...
            </div>
          </div>

          <!-- Sticker image with enhanced error handling -->
          <div
            v-else-if="stickerImageUrl && !stickerLoadError"
            class="sticker-image-container"
            style="width: 160px; height: 160px; position: relative;"
          >
            <img
              :key="`sticker-${stickerMetadata?.stickerId}-${currentStickerUrlIndex}`"
              :src="stickerImageUrl"
              alt="LINE Sticker"
              class="sticker-image"
              style="width: 100%; height: 100%; object-fit: contain;"
              loading="lazy"
              @error="onStickerError"
              @load="onStickerLoad"
              @loadstart="onStickerLoadStart"
            >

            <!-- CDN source indicator (dev mode only) -->
            <div
              v-if="currentStickerUrlIndex > 0"
              class="cdn-fallback-indicator"
              :title="`使用備用CDN源 #${currentStickerUrlIndex + 1}`"
            >
              ⚡
            </div>
          </div>

          <!-- Enhanced fallback for failed stickers -->
          <div
            v-else
            class="sticker-placeholder enhanced"
          >
            <div class="sticker-icon-large">
              <div class="sticker-emoji">
                🎭
              </div>
            </div>
            <div class="sticker-fallback-content">
              <div class="sticker-text">
                {{ message.content }}
              </div>
              <div class="sticker-error-hint">
                <span v-if="currentStickerUrlIndex >= stickerUrls.length - 1">
                  貼圖載入失敗
                </span>
                <span v-else>
                  正在嘗試載入...
                </span>
              </div>
            </div>
          </div>

          <!-- Sticker metadata info (enhanced) -->
          <div
            v-if="stickerMetadata"
            class="sticker-info enhanced"
          >
            <span class="sticker-id-info">
              📦 {{ stickerMetadata.packageId }} · 🏷️ {{ stickerMetadata.stickerId }}
            </span>
            <span
              v-if="currentStickerUrlIndex > 0"
              class="cdn-info"
              :title="stickerImageUrl || undefined"
            >
              · CDN {{ currentStickerUrlIndex + 1 }}
            </span>
          </div>
        </template>
      </div>

      <!-- Text Message (SafeHtmlRenderer for link recognition) -->
      <SafeHtmlRenderer
        v-else
        :html="processedMessageContent"
        class="message-text"
      />
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
          <!-- 🔴 Module 3.3: Failed Status with Retry Button -->
          <div
            v-if="message.deliveryStatus === 'failed'"
            class="status-failed-wrapper"
          >
            <XIcon
              class="status-failed"
              title="發送失敗"
            />
            <button
              class="retry-btn"
              title="重試發送"
              @click.stop="handleRetry"
            >
              🔄
            </button>
          </div>

          <!-- Default Status Icon -->
          <component
            v-else-if="statusIcon"
            :is="statusIcon"
            :class="message.deliveryStatus === 'sending' ? 'animate-spin' : ''"
          />
        </div>
      </div>
    </div>

    <!-- 🔴 Module 3.2: Message Actions with Dropdown Menu -->
    <div
      v-if="showActions || showActionsMenu"
      class="message-actions"
      :class="{ 'actions-outgoing': isOutgoing }"
    >
      <button
        class="action-btn"
        title="複製"
        @click="copyMessage"
      >
        <CopyIcon />
      </button>

      <button
        v-if="!isOutgoing"
        class="action-btn"
        title="回覆"
        @click="replyToMessage"
      >
        <ReplyIcon />
      </button>

      <button
        class="action-btn"
        title="更多操作"
        @click="toggleActionsMenu"
      >
        <MoreVerticalIcon />
      </button>

      <!-- Dropdown Menu -->
      <div
        v-if="showActionsMenu"
        class="actions-dropdown"
        @click.stop
      >
        <button
          class="dropdown-item"
          @click="forwardMessage"
        >
          <ForwardIcon />
          <span>轉發</span>
        </button>

        <button
          v-if="isOutgoing && canRecall"
          class="dropdown-item danger"
          @click="recallMessage"
        >
          <TrashIcon />
          <span>撤回</span>
        </button>

        <button
          class="dropdown-item"
          @click="selectMessage"
        >
          <CheckIcon />
          <span>選擇</span>
        </button>
      </div>
    </div>

    <!-- Sender info for incoming messages -->
    <div
      v-if="!isOutgoing && showSender"
      class="sender-info"
    >
      <div class="sender-avatar">
        {{ senderInitials }}
      </div>
      <span class="sender-name">{{ senderName }}</span>
    </div>
  </div>

  <!-- 🔴 Module 3.1: Image Preview Modal with Zoom Controls -->
  <Teleport
    v-if="showImagePreview"
    to="body"
  >
    <div
      class="image-preview-overlay"
      @click="closeImagePreview"
    >
      <div
        class="image-preview-modal"
        @click.stop
      >
        <div class="preview-header">
          <div class="preview-title">
            <h3>{{ attachmentName }}</h3>
            <span class="preview-meta">{{ formatFileSize(attachmentSize || 0) }}</span>
          </div>
          <div class="preview-actions">
            <button
              class="preview-btn"
              @click="downloadFile"
            >
              <DownloadIcon />
            </button>
            <button
              class="preview-btn close"
              @click="closeImagePreview"
            >
              <XIcon />
            </button>
          </div>
        </div>
        <div class="preview-content">
          <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
            <img
              :src="attachmentUrl || ''"
              :alt="attachmentName"
              class="preview-image"
              style="max-width: 100%; max-height: 100%; object-fit: contain;"
              :style="{ transform: `scale(${zoomLevel})` }"
              loading="lazy"
              @wheel="handleZoom"
            >
          </div>
        </div>
        <div class="preview-controls">
          <button
            class="zoom-btn"
            @click="zoomOut"
          >
            <span>-</span>
          </button>
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <button
            class="zoom-btn"
            @click="zoomIn"
          >
            <span>+</span>
          </button>
          <button
            class="zoom-btn"
            @click="resetZoom"
          >
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '@/types'

// 🔴 Module 1: 补齐导入依赖
import SafeHtmlRenderer from '@/components/ui/SafeHtmlRenderer.vue'
import FileAttachmentCard from '@/components/file/FileAttachmentCard.vue'
import { MESSAGE_STATUS } from '@/constants/message-status'

// Import message utilities and composables
import {
  formatFileSize,
  getFileExtension,
  getFileTypeClass
} from '@/utils/message'
import {
  useMessageTime,
  useMessageAttachment,
  useMessageActions,
  useMessageSticker,
  useMessageContent,
  type FileAttachment
} from '@/composables/message'

// Props interface (补齐原版的所有 props)
interface Props {
  message: Message
  delivered?: boolean
  showSender?: boolean
  canEdit?: boolean // 优化版新增（保留）
  canDelete?: boolean // 优化版新增（保留）
  // 🔴 Module 1: 补齐原版 props
  uploadProgress?: number
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  delivered: true,
  showSender: true,
  canEdit: false,
  canDelete: false,
  uploadProgress: undefined,
  attachmentUrl: '',
  attachmentName: '',
  attachmentSize: 0
})

// 🔴 Module 1: 补齐 Emits（添加 preview, image-error, retry）
const emit = defineEmits<{
  preview: [message: Message]
  'image-error': [message: Message]
  copy: [message: Message]
  reply: [message: Message]
  forward: [message: Message]
  recall: [message: Message]
  select: [message: Message]
  retry: [messageId: string]
}>()

// 🔴 Import icons from index (icons are already lightweight with createIcon)
import {
  SearchIcon,
  DownloadIcon,
  CopyIcon,
  ReplyIcon,
  ForwardIcon,
  CheckIcon,
  ClockIcon,
  AlertCircleIcon,
  XIcon,
  MoreVerticalIcon,
  TrashIcon,
  FileIcon,
  ImageIcon
} from '@/components/icons'

// 🔴 Module 2.1: 集成所有 Composables

// 1️⃣ useMessageTime - 时间格式化
const { formatTime } = useMessageTime()

// 2️⃣ useMessageAttachment - 附件处理
// 创建 reactive props for useMessageAttachment
const attachmentProps = computed(() => ({
  message: props.message,
  attachmentUrl: props.attachmentUrl,
  attachmentName: props.attachmentName,
  attachmentSize: props.attachmentSize
}))

const {
  fileAttachments,
  imageAttachments,
  nonImageAttachments,
  hasMultipleAttachments,
  isFileOnlyContent,
  messageStatus,
  downloadFile,
  downloadAttachment,
  handleAttachmentPreview: handleAttachmentPreviewBase,
  isAttachmentPending,
  getAttachmentStatusClass
} = useMessageAttachment(attachmentProps)

// Mark fileAttachments as used (it's internally used by imageAttachments and nonImageAttachments)
void fileAttachments

// Wrap handleAttachmentPreview to emit the preview event
const handleAttachmentPreview = (attachment: FileAttachment) => {
  handleAttachmentPreviewBase(attachment, (message) => emit('preview', message))
}

// 3️⃣ useMessageActions - 消息操作
const actionsProps = computed(() => ({
  message: props.message
}))

const actionsEmit = {
  copy: (message: Message) => emit('copy', message),
  reply: (message: Message) => emit('reply', message),
  forward: (message: Message) => emit('forward', message),
  recall: (message: Message) => emit('recall', message),
  select: (message: Message) => emit('select', message),
  retry: (messageId: string) => emit('retry', messageId)
}

const {
  showActions,
  showActionsMenu,
  handleRightClick,
  toggleActionsMenu,
  copyMessage,
  replyToMessage,
  forwardMessage,
  recallMessage,
  selectMessage,
  handleRetry
} = useMessageActions(actionsProps, actionsEmit)

// 4️⃣ useMessageSticker - 贴纸处理
const stickerProps = computed(() => ({
  message: props.message
}))

const {
  stickerMetadata,
  stickerUrls,
  stickerImageUrl,
  currentStickerUrlIndex,
  stickerLoadError,
  stickerLoading,
  onStickerLoadStart,
  onStickerError,
  onStickerLoad
} = useMessageSticker(stickerProps)

// 5️⃣ useMessageContent - 内容处理
const contentProps = computed(() => ({
  message: props.message
}))

const {
  processedMessageContent,
  actualMessageType
} = useMessageContent(contentProps)

// 🔴 Module 3.1: Image Preview Modal State
const showImagePreview = ref(false)
const zoomLevel = ref(1)

// 🔴 Module 2.1: 保留的计算属性（兼容性）
const isOutgoing = computed(() => {
  // Support both senderType and direction for test compatibility
  if ('direction' in props.message) {
    return (props.message as { direction: string }).direction === 'outgoing'
  }
  return props.message.senderType === 'agent'
})

const senderName = computed(() => {
  if (!props.showSender) {return ''}
  if (props.message.senderType === 'customer') {
    return '客戶'
  }
  return '客服'
})

const senderInitials = computed(() => {
  return senderName.value[0]
})

// File handling - 优先使用 props，fallback 到 metadata（兼容性保留）
const attachmentUrl = computed(() => {
  return props.attachmentUrl || props.message.metadata?.attachment?.url || ''
})
const attachmentName = computed(() => {
  return props.attachmentName || props.message.metadata?.attachment?.name || 'unknown'
})
const attachmentSize = computed(() => {
  return props.attachmentSize || props.message.metadata?.attachment?.size || 0
})

// 🔴 Module 2.1: 移除重复代码，使用 Composables 和工具函数提供的功能
// isFileOnlyContent - 由 useMessageAttachment 提供
// downloadFile - 由 useMessageAttachment 提供
// formatTime - 由 useMessageTime 提供

// 保留的本地计算属性（用于模板兼容性）
const formattedFileSize = computed(() => {
  if (!attachmentSize.value) {return ''}
  return formatFileSize(attachmentSize.value)
})

const fileExtension = computed(() => {
  return getFileExtension(attachmentName.value || '')
})

const fileTypeClass = computed(() => {
  return getFileTypeClass(attachmentName.value || '')
})

// 文件图标判断（保留本地实现，用于 component :is）
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
  if (imageExts.includes(ext || '')) {return ImageIcon}
  return FileIcon
}

const fileIconComponent = computed(() => {
  return getFileIcon(attachmentName.value || '')
})

// 时间格式化（使用 useMessageTime 提供的 formatTime）
const formattedTime = computed(() => {
  // 支持 timestamp 或 createdAt（向后兼容测试数据）
  return formatTime(props.message.timestamp || props.message.createdAt)
})

// Message status
const statusIcon = computed(() => {
  if (!isOutgoing.value) {return null}
  
  switch (props.message.deliveryStatus) {
    case 'pending':
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
  switch (props.message.deliveryStatus) {
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
  if (!isOutgoing.value) {return false}

  // 支持 timestamp 或 createdAt（向后兼容）
  const messageTime = new Date(props.message.timestamp || props.message.createdAt).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  return (now - messageTime) < fiveMinutes && props.message.deliveryStatus !== 'failed'
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

// 🔴 Module 2.1: 事件处理函数（部分由 Composables 提供）
// handleRightClick, toggleActionsMenu, copyMessage, replyToMessage, forwardMessage, recallMessage, selectMessage, handleRetry
// 已由 useMessageActions 提供

// Hover handlers for showing/hiding message actions
const handleMouseEnter = () => {
  showActions.value = true
}

const handleMouseLeave = () => {
  showActions.value = false
}

// 🔴 Module 3.1: Complete Image Preview with Modal
const openImagePreview = () => {
  if (actualMessageType.value === 'image' && attachmentUrl.value) {
    showImagePreview.value = true
    zoomLevel.value = 1
    emit('preview', props.message)
  }
}

const closeImagePreview = () => {
  showImagePreview.value = false
  zoomLevel.value = 1
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 3)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.5)
}

const resetZoom = () => {
  zoomLevel.value = 1
}

const handleZoom = (event: WheelEvent) => {
  event.preventDefault()
  if (event.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

// downloadFile - 已由 useMessageAttachment 提供，这里移除本地实现

// 图片加载处理（保留）
const onImageLoad = () => {
  // Image loaded successfully
}

const onImageError = () => {
  console.error('Failed to load image:', attachmentUrl.value)
  emit('image-error', props.message)
}

// 🔴 Module 1: 移除重复的 formatFileSize 函数
// formatFileSize 已从 @/utils/message 导入，无需本地定义
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

/* 🔴 Module 2.5: Sticker Message Styles */
.message-sticker {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2);
}

.sticker-image-container {
  position: relative;
  display: inline-block;
}

.sticker-image {
  width: 100%;
  max-width: 160px;
  height: auto;
  border-radius: var(--radius-lg);
  transition: transform var(--transition-fast);
  cursor: pointer;
}

.sticker-image:hover {
  transform: scale(1.05);
}

.sticker-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3);
  margin-bottom: var(--space-2);
}

.sticker-loading-container {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: var(--space-2);
}

.sticker-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--gray-200) 25%, var(--gray-100) 50%, var(--gray-200) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: var(--radius-lg);
}

.loading-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.spinner-ring {
  width: 24px;
  height: 24px;
  border: 2px solid var(--gray-300);
  border-top: 2px solid var(--primary-500);
  border-radius: 50%;
  animation: sticker-spin 1s linear infinite;
}

.loading-text {
  font-size: 0.75rem;
  color: var(--gray-500);
  text-align: center;
}

.message-outgoing .loading-text {
  color: rgba(255, 255, 255, 0.8);
}

.message-outgoing .sticker-skeleton {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.2) 25%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.2) 75%);
  background-size: 200% 100%;
}

.message-outgoing .spinner-ring {
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: rgba(255, 255, 255, 0.8);
}

@keyframes skeleton-loading {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes sticker-spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

.sticker-placeholder.enhanced {
  min-height: 120px;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--gray-50);
  border: 2px dashed var(--gray-300);
  transition: all var(--transition-fast);
}

.sticker-icon-large {
  margin-bottom: var(--space-3);
}

.sticker-emoji {
  font-size: 3rem;
  opacity: 0.6;
  animation: bounce 2s infinite;
}

.sticker-fallback-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sticker-text {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.sticker-error-hint {
  font-size: 0.7rem;
  color: var(--gray-400);
  font-style: italic;
}

.message-outgoing .sticker-placeholder.enhanced {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.message-outgoing .sticker-text {
  color: rgba(255, 255, 255, 0.9);
}

.message-outgoing .sticker-error-hint {
  color: rgba(255, 255, 255, 0.6);
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
  60% { transform: translateY(-4px); }
}

.cdn-fallback-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--amber-500);
  color: white;
  border-radius: var(--radius-full);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(245, 158, 11, 0.5);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
    transform: scale(1.1);
  }
}

.sticker-info.enhanced {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--gray-100);
  border-radius: var(--radius-md);
  font-size: 0.65rem;
  line-height: 1.2;
}

.sticker-id-info {
  color: var(--gray-600);
  font-weight: 500;
}

.cdn-info {
  color: var(--amber-600);
  font-weight: 600;
  font-size: 0.6rem;
}

.message-outgoing .sticker-info.enhanced {
  background: rgba(255, 255, 255, 0.15);
}

.message-outgoing .sticker-id-info {
  color: rgba(255, 255, 255, 0.8);
}

.message-outgoing .cdn-info {
  color: rgba(255, 255, 255, 0.9);
}

/* 🔴 Module 2.6: Multiple Attachments Styles */
.message-attachments-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.attachment-image {
  margin-bottom: var(--space-2);
}

.message-file-attachments {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.attachment-wrapper {
  position: relative;
}

.attachment-status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
  font-size: 0.75rem;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background: var(--gray-50);
}

.attachment-status-indicator.image-status {
  margin-top: var(--space-2);
}

.status-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--gray-300);
  border-top-color: var(--primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.status-icon {
  font-size: 12px;
  font-weight: bold;
}

.status-icon.failed {
  color: var(--red-500);
}

.status-icon.success {
  color: var(--green-500);
}

.status-text {
  font-size: 0.7rem;
  color: var(--gray-600);
}

.status-text.failed {
  color: var(--red-600);
}

.status-text.success {
  color: var(--green-600);
}

.media-caption {
  margin-top: var(--space-2);
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--gray-700);
}

.message-outgoing .media-caption {
  color: rgba(255, 255, 255, 0.9);
}

/* Responsive Adjustments for Stickers */
@media (max-width: 480px) {
  .sticker-loading-container,
  .sticker-image-container {
    width: 100px !important;
    height: 100px !important;
  }

  .sticker-placeholder.enhanced {
    min-height: 100px;
    padding: var(--space-3);
  }

  .sticker-emoji {
    font-size: 2rem;
  }

  .sticker-info.enhanced {
    font-size: 0.6rem;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .message-actions,
  .image-overlay,
  .action-btn,
  .file-action-btn {
    transition: none;
  }

  .animate-spin,
  .spinner-ring,
  .status-spinner {
    animation: none;
  }

  .sticker-emoji {
    animation: none;
  }

  .cdn-fallback-indicator {
    animation: none;
  }
}

/* 🔴 Module 3.1: Image Preview Modal Styles */
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
  animation: fadeIn 0.3s ease-out;
}

.image-preview-modal {
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-50);
}

.preview-title h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
}

.preview-meta {
  font-size: 0.875rem;
  color: var(--gray-500);
}

.preview-actions {
  display: flex;
  gap: var(--space-2);
}

.preview-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--gray-200);
  color: var(--gray-600);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.preview-btn:hover {
  background: var(--gray-300);
  color: var(--gray-800);
}

.preview-btn.close:hover {
  background: var(--red-100);
  color: var(--red-600);
}

.preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--gray-100);
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform var(--transition-normal);
  cursor: grab;
}

.preview-image:active {
  cursor: grabbing;
}

.preview-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
}

.zoom-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--gray-300);
  background: white;
  color: var(--gray-600);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.zoom-btn:hover {
  background: var(--gray-100);
  border-color: var(--gray-400);
  color: var(--gray-800);
}

.zoom-level {
  min-width: 60px;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
}

/* Responsive adjustments for preview modal */
@media (max-width: 768px) {
  .image-preview-modal {
    max-width: 95vw;
    max-height: 95vh;
  }

  .preview-header {
    padding: var(--space-3) var(--space-4);
  }

  .preview-content {
    padding: var(--space-4);
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
  }
}

/* 🔴 Module 3.2: Actions Dropdown Menu Styles */
.actions-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-1);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 120px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  color: var(--gray-700);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.dropdown-item:hover {
  background: var(--gray-50);
}

.dropdown-item.danger {
  color: var(--red-600);
}

.dropdown-item.danger:hover {
  background: var(--red-50);
  color: var(--red-700);
}

.dropdown-item svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Mobile optimizations for actions dropdown */
@media (max-width: 768px) {
  .actions-dropdown {
    min-width: 140px;
  }

  .dropdown-item {
    padding: var(--space-3) var(--space-4);
    font-size: 1rem;
  }

  .dropdown-item svg {
    width: 16px;
    height: 16px;
  }
}

/* 🔴 Module 3.3: Retry Failed Message Styles */
.status-failed-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.retry-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.9);
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: scale(1.05);
}

.retry-btn:active {
  transform: scale(0.95);
}

/* Sender info styles */
.sender-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: 0.875rem;
}

.sender-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--gray-300);
  color: var(--gray-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.sender-name {
  color: var(--gray-600);
  font-size: 0.75rem;
}

/* Upload progress styles */
.file-progress {
  margin-top: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-500);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

.progress-text {
  font-size: 0.75rem;
  color: var(--gray-600);
  min-width: 3ch;
  text-align: right;
}
</style>