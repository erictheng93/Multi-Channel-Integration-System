<template>
  <div 
    class="message-bubble"
    :class="{
      'message-outgoing': isOutgoing,
      'message-incoming': !isOutgoing,
      'message-delivered': delivered && isOutgoing,
      'message-failed': !delivered && isOutgoing,
      'message-image': actualMessageType === 'image',
      'message-file': actualMessageType === 'file'
    }"
    @contextmenu="handleRightClick"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
  >
    <div class="message-content">
      <!-- Image Message -->
      <div
        v-if="actualMessageType === 'image' && attachmentUrl"
        class="message-media"
      >
        <div
          class="image-container"
          @click="openImagePreview"
        >
          <div
            class="image-placeholder"
            style="width: 300px; max-height: 400px;"
          >
            <img
              :src="attachmentUrl"
              :alt="attachmentName"
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

      <!-- File Message (Single Attachment - Legacy) -->
      <div
        v-else-if="actualMessageType === 'file' && attachmentUrl && !hasMultipleAttachments"
        class="message-file-content"
      >
        <div class="file-container">
          <div
            class="file-icon"
            :class="getFileTypeClass(attachmentName || '')"
          >
            <component :is="getFileIcon(attachmentName || '')" />
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
              >{{ formatFileSize(attachmentSize) }}</span>
              <span class="file-type">{{ getFileExtension(attachmentName || '') }}</span>
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
              @click="downloadFile"
            >
              <DownloadIcon />
              下載
            </button>
          </div>
        </div>
        <div
          v-if="message.content && !isFileOnlyContent"
          class="media-caption"
        >
          {{ message.content }}
        </div>
      </div>

      <!-- 🔧 FIX: Image Attachments - Simple display without Flex Message Card -->
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
            <template v-else-if="messageStatus === 'failed'">
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
              <template v-else-if="messageStatus === 'failed'">
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

      <!-- Sticker Message -->
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

      <!-- Text Message -->
      <SafeHtmlRenderer
        v-else
        :html="processedMessageContent"
        class="message-text"
      />
      <div class="message-meta">
        <time class="message-time">
          {{ formatTime(message.timestamp || message.createdAt) }}
        </time>

        <!-- ⚡ Enhanced Message Status with Optimistic UI -->
        <div
          v-if="isOutgoing"
          class="message-status"
        >
          <!-- ⏳ Sending状态 -->
          <div
            v-if="messageStatus === 'sending' || messageStatus === 'pending'"
            class="status-sending"
            title="发送中..."
          >
            <div class="spinner-small" />
          </div>

          <!-- ✅ Sent/Delivered状态 -->
          <CheckIcon
            v-else-if="messageStatus === 'sent' || messageStatus === 'delivered' || delivered"
            class="status-delivered"
            title="已送达"
          />

          <!-- ❌ Failed状态 with重试按钮 -->
          <div
            v-else-if="messageStatus === 'failed'"
            class="status-failed-wrapper"
          >
            <XIcon
              class="status-failed"
              title="发送失败"
            />
            <button
              class="retry-btn"
              title="重试发送"
              @click.stop="handleRetry"
            >
              🔄
            </button>
          </div>

          <!-- Default状态 -->
          <CheckIcon
            v-else
            class="status-delivered"
          />
        </div>
      </div>
      
      <!-- Message Actions Menu -->
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
            v-if="isOutgoing"
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

    <!-- Enhanced Image Preview Modal -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type { Message } from '@/types'
import { renderDatabaseMessageForVue } from '@/utils/enhanced-message-renderer'
import { convertEmojiForMessageDetail } from '@/utils/layered-emoji-processor'
import SafeHtmlRenderer from '@/components/ui/SafeHtmlRenderer.vue'
import FileAttachmentCard from '@/components/file/FileAttachmentCard.vue'

// Local interface matching FileAttachmentCard's expected type
interface FileAttachment {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  fileUrl: string
  r2Key?: string
}

import {
  CheckIcon,
  XIcon,
  SearchIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  CopyIcon,
  ReplyIcon,
  MoreVerticalIcon,
  ForwardIcon,
  TrashIcon
} from '@/components/icons'

interface Props {
  message: Message
  delivered?: boolean
  showSender?: boolean
  uploadProgress?: number
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  delivered: true,
  showSender: false,
  uploadProgress: undefined,
  attachmentUrl: '',
  attachmentName: '',
  attachmentSize: 0
})

const emit = defineEmits<{
  preview: [message: Message]
  'image-error': [message: Message]
  copy: [message: Message]
  reply: [message: Message]
  forward: [message: Message]
  recall: [message: Message]
  select: [message: Message]
  retry: [messageId: string] // ⚡ New: Retry failed message
}>()

// State
const showImagePreview = ref(false)
const zoomLevel = ref(1)
const imageLoaded = ref(false)
const imageError = ref(false)
const showActions = ref(false)
const showActionsMenu = ref(false)

// Computed properties
const isOutgoing = computed(() => {
  // Support both senderType and direction for test compatibility
  if ('direction' in props.message) {
    return (props.message as { direction: string }).direction === 'outgoing'
  }
  return props.message.senderType === 'agent'
})

const senderName = computed(() => {
  if (props.message.senderType === 'customer') {
    return '客戶'
  }
  return '客服'
})

const senderInitials = computed(() => {
  return senderName.value[0]
})

// 🔧 智能消息类型识别: 防御性处理 LINE API 类型误判
// 即使后端存储的 messageType 不正确,前端也能根据 metadata 智能识别
const actualMessageType = computed(() => {
  const originalType = props.message.messageType;

  // 检查 metadata 中是否包含文件信息
  if (props.message.metadata) {
    try {
      const metadata = typeof props.message.metadata === 'string'
        ? JSON.parse(props.message.metadata)
        : props.message.metadata;

      // 如果 metadata 中有 fileName 和 fileSize,说明这是文件消息
      // 即使 messageType 是 video/audio,也应该当作 file 处理
      if (metadata.fileName && metadata.fileSize !== undefined) {
        if (originalType !== 'file') {
          console.warn('🔧 [MessageBubble] Type correction:', {
            originalType,
            correctedType: 'file',
            fileName: metadata.fileName,
            messageId: props.message.id
          });
        }
        return 'file';
      }
    } catch (error) {
      console.error('❌ [MessageBubble] Failed to parse metadata:', error);
    }
  }

  // 如果无法从 metadata 判断,使用原始类型
  return originalType;
})

const attachmentUrl = computed(() => {
  // Use prop if provided (for tests)
  if (props.attachmentUrl) {return props.attachmentUrl}
  
  if (props.message.metadata?.attachment?.url) {
    return props.message.metadata.attachment.url
  }
  const urlMatch = props.message.content?.match(/https?:\/\/[^\s]+/)
  return urlMatch ? urlMatch[0] : null
})

const attachmentName = computed(() => {
  // Use prop if provided (for tests)
  if (props.attachmentName) {return props.attachmentName}
  
  if (props.message.metadata?.attachment?.name) {
    return props.message.metadata.attachment.name
  }
  const fileMatch = props.message.content?.match(/\[(?:檔案|圖片)\]\s*(.+)/)
  return fileMatch ? fileMatch[1] : '附件'
})

const attachmentSize = computed(() => {
  // Use prop if provided (for tests)
  if (props.attachmentSize) {return props.attachmentSize}

  return props.message.metadata?.attachment?.size
})

// 處理 file_attachments 陣列 - 用於 Flex Message Card 顯示
// 🔧 FIX: 同時支援 file_attachments 和 metadata.pendingAttachments (optimistic UI)
const fileAttachments = computed(() => {
  // Priority 1: Use confirmed file_attachments
  if (props.message.file_attachments && props.message.file_attachments.length > 0) {
    return props.message.file_attachments
  }

  // Priority 2: Use pending attachments from optimistic UI (during upload)
  const pendingAttachments = (props.message.metadata as Record<string, unknown>)?.pendingAttachments as Array<{
    name: string
    size: number
    blobUrl?: string
    isImage: boolean
    fileType: string
    typeColor: string
  }> | undefined

  if (pendingAttachments && pendingAttachments.length > 0) {
    // Normalize pending attachments to match file_attachments structure
    return pendingAttachments.map((pending, index) => ({
      id: `pending-${index}`,
      filename: pending.name,
      mimeType: pending.isImage ? 'image/*' : pending.fileType,
      fileSize: pending.size,
      fileUrl: pending.blobUrl || '', // Use blob URL for preview during upload
      isPending: true // Mark as pending for UI differentiation
    }))
  }

  return []
})

// 🔧 FIX: 分離圖片附件 - 圖片不使用 Flex Message Card 效果
const isImageFile = (attachment: { mimeType?: string; filename?: string }) => {
  const mimeType = (attachment.mimeType || '').toLowerCase()
  const filename = (attachment.filename || '').toLowerCase()
  return mimeType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].some(ext =>
      filename.endsWith(`.${ext}`)
    )
}

// 圖片附件 - 使用簡單圖片顯示
const imageAttachments = computed(() => {
  return fileAttachments.value.filter(isImageFile)
})

// 非圖片附件 - 使用 Flex Message Card 顯示
const nonImageAttachments = computed(() => {
  return fileAttachments.value.filter(attachment => !isImageFile(attachment))
})

const hasMultipleAttachments = computed(() => {
  return fileAttachments.value.length > 1
})

const isFileOnlyContent = computed(() => {
  const content = props.message.content || ''
  // Match Chinese format: [檔案] [圖片] [影片] [語音] [貼圖] [位置] etc.
  // Match English format: Sent a file: filename
  // Match multi-file format: Sent 2 files, Sent 3 files
  return /^\[(?:檔案|圖片|影片|語音|貼圖|位置)\](?:\s*.+)?$/.test(content) ||
         /^Sent a file:\s*.+$/i.test(content) ||
         /^Sent \d+ files$/i.test(content)
})

// ⚡ Message Status for Optimistic UI
const messageStatus = computed(() => {
  // Priority 1: Use message.status (new optimistic UI field)
  if (props.message.status) {
    return props.message.status
  }

  // Priority 2: Use message.deliveryStatus (legacy field)
  if (props.message.deliveryStatus) {
    return props.message.deliveryStatus
  }

  // Priority 3: Fallback to delivered prop
  if (props.delivered) {
    return 'delivered'
  }

  // Default: assume sent
  return 'sent'
})

const stickerMetadata = computed(() => {
  // Debug logs for sticker metadata parsing
  console.log('🔍 [Sticker Debug] Message type:', props.message.messageType)
  console.log('🔍 [Sticker Debug] Message content:', props.message.content)
  console.log('🔍 [Sticker Debug] Raw metadata:', props.message.metadata)
  
  if (props.message.messageType !== 'sticker' || !props.message.metadata) {
    console.log('🔍 [Sticker Debug] Condition failed - messageType or metadata missing')
    return null
  }
  
  try {
    const metadata = typeof props.message.metadata === 'string' 
      ? JSON.parse(props.message.metadata) 
      : props.message.metadata
    
    console.log('🔍 [Sticker Debug] Parsed metadata:', metadata)
    
    const result = {
      packageId: metadata.packageId,
      stickerId: metadata.stickerId
    }
    
    console.log('🔍 [Sticker Debug] Final sticker metadata:', result)
    return result
  } catch (error) {
    console.error('❌ [Sticker Debug] Failed to parse sticker metadata:', error)
    return null
  }
})

// 貼圖 CDN 回退機制狀態
const currentStickerUrlIndex = ref(0)
const stickerLoadError = ref(false)
const stickerLoading = ref(false)

const stickerUrls = computed(() => {
  if (!stickerMetadata.value) {return []}

  return [
    // Format 1: Android 平台（主要）
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.value.stickerId}/android/sticker.png`,
    // Format 2: iPhone 平台（備用1）
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.value.stickerId}/iPhone/sticker.png`,
    // Format 3: iPad 平台（備用2）
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.value.stickerId}/iPad/sticker.png`,
    // Format 4: 舊版格式（最終回退）
    `http://dl.stickershop.line.naver.jp/products/0/0/1/${stickerMetadata.value.packageId}/android/sticker.png`
  ]
})

const stickerImageUrl = computed(() => {
  console.log('🔍 [Sticker Debug] Computing sticker image URL...')
  console.log('🔍 [Sticker Debug] stickerMetadata.value:', stickerMetadata.value)

  if (!stickerUrls.value.length) {
    console.log('🔍 [Sticker Debug] No sticker URLs available')
    return null
  }

  const currentUrl = stickerUrls.value[currentStickerUrlIndex.value]
  console.log('🔍 [Sticker Debug] Current URL index:', currentStickerUrlIndex.value)
  console.log('🔍 [Sticker Debug] Generated sticker URL:', currentUrl)
  console.log('🔍 [Sticker Debug] PackageId:', stickerMetadata.value?.packageId)
  console.log('🔍 [Sticker Debug] StickerId:', stickerMetadata.value?.stickerId)

  return currentUrl
})

// 处理消息内容，使用智能emoji渲染器
const processedMessageContent = ref('')

// 异步处理消息内容
// 缓存处理结果，避免重复处理
const contentCache = new Map<string, string>()
let debounceTimer: number | null = null

const processMessageContent = async () => {
  if (!props.message.content) {
    processedMessageContent.value = ''
    return
  }

  // 清除之前的防抖计时器
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // 防抖处理，避免频繁调用
  debounceTimer = window.setTimeout(async () => {
    try {
      // 创建内容标识符，包含内容、类型和metadata
      const messageType = props.message.messageType || 'text' // 提供fallback
      const contentIdentifier = `${props.message.content}|${messageType}|${JSON.stringify(props.message.metadata || {})}`
      
      // 检查缓存
      if (contentCache.has(contentIdentifier)) {
        const cachedContent = contentCache.get(contentIdentifier)
        if (cachedContent) {
          processedMessageContent.value = cachedContent
          return
        }
      }

      if (import.meta.env.DEV) {
        console.log('🔍 [MessageBubble] Processing message:', {
          content: `${props.message.content.substring(0, 50)  }...`,
          type: messageType,
          hasMetadata: !!props.message.metadata
        })
      }
      
      let result: string
      
      // 如果是贴图消息，使用完整的数据库消息渲染器（包含贴图处理）
      if (messageType === 'sticker' && props.message.metadata) {
        const metadataString = typeof props.message.metadata === 'string' 
          ? props.message.metadata 
          : JSON.stringify(props.message.metadata)
        
        result = await renderDatabaseMessageForVue(
          props.message.content,
          messageType,
          metadataString
        )
      } else {
        // 其他消息类型使用分层emoji处理器 (Layer 1 + Layer 2)
        result = await convertEmojiForMessageDetail(props.message.content)
      }
      
      // 缓存结果（限制缓存大小，避免内存泄漏）
      if (contentCache.size > 100) {
        const firstKey = contentCache.keys().next().value
        if (firstKey) {
          contentCache.delete(firstKey)
        }
      }
      contentCache.set(contentIdentifier, result)
      
      processedMessageContent.value = result
      
      if (import.meta.env.DEV) {
        console.log('🔍 [MessageBubble] Content processed successfully')
      }
    } catch (error) {
      console.error('❌ [MessageBubble] 处理消息内容时出错:', error)
      // 如果处理失败，使用原始内容（转义HTML）
      processedMessageContent.value = escapeHtml(props.message.content)
    }
  }, 100) // 100ms防抖
}

// HTML转义函数
const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 智能监听消息变化，包含内容、类型和metadata的变更
watch(
  () => ({
    content: props.message.content,
    messageType: props.message.messageType,
    metadata: props.message.metadata
  }),
  (newValue, oldValue) => {
    // 只有在实际内容发生变化时才重新处理
    if (!oldValue || 
        newValue.content !== oldValue.content ||
        newValue.messageType !== oldValue.messageType ||
        JSON.stringify(newValue.metadata) !== JSON.stringify(oldValue.metadata)) {
      processMessageContent()
    }
  },
  { immediate: true, deep: true }
)

// 組件清理
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  contentCache.clear()
})

// Methods
const formatTime = (date: Date | string | number) => {
  let messageDate: Date

  if (typeof date === 'number') {
    messageDate = new Date(date)
  } else if (typeof date === 'string') {
    messageDate = new Date(date)
  } else {
    messageDate = date
  }

  // 智能时间戳显示：今天显示时分，历史显示完整日期时间
  const now = new Date()
  const isToday = messageDate.toDateString() === now.toDateString()

  if (isToday) {
    // 今天的消息：仅显示时分 (例如: "14:30")
    return messageDate.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false  // 使用24小时制
    })
  } else {
    // 历史消息：显示完整日期和时间 (例如: "2025/01/27 15:30")
    return messageDate.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false  // 使用24小时制
    })
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {return '0 B'}
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`
}

const getFileExtension = (filename: string): string => {
  const parts = filename.split('.')
  if (parts.length <= 1) {return ''}
  const ext = parts.pop()?.toUpperCase()
  return ext || ''
}

const getFileTypeClass = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
  const docExts = ['doc', 'docx', 'pdf', 'txt', 'rtf']
  const codeExts = ['js', 'ts', 'html', 'css', 'json', 'xml']
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']

  // Return specific extension names for test compatibility
  if (ext === 'pdf') {return 'pdf'}
  if (ext === 'jpg' || ext === 'jpeg') {return 'image'}
  if (ext === 'txt') {return 'text'}
  
  if (imageExts.includes(ext || '')) {return 'file-type-image'}
  if (docExts.includes(ext || '')) {return 'file-type-document'}
  if (codeExts.includes(ext || '')) {return 'file-type-code'}
  if (archiveExts.includes(ext || '')) {return 'file-type-archive'}
  
  return 'file-type-document'
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
  
  if (imageExts.includes(ext || '')) {return ImageIcon}
  return FileIcon
}

// Image preview methods
const openImagePreview = () => {
  if (actualMessageType.value === 'image') {
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

// Image load handlers
const onImageLoad = () => {
  imageLoaded.value = true
  imageError.value = false
}

const onImageError = () => {
  imageLoaded.value = false
  imageError.value = true
  emit('image-error', props.message)
}

// 貼圖載入開始
const onStickerLoadStart = () => {
  stickerLoading.value = true
  console.log('🔄 [Sticker Debug] Starting to load sticker...')
}

// 貼圖錯誤處理 - 智能 CDN 回退
const onStickerError = () => {
  const currentUrl = stickerUrls.value[currentStickerUrlIndex.value]
  console.warn('❌ [Sticker Debug] Failed to load sticker from URL:', currentUrl)
  console.warn('❌ [Sticker Debug] Sticker ID:', stickerMetadata.value?.stickerId)

  // 嘗試下一個 CDN 源
  if (currentStickerUrlIndex.value < stickerUrls.value.length - 1) {
    currentStickerUrlIndex.value++
    console.log('🔄 [Sticker Debug] Trying fallback URL index:', currentStickerUrlIndex.value)
    console.log('🔄 [Sticker Debug] Next URL:', stickerUrls.value[currentStickerUrlIndex.value])

    // 重新觸發載入（透過重設 key 強制重新渲染）
    nextTick(() => {
      stickerLoading.value = true
    })
  } else {
    // 所有 URL 都失敗了
    console.error('💥 [Sticker Debug] All CDN sources failed for sticker:', stickerMetadata.value?.stickerId)
    stickerLoadError.value = true
    stickerLoading.value = false
  }
}

// 貼圖載入成功
const onStickerLoad = () => {
  console.log('✅ [Sticker Debug] Sticker loaded successfully from URL index:', currentStickerUrlIndex.value)
  console.log('✅ [Sticker Debug] Loaded URL:', stickerImageUrl.value)
  console.log('✅ [Sticker Debug] Sticker ID:', stickerMetadata.value?.stickerId)

  stickerLoadError.value = false
  stickerLoading.value = false
}

// 重設貼圖狀態（當 sticker metadata 改變時）
watch(() => stickerMetadata.value, () => {
  currentStickerUrlIndex.value = 0
  stickerLoadError.value = false
  stickerLoading.value = false
}, { deep: true })

// File download
const downloadFile = () => {
  if (attachmentUrl.value) {
    const link = document.createElement('a')
    link.href = attachmentUrl.value
    link.download = attachmentName.value || 'download'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// 🔧 FIX: Download attachment from file_attachments array
const downloadAttachment = (attachment: { fileUrl?: string; filename?: string }) => {
  if (attachment.fileUrl) {
    const link = document.createElement('a')
    link.href = attachment.fileUrl
    link.download = attachment.filename || 'download'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Message Actions
const handleRightClick = (event: MouseEvent) => {
  event.preventDefault()
  showActionsMenu.value = !showActionsMenu.value
  showActions.value = true
}

const toggleActionsMenu = () => {
  showActionsMenu.value = !showActionsMenu.value
}

const copyMessage = async () => {
  try {
    await navigator.clipboard.writeText(props.message.content)
    emit('copy', props.message)
    showActionsMenu.value = false
  } catch (error) {
    console.error('Failed to copy message:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = props.message.content
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      emit('copy', props.message)
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError)
    }
    document.body.removeChild(textArea)
    showActionsMenu.value = false
  }
}

const replyToMessage = () => {
  emit('reply', props.message)
  showActionsMenu.value = false
}

const forwardMessage = () => {
  emit('forward', props.message)
  showActionsMenu.value = false
}

const recallMessage = () => {
  emit('recall', props.message)
  showActionsMenu.value = false
}

const selectMessage = () => {
  emit('select', props.message)
  showActionsMenu.value = false
}

// ⚡ Retry failed message
const handleRetry = () => {
  console.log('🔄 [MessageBubble] Retry button clicked for message:', props.message.id)
  emit('retry', props.message.id)
}

// 🔧 Handle attachment preview (for image files)
const handleAttachmentPreview = (attachment: FileAttachment) => {
  console.log('🖼️ [MessageBubble] Attachment preview requested:', attachment)
  // For image attachments, we could open a preview modal
  // For now, just log and potentially emit an event
  emit('preview', props.message)
}

// 🆕 判斷附件是否處於 pending 狀態（正在傳送中）
const isAttachmentPending = (attachment: { id?: string; isPending?: boolean }): boolean => {
  // 如果附件明確標記為 pending
  if (attachment.isPending) {return true}

  // 如果附件 ID 以 'pending-' 開頭
  if (attachment.id?.startsWith('pending-')) {return true}

  // 如果消息狀態為 sending 或 pending
  if (messageStatus.value === 'sending' || messageStatus.value === 'pending') {return true}

  return false
}

// 🆕 獲取附件狀態對應的 CSS 類名
const getAttachmentStatusClass = (attachment: { id?: string; isPending?: boolean }): string => {
  if (isAttachmentPending(attachment)) {
    return 'status-pending'
  }
  if (messageStatus.value === 'failed') {
    return 'status-failed'
  }
  return 'status-success'
}
</script>

<style scoped>
.message-bubble {
  display: flex;
  margin-bottom: var(--space-3);
  max-width: 70%;
}

.message-incoming {
  justify-content: flex-start;
  align-self: flex-start;
}

.message-outgoing {
  justify-content: flex-end;
  align-self: flex-end;
  margin-left: auto;
}

.message-content {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-4);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  position: relative;
}

.message-outgoing .message-content {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-600);
}

.message-text {
  font-size: 0.875rem;
  line-height: 1.5;
  word-wrap: break-word;
  margin-bottom: var(--space-2);
}

.message-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
}

.message-outgoing .message-time {
  color: rgba(255, 255, 255, 0.8);
}

.message-incoming .message-time {
  color: var(--gray-500);
}

.message-status {
  display: flex;
  align-items: center;
}

.message-status svg {
  width: 14px;
  height: 14px;
}

.status-delivered {
  color: rgba(255, 255, 255, 0.8);
}

.status-failed {
  color: var(--red-400);
}

/* ⚡ Optimistic UI Status Styles */
.status-sending {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

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

.sender-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: var(--space-3);
  font-size: 0.75rem;
  color: var(--gray-500);
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
  font-weight: 600;
  font-size: 0.625rem;
}

.sender-name {
  font-weight: 500;
}

/* Message bubble tails */
.message-content::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.message-incoming .message-content::before {
  left: -8px;
  top: 12px;
  border-width: 8px 8px 8px 0;
  border-color: transparent white transparent transparent;
}

.message-outgoing .message-content::before {
  right: -8px;
  top: 12px;
  border-width: 8px 0 8px 8px;
  border-color: transparent transparent transparent var(--primary-500);
}

.message-failed .message-content {
  background: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-800);
}

.message-failed .message-content::before {
  border-left-color: var(--red-50);
}

/* Media message styles */
.message-media {
  max-width: 300px;
}

.image-container {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.image-container:hover {
  transform: scale(1.02);
  box-shadow: var(--shadow-lg);
}

.message-image-content {
  width: 100%;
  height: auto;
  max-height: 300px;
  object-fit: cover;
  border-radius: var(--radius-lg);
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.image-container:hover .image-overlay {
  opacity: 1;
}

.image-actions {
  display: flex;
  gap: var(--space-2);
}

.image-action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  color: var(--gray-700);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.image-action-btn:hover {
  background: white;
  transform: scale(1.1);
}

/* File message styles */
.message-file-content {
  min-width: 280px;
  max-width: 400px;
}

.file-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
  transition: all var(--transition-fast);
}

.file-container:hover {
  background: var(--gray-100);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.file-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  color: white;
  flex-shrink: 0;
}

.file-type-image { background: var(--green-500); }
.file-type-document { background: var(--blue-500); }
.file-type-code { background: var(--purple-500); }
.file-type-archive { background: var(--orange-500); }
.file-type-default { background: var(--gray-500); }

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 600;
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
  color: var(--gray-600);
}

.file-type {
  background: var(--primary-100);
  color: var(--primary-700);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.file-progress {
  margin-top: var(--space-2);
}

.progress-bar {
  width: 100%;
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
  font-size: 0.625rem;
  color: var(--gray-500);
  margin-left: var(--space-1);
}

.file-actions {
  flex-shrink: 0;
}

.file-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: white;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.file-action-btn.primary {
  background: var(--primary-500);
  color: white;
  border-color: var(--primary-600);
}

.file-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.file-action-btn.primary:hover {
  background: var(--primary-600);
}

.media-caption {
  padding: var(--space-2) var(--space-3);
  font-size: 0.875rem;
  color: var(--gray-700);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  margin-top: var(--space-1);
}

/* 🔧 FIX: Attachments Container - Mixed images and files */
.message-attachments-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 🔧 FIX: Image attachments - Simple display without card effect */
.message-attachments-container .attachment-image {
  margin: 0;
}

/* 🔧 FIX: Multiple File Attachments Styles - Flex Message Card Style (non-image files only) */
.message-file-attachments {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  /* Remove background/padding from message-content to show card style */
  margin: calc(var(--space-3) * -1) calc(var(--space-4) * -1);
  margin-bottom: var(--space-2);
}

/* When inside attachments container, reset the negative margin */
.message-attachments-container .message-file-attachments {
  margin: 0;
}

.message-file-attachments :deep(.file-attachment-card) {
  margin: 0;
  box-shadow: none;
  border-radius: var(--radius-lg);
}

/* For outgoing messages, adjust card style */
.message-outgoing .message-file-attachments :deep(.file-attachment-card) {
  /* Cards look better with their own background in outgoing bubbles */
}

/* Remove the blue background for file attachment messages */
.message-outgoing .message-content:has(.message-file-attachments),
.message-outgoing .message-content:has(.message-attachments-container) {
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}

.message-outgoing .message-content:has(.message-file-attachments)::before,
.message-outgoing .message-content:has(.message-attachments-container)::before {
  display: none;
}

/* For incoming messages with file attachments */
.message-incoming .message-content:has(.message-file-attachments),
.message-incoming .message-content:has(.message-attachments-container) {
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}

.message-incoming .message-content:has(.message-file-attachments)::before,
.message-incoming .message-content:has(.message-attachments-container)::before {
  display: none;
}

/* Make download links look like buttons */
.file-action-btn[href] {
  text-decoration: none;
  display: inline-flex;
}

.file-action-btn[href]:visited {
  color: inherit;
}

/* Enhanced Image Preview Modal */
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
}

.zoom-level {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
  min-width: 60px;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 768px) {
  .message-bubble {
    max-width: 85%;
  }
  
  .message-content {
    padding: var(--space-2) var(--space-3);
  }
  
  .message-text {
    font-size: 0.8125rem;
  }

  .message-media {
    max-width: 250px;
  }

  .message-file-content {
    min-width: 200px;
    max-width: 280px;
  }

  .file-container {
    padding: var(--space-3);
  }

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

/* Sticker message styles */
.message-sticker {
  max-width: 200px;
  text-align: center;
  margin-bottom: var(--space-2);
}

/* Comprehensive sticker renderer content */
.sticker-rendered-content {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: var(--space-2);
}

/* Sticker container styles from comprehensive renderer */
.sticker-rendered-content :deep(.sticker-container) {
  display: inline-block;
  margin: var(--space-1);
  text-align: center;
}

.sticker-rendered-content :deep(.sticker-image) {
  border-radius: var(--radius-lg);
  transition: transform var(--transition-fast);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.sticker-rendered-content :deep(.sticker-image[style*="opacity: 1"]) {
  opacity: 1;
}

.sticker-rendered-content :deep(.sticker-image:hover) {
  transform: scale(1.05);
}

/* Fallback sticker display from comprehensive renderer */
.sticker-rendered-content :deep(.sticker-fallback) {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3);
  background: var(--gray-100);
  border: 1px dashed var(--gray-300);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  color: var(--gray-600);
}

.message-outgoing .sticker-rendered-content :deep(.sticker-fallback) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.9);
}

.sticker-image-container {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.sticker-image {
  width: 100%;
  max-width: 120px;
  height: auto;
  border-radius: var(--radius-lg);
  transition: transform var(--transition-fast);
  cursor: pointer;
}

.sticker-image:hover {
  transform: scale(1.05);
}

.sticker-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3);
  background: var(--gray-100);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--gray-300);
  margin-bottom: var(--space-2);
}

.message-outgoing .sticker-placeholder {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.sticker-icon {
  font-size: 2rem;
  margin-bottom: var(--space-1);
}

.sticker-text {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.message-outgoing .sticker-text {
  color: rgba(255, 255, 255, 0.9);
}

.sticker-info {
  font-size: 0.65rem;
  color: var(--gray-500);
  margin-top: var(--space-1);
  opacity: 0.8;
  word-break: break-all;
}

.message-outgoing .sticker-info {
  color: rgba(255, 255, 255, 0.7);
}

/* Enhanced Sticker Loading States */
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
  animation: spin 1s linear infinite;
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

@keyframes spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

/* Enhanced Sticker Placeholder */
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

.sticker-error-hint {
  font-size: 0.7rem;
  color: var(--gray-400);
  font-style: italic;
}

.message-outgoing .sticker-placeholder.enhanced {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.message-outgoing .sticker-error-hint {
  color: rgba(255, 255, 255, 0.6);
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-8px); }
  60% { transform: translateY(-4px); }
}

/* CDN Fallback Indicator */
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

/* Enhanced Sticker Info */
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

/* Responsive Adjustments */
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

/* Message Actions Styles */
.message-actions {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: all var(--transition-fast);
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-1);
}

.message-actions.actions-outgoing {
  right: -80px;
}

.message-actions:not(.actions-outgoing) {
  left: -80px;
}

.message-bubble:hover .message-actions,
.message-actions:hover {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: var(--gray-600);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  position: relative;
}

.action-btn:hover {
  background: var(--gray-100);
  color: var(--gray-800);
  transform: scale(1.1);
}

.action-btn svg {
  width: 14px;
  height: 14px;
}

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

/* Mobile optimizations for actions */
@media (max-width: 768px) {
  .message-actions {
    position: static;
    transform: none;
    margin-top: var(--space-2);
    align-self: flex-end;
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(2px);
  }

  .message-actions.actions-outgoing,
  .message-actions:not(.actions-outgoing) {
    right: auto;
    left: auto;
  }

  .action-btn {
    width: 32px;
    height: 32px;
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .dropdown-item {
    padding: var(--space-3);
    font-size: 1rem;
  }
}

/* Touch devices */
@media (pointer: coarse) {
  .message-actions {
    opacity: 1;
  }

  .action-btn {
    min-width: 32px;
    min-height: 32px;
  }
}

/* Emoji and Sticker Styles */
.message-text :deep(.emoji) {
  font-size: 1.2em;
  line-height: 1;
  vertical-align: middle;
}

.message-text :deep(.emoji-image) {
  width: 1.2em;
  height: 1.2em;
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  margin: 0 1px;
}

.message-text :deep(.line-sticker) {
  max-width: 100px;
  max-height: 100px;
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  margin: 2px;
  border-radius: var(--radius-md);
}

.message-text :deep(.custom-emoji) {
  width: 1.2em;
  height: 1.2em;
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  margin: 0 1px;
}

/* 确保emoji在不同背景下的可读性 */
.message-outgoing .message-text :deep(.emoji-image),
.message-outgoing .message-text :deep(.custom-emoji) {
  filter: brightness(1.1);
}

/* 贴图悬停效果 */
.message-text :deep(.line-sticker:hover) {
  transform: scale(1.05);
  transition: transform var(--transition-fast);
  cursor: pointer;
}

/* 加载失败时的样式 */
.message-text :deep(.emoji-fallback) {
  background-color: var(--gray-100);
  color: var(--gray-600);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  font-size: 0.8em;
  font-family: monospace;
}

/* 🎨 附件發送狀態指示器 - Neon Alert 設計風格 */
.attachment-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;  /* 🔧 FIX: 整個容器內容靠右 */
  gap: var(--space-1);
}

/* 讓 FileAttachmentCard 保持全寬，只有狀態指示器靠右 */
.attachment-wrapper > :first-child {
  width: 100%;
  align-self: stretch;  /* 🔧 FIX: FileAttachmentCard 保持全寬 */
}

/* 🔧 FIX: 圖片附件容器也需要設置 flex 以便狀態指示器靠右 */
.message-media.attachment-image {
  display: flex;
  flex-direction: column;
  align-items: flex-end;  /* 🔧 FIX: 狀態指示器靠右 */
}

/* 🔧 FIX: 圖片容器保持原有寬度 */
.message-media.attachment-image .image-container {
  align-self: flex-start;  /* 圖片本身靠左 */
}

.attachment-status-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-radius: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  margin-left: auto;  /* 🔧 FIX: 確保靠右 */
  align-self: flex-end;  /* 🔧 FIX: 在 flex 容器中靠右 */
}

/* 圖片附件的狀態指示器 */
.attachment-status-indicator.image-status {
  margin-top: 6px;
  backdrop-filter: blur(8px);
  align-self: flex-end;  /* 🔧 FIX: 圖片附件狀態也靠右 */
}

/* ═══════════════════════════════════════════════════════════════
   🟡 傳送中狀態 - 活力琥珀色 + 呼吸光暈
   ═══════════════════════════════════════════════════════════════ */
.attachment-status-indicator.status-pending {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #1a1a1a;
  box-shadow:
    0 2px 8px rgba(251, 191, 36, 0.4),
    0 0 20px rgba(251, 191, 36, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  animation: pending-pulse 2s ease-in-out infinite;
}

.attachment-status-indicator.status-pending::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: shimmer 2s infinite;
}

.attachment-status-indicator.status-pending .status-text {
  color: #1a1a1a;
  font-weight: 700;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
}

@keyframes pending-pulse {
  0%, 100% {
    box-shadow:
      0 2px 8px rgba(251, 191, 36, 0.4),
      0 0 20px rgba(251, 191, 36, 0.2);
    transform: scale(1);
  }
  50% {
    box-shadow:
      0 4px 16px rgba(251, 191, 36, 0.6),
      0 0 30px rgba(251, 191, 36, 0.4);
    transform: scale(1.02);
  }
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

/* ═══════════════════════════════════════════════════════════════
   🟢 發送成功狀態 - 電光青綠 + 閃爍確認
   ═══════════════════════════════════════════════════════════════ */
.attachment-status-indicator.status-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow:
    0 2px 8px rgba(16, 185, 129, 0.4),
    0 0 20px rgba(16, 185, 129, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  animation: success-glow 0.6s ease-out;
}

.attachment-status-indicator.status-success .status-text {
  color: white;
  font-weight: 600;
}

.attachment-status-indicator.status-success .status-icon.success {
  color: white;
  font-weight: bold;
  animation: checkmark-pop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes success-glow {
  0% {
    transform: scale(0.9);
    box-shadow: 0 0 0 rgba(16, 185, 129, 0);
  }
  50% {
    box-shadow:
      0 0 30px rgba(16, 185, 129, 0.6),
      0 0 60px rgba(16, 185, 129, 0.3);
  }
  100% {
    transform: scale(1);
    box-shadow:
      0 2px 8px rgba(16, 185, 129, 0.4),
      0 0 20px rgba(16, 185, 129, 0.15);
  }
}

@keyframes checkmark-pop {
  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
  50% { transform: scale(1.3) rotate(10deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

/* ═══════════════════════════════════════════════════════════════
   🔴 發送失敗狀態 - 熾熱珊瑚紅 + 脈動警示光暈
   ═══════════════════════════════════════════════════════════════ */
.attachment-status-indicator.status-failed {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 50%, #dc2626 100%);
  color: white;
  box-shadow:
    0 4px 15px rgba(239, 68, 68, 0.5),
    0 0 30px rgba(255, 107, 107, 0.3),
    0 0 60px rgba(239, 68, 68, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  animation: failed-alert 1.5s ease-in-out infinite;
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.attachment-status-indicator.status-failed::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #ff6b6b, #fbbf24, #ff6b6b, #dc2626);
  background-size: 400% 400%;
  border-radius: 22px;
  z-index: -1;
  animation: gradient-border 3s ease infinite;
  opacity: 0.7;
}

.attachment-status-indicator.status-failed::after {
  content: '點擊重試';
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  font-size: 0.65rem;
  color: #dc2626;
  background: rgba(255, 255, 255, 0.95);
  padding: 3px 8px;
  border-radius: 10px;
  white-space: nowrap;
  opacity: 0;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-weight: 600;
}

.attachment-status-indicator.status-failed:hover::after {
  opacity: 1;
  transform: translateX(-50%) scale(1);
  bottom: -24px;
}

.attachment-status-indicator.status-failed:hover {
  transform: scale(1.05);
  box-shadow:
    0 6px 25px rgba(239, 68, 68, 0.6),
    0 0 40px rgba(255, 107, 107, 0.4),
    0 0 80px rgba(239, 68, 68, 0.2);
}

.attachment-status-indicator.status-failed:active {
  transform: scale(0.98);
}

.attachment-status-indicator.status-failed .status-text.failed {
  color: white;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.attachment-status-indicator.status-failed .status-icon.failed {
  color: white;
  font-weight: bold;
  font-size: 1rem;
  animation: shake-icon 0.5s ease-in-out infinite;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

@keyframes failed-alert {
  0%, 100% {
    box-shadow:
      0 4px 15px rgba(239, 68, 68, 0.5),
      0 0 30px rgba(255, 107, 107, 0.3),
      0 0 60px rgba(239, 68, 68, 0.15);
  }
  50% {
    box-shadow:
      0 6px 25px rgba(239, 68, 68, 0.7),
      0 0 50px rgba(255, 107, 107, 0.5),
      0 0 100px rgba(239, 68, 68, 0.25);
  }
}

@keyframes gradient-border {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes shake-icon {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px) rotate(-5deg); }
  75% { transform: translateX(2px) rotate(5deg); }
}

/* 狀態指示器的 spinner 動畫 */
.status-spinner {
  width: 14px;
  height: 14px;
  border: 2.5px solid rgba(26, 26, 26, 0.2);
  border-top-color: #1a1a1a;
  border-radius: 50%;
  animation: attachment-spin 0.7s linear infinite;
}

@keyframes attachment-spin {
  to { transform: rotate(360deg); }
}

/* 狀態圖標 */
.status-icon {
  font-size: 0.9rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-text {
  font-size: 0.72rem;
  line-height: 1;
}

/* ═══════════════════════════════════════════════════════════════
   Outgoing 消息的狀態指示器 (深色背景適配)
   ═══════════════════════════════════════════════════════════════ */
.message-outgoing .attachment-status-indicator.status-success {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  box-shadow:
    0 2px 12px rgba(52, 211, 153, 0.5),
    0 0 25px rgba(16, 185, 129, 0.3);
}

.message-outgoing .attachment-status-indicator.status-pending {
  background: linear-gradient(135deg, #fcd34d 0%, #fbbf24 100%);
  box-shadow:
    0 2px 12px rgba(252, 211, 77, 0.5),
    0 0 25px rgba(251, 191, 36, 0.3);
}

.message-outgoing .attachment-status-indicator.status-pending .status-spinner {
  border-color: rgba(26, 26, 26, 0.15);
  border-top-color: #1a1a1a;
}

.message-outgoing .attachment-status-indicator.status-failed {
  background: linear-gradient(135deg, #ff7875 0%, #ff4d4f 50%, #f5222d 100%);
  box-shadow:
    0 4px 20px rgba(255, 77, 79, 0.6),
    0 0 40px rgba(255, 120, 117, 0.4),
    0 0 80px rgba(245, 34, 45, 0.2);
}

/* ═══════════════════════════════════════════════════════════════
   響應式調整
   ═══════════════════════════════════════════════════════════════ */
@media (max-width: 480px) {
  .attachment-status-indicator {
    font-size: 0.68rem;
    padding: 5px 10px;
    gap: 4px;
  }

  .status-spinner {
    width: 12px;
    height: 12px;
    border-width: 2px;
  }

  .status-icon {
    font-size: 0.8rem;
  }

  .attachment-status-indicator.status-failed::after {
    display: none; /* 移動端隱藏提示 */
  }
}
</style>