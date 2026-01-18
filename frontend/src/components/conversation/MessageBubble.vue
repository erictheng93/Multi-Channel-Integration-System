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

      <!-- 🔧 FIX: Attachments Container - Images, Videos, and Documents -->
      <div
        v-else-if="imageAttachments.length > 0 || videoAttachments.length > 0 || documentAttachments.length > 0"
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

        <!-- 影片附件：直接內嵌播放 -->
        <div
          v-for="attachment in videoAttachments"
          :key="attachment.id"
          class="message-media attachment-video"
        >
          <div class="video-container">
            <video
              :ref="(el) => setVideoRef(el as HTMLVideoElement, attachment.id)"
              :src="attachment.fileUrl"
              class="video-player"
              preload="metadata"
              playsinline
              :muted="videoMuted[attachment.id] !== false"
              @play="onVideoPlay(attachment.id)"
              @pause="onVideoPause(attachment.id)"
              @ended="onVideoEnded(attachment.id)"
            />
            <!-- 控制層 -->
            <div
              class="video-controls-overlay"
              :class="{ 'is-playing': videoPlaying[attachment.id] }"
            >
              <button
                class="video-play-btn-center"
                @click="toggleVideoPlay(attachment.id)"
              >
                <PlayIcon
                  v-if="!videoPlaying[attachment.id]"
                  :size="32"
                />
                <PauseIcon
                  v-else
                  :size="32"
                />
              </button>
              <div class="video-controls-bar">
                <button
                  class="video-control-btn"
                  @click="toggleVideoPlay(attachment.id)"
                >
                  <PlayIcon
                    v-if="!videoPlaying[attachment.id]"
                    :size="16"
                  />
                  <PauseIcon
                    v-else
                    :size="16"
                  />
                </button>
                <button
                  class="video-control-btn"
                  @click="toggleVideoMute(attachment.id)"
                >
                  <VolumeMuteIcon
                    v-if="videoMuted[attachment.id] !== false"
                    :size="16"
                  />
                  <VolumeIcon
                    v-else
                    :size="16"
                  />
                </button>
                <button
                  class="video-control-btn"
                  @click="downloadAttachment(attachment)"
                >
                  <DownloadIcon :size="16" />
                </button>
                <button
                  class="video-control-btn expand-btn"
                  title="放大播放"
                  @click.stop="openVideoPreview(attachment)"
                >
                  <MaximizeIcon :size="16" />
                </button>
              </div>
            </div>
          </div>
          <!-- 影片附件狀態指示器 -->
          <div
            class="attachment-status-indicator video-status"
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

        <!-- 文件附件：使用 Flex Message Card 顯示 -->
        <div
          v-if="documentAttachments.length > 0"
          class="message-file-attachments"
        >
          <div
            v-for="attachment in documentAttachments"
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
              :compact="documentAttachments.length > 1"
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
            v-if="messageStatus === 'sending' || messageStatus === MESSAGE_STATUS.PENDING"
            class="status-sending"
            title="发送中..."
          >
            <div class="spinner-small" />
          </div>

          <!-- ✅ Sent/Delivered状态 -->
          <CheckIcon
            v-else-if="messageStatus === MESSAGE_STATUS.SENT || messageStatus === MESSAGE_STATUS.DELIVERED || delivered"
            class="status-delivered"
            title="已送达"
          />

          <!-- ❌ Failed状态 with重试按钮 -->
          <div
            v-else-if="messageStatus === MESSAGE_STATUS.FAILED"
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

    <!-- Enhanced Video Preview Modal -->
    <Teleport
      v-if="showVideoPreview && previewVideoAttachment"
      to="body"
    >
      <div
        class="video-preview-overlay"
        @click="closeVideoPreview"
      >
        <div
          class="video-preview-modal"
          @click.stop
        >
          <div class="video-preview-header">
            <div class="video-preview-title">
              <h3>{{ previewVideoAttachment.filename }}</h3>
              <span class="video-preview-meta">
                {{ formatFileSize(previewVideoAttachment.fileSize || 0) }}
                <span v-if="previewVideoDuration > 0">
                  • {{ formatVideoTime(previewVideoDuration) }}
                </span>
              </span>
            </div>
            <div class="video-preview-actions">
              <button
                class="video-preview-btn"
                title="下載"
                @click="downloadPreviewVideo"
              >
                <DownloadIcon />
              </button>
              <button
                class="video-preview-btn"
                title="全螢幕"
                @click="requestFullscreen"
              >
                <MaximizeIcon />
              </button>
              <button
                class="video-preview-btn close"
                title="關閉"
                @click="closeVideoPreview"
              >
                <XIcon />
              </button>
            </div>
          </div>
          <div class="video-preview-content">
            <div class="video-preview-player-wrapper">
              <video
                :ref="(el) => setPreviewVideoRef(el as HTMLVideoElement)"
                :src="previewVideoAttachment.fileUrl"
                class="video-preview-player"
                preload="metadata"
                playsinline
                :muted="previewVideoMuted"
                @play="onPreviewVideoPlay"
                @pause="onPreviewVideoPause"
                @timeupdate="onPreviewVideoTimeUpdate"
                @loadedmetadata="onPreviewVideoLoadedMetadata"
                @ended="onPreviewVideoEnded"
                @click="togglePreviewVideoPlay"
              />
              <!-- 中央播放按鈕 -->
              <div
                v-if="!previewVideoPlaying"
                class="video-preview-play-overlay"
                @click="togglePreviewVideoPlay"
              >
                <button class="video-preview-play-btn-center">
                  <PlayIcon :size="48" />
                </button>
              </div>
            </div>
          </div>
          <div class="video-preview-controls">
            <!-- 進度條 -->
            <div class="video-progress-container">
              <input
                type="range"
                class="video-progress-bar"
                :value="previewVideoCurrentTime"
                :max="previewVideoDuration || 100"
                step="0.1"
                @input="seekPreviewVideo"
              >
            </div>
            <!-- 控制按鈕列 -->
            <div class="video-controls-row">
              <div class="video-controls-left">
                <!-- 播放/暫停 -->
                <button
                  class="video-ctrl-btn"
                  @click="togglePreviewVideoPlay"
                >
                  <PlayIcon
                    v-if="!previewVideoPlaying"
                    :size="20"
                  />
                  <PauseIcon
                    v-else
                    :size="20"
                  />
                </button>
                <!-- 時間顯示 -->
                <span class="video-time-display">
                  {{ formatVideoTime(previewVideoCurrentTime) }} / {{ formatVideoTime(previewVideoDuration) }}
                </span>
              </div>
              <div class="video-controls-right">
                <!-- 音量控制 -->
                <div class="video-volume-control">
                  <button
                    class="video-ctrl-btn"
                    @click="togglePreviewVideoMute"
                  >
                    <VolumeMuteIcon
                      v-if="previewVideoMuted"
                      :size="20"
                    />
                    <VolumeIcon
                      v-else
                      :size="20"
                    />
                  </button>
                  <input
                    type="range"
                    class="video-volume-slider"
                    :value="previewVideoMuted ? 0 : previewVideoVolume"
                    min="0"
                    max="1"
                    step="0.1"
                    @input="changePreviewVideoVolume"
                  >
                </div>
                <!-- 播放速度 -->
                <div class="video-playback-rate">
                  <button
                    class="video-ctrl-btn playback-rate-btn"
                    @click="togglePlaybackRateMenu"
                  >
                    {{ previewVideoPlaybackRate }}x
                  </button>
                  <div
                    v-if="showPlaybackRateMenu"
                    class="playback-rate-menu"
                  >
                    <button
                      v-for="rate in [0.5, 0.75, 1, 1.25, 1.5, 2]"
                      :key="rate"
                      class="playback-rate-option"
                      :class="{ active: previewVideoPlaybackRate === rate }"
                      @click="setPreviewVideoPlaybackRate(rate)"
                    >
                      {{ rate }}x
                    </button>
                  </div>
                </div>
                <!-- 全螢幕 -->
                <button
                  class="video-ctrl-btn"
                  title="全螢幕"
                  @click="requestFullscreen"
                >
                  <MaximizeIcon :size="20" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Message } from '@/types'
import SafeHtmlRenderer from '@/components/ui/SafeHtmlRenderer.vue'
import FileAttachmentCard from '@/components/file/FileAttachmentCard.vue'
import { MESSAGE_STATUS } from '@/constants/message-status'

// Import message utilities and composables
import {
  formatFileSize,
  getFileExtension,
  getFileTypeClass
} from '@/utils/message'
import { useMessageTime, useMessageAttachment, useMessageActions, useMessageSticker, useMessageContent, type FileAttachment } from '@/composables/message'

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
  TrashIcon,
  PlayIcon,
  PauseIcon,
  VolumeIcon,
  VolumeMuteIcon,
  MaximizeIcon
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

// Use message composables
const { formatTime } = useMessageTime()

// Create reactive props for useMessageAttachment
const attachmentProps = computed(() => ({
  message: props.message,
  attachmentUrl: props.attachmentUrl,
  attachmentName: props.attachmentName,
  attachmentSize: props.attachmentSize
}))

const {
  fileAttachments, // Used internally by imageAttachments, videoAttachments, and documentAttachments
  imageAttachments,
  videoAttachments,
  documentAttachments,
  hasMultipleAttachments,
  isFileOnlyContent,
  messageStatus,
  downloadFile,
  downloadAttachment,
  handleAttachmentPreview: handleAttachmentPreviewBase,
  isAttachmentPending,
  getAttachmentStatusClass
} = useMessageAttachment(attachmentProps)

// Mark fileAttachments as used (it's internally used by imageAttachments, videoAttachments, and documentAttachments)
void fileAttachments

// Wrap handleAttachmentPreview to emit the preview event
const handleAttachmentPreview = (attachment: FileAttachment) => {
  handleAttachmentPreviewBase(attachment, (message) => emit('preview', message))
}

// Create reactive props for useMessageActions
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

// Create reactive props for useMessageSticker
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

// Create reactive props for useMessageContent
const contentProps = computed(() => ({
  message: props.message
}))

const {
  processedMessageContent,
  actualMessageType
} = useMessageContent(contentProps)

// State
const showImagePreview = ref(false)
const zoomLevel = ref(1)
const imageLoaded = ref(false)
const imageError = ref(false)

// Video player state
/* eslint-disable no-undef */
const videoPlaying = ref<Record<string, boolean>>({})
const videoMuted = ref<Record<string, boolean>>({})
const videoRefs = ref<Record<string, HTMLVideoElement | null>>({})

// Video control methods
const setVideoRef = (el: HTMLVideoElement | null, attachmentId: string) => {
  videoRefs.value[attachmentId] = el
}

const toggleVideoPlay = (attachmentId: string) => {
  const video = videoRefs.value[attachmentId]
  if (!video) {
    return
  }

  if (video.paused) {
    video.play()
    videoPlaying.value[attachmentId] = true
  } else {
    video.pause()
    videoPlaying.value[attachmentId] = false
  }
}

const toggleVideoMute = (attachmentId: string) => {
  const video = videoRefs.value[attachmentId]
  if (!video) {
    return
  }

  video.muted = !video.muted
  videoMuted.value[attachmentId] = video.muted
}

const onVideoPlay = (attachmentId: string) => {
  videoPlaying.value[attachmentId] = true
}

const onVideoPause = (attachmentId: string) => {
  videoPlaying.value[attachmentId] = false
}

const onVideoEnded = (attachmentId: string) => {
  videoPlaying.value[attachmentId] = false
}

// Video preview modal state
const showVideoPreview = ref(false)
const previewVideoAttachment = ref<FileAttachment | null>(null)
const previewVideoRef = ref<HTMLVideoElement | null>(null)
const previewVideoPlaying = ref(false)
const previewVideoMuted = ref(true)
const previewVideoCurrentTime = ref(0)
const previewVideoDuration = ref(0)
const previewVideoVolume = ref(1)
const previewVideoPlaybackRate = ref(1)
const showPlaybackRateMenu = ref(false)

// Video preview modal methods
const openVideoPreview = (attachment: FileAttachment) => {
  previewVideoAttachment.value = attachment
  showVideoPreview.value = true
  previewVideoPlaying.value = false
  previewVideoMuted.value = true
  previewVideoCurrentTime.value = 0
  previewVideoDuration.value = 0
  previewVideoPlaybackRate.value = 1
  showPlaybackRateMenu.value = false
}

const closeVideoPreview = () => {
  if (previewVideoRef.value) {
    previewVideoRef.value.pause()
  }
  showVideoPreview.value = false
  previewVideoAttachment.value = null
  previewVideoPlaying.value = false
}

const setPreviewVideoRef = (el: HTMLVideoElement | null) => {
  previewVideoRef.value = el
}

const togglePreviewVideoPlay = () => {
  if (!previewVideoRef.value) {
    return
  }

  if (previewVideoRef.value.paused) {
    previewVideoRef.value.play()
  } else {
    previewVideoRef.value.pause()
  }
}

const togglePreviewVideoMute = () => {
  if (!previewVideoRef.value) {
    return
  }

  previewVideoRef.value.muted = !previewVideoRef.value.muted
  previewVideoMuted.value = previewVideoRef.value.muted
}

const onPreviewVideoPlay = () => {
  previewVideoPlaying.value = true
}

const onPreviewVideoPause = () => {
  previewVideoPlaying.value = false
}

const onPreviewVideoTimeUpdate = () => {
  if (previewVideoRef.value) {
    previewVideoCurrentTime.value = previewVideoRef.value.currentTime
  }
}

const onPreviewVideoLoadedMetadata = () => {
  if (previewVideoRef.value) {
    previewVideoDuration.value = previewVideoRef.value.duration
  }
}

const onPreviewVideoEnded = () => {
  previewVideoPlaying.value = false
}

const seekPreviewVideo = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (previewVideoRef.value) {
    previewVideoRef.value.currentTime = Number(target.value)
  }
}

const changePreviewVideoVolume = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (previewVideoRef.value) {
    previewVideoRef.value.volume = Number(target.value)
    previewVideoVolume.value = Number(target.value)
    previewVideoMuted.value = Number(target.value) === 0
  }
}

const setPreviewVideoPlaybackRate = (rate: number) => {
  if (previewVideoRef.value) {
    previewVideoRef.value.playbackRate = rate
    previewVideoPlaybackRate.value = rate
  }
  showPlaybackRateMenu.value = false
}

const togglePlaybackRateMenu = () => {
  showPlaybackRateMenu.value = !showPlaybackRateMenu.value
}

const formatVideoTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) {
    return '00:00'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const requestFullscreen = () => {
  if (previewVideoRef.value) {
    if (previewVideoRef.value.requestFullscreen) {
      previewVideoRef.value.requestFullscreen()
    }
  }
}

const downloadPreviewVideo = () => {
  if (previewVideoAttachment.value) {
    downloadAttachment(previewVideoAttachment.value)
  }
}

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

// ✅ Refactored: Attachment-related computed properties moved to useMessageAttachment composable
// - attachmentUrl, attachmentName, attachmentSize
// - fileAttachments, imageAttachments, nonImageAttachments
// - hasMultipleAttachments, isFileOnlyContent
// - messageStatus

// ✅ Refactored: Sticker-related logic moved to useMessageSticker composable
// - stickerMetadata, stickerUrls, stickerImageUrl
// - currentStickerUrlIndex, stickerLoadError, stickerLoading
// - onStickerLoadStart, onStickerError, onStickerLoad

// ✅ Refactored: Content processing moved to useMessageContent composable
// - actualMessageType (smart type detection from metadata)
// - processedMessageContent (async processing with caching)
// - contentCache (LRU cache with max 100 entries)
// - processMessageContent() (debounced processing function)
// - watch() for message changes
// - onUnmounted() cleanup

// ✅ Refactored: Formatting functions moved to utils and composables
// - formatTime: from useMessageTime composable
// - formatFileSize, getFileExtension, getFileTypeClass: from @/utils/message

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

// ✅ Refactored: All sticker event handlers moved to useMessageSticker composable
// - onStickerLoadStart(), onStickerError(), onStickerLoad()
// - watch() for sticker metadata changes

// ✅ Refactored: All action methods moved to useMessageActions composable
// - handleRightClick(), toggleActionsMenu(), copyMessage()
// - replyToMessage(), forwardMessage(), recallMessage(), selectMessage()
// - handleRetry()
// - showActions, showActionsMenu state
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

/* ═══════════════════════════════════════════════════════════════
   🎬 影片附件播放器樣式
   ═══════════════════════════════════════════════════════════════ */

/* 影片附件容器 */
.message-media.attachment-video {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 320px;
}

.video-container {
  position: relative;
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #000;
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-fast);
}

.video-container:hover {
  box-shadow: var(--shadow-lg);
  transform: scale(1.01);
}

/* 影片元素 */
.video-player {
  width: 100%;
  height: auto;
  max-height: 400px;
  display: block;
  object-fit: contain;
  background: #000;
}

/* 控制層覆蓋 */
.video-controls-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  opacity: 1;
  transition: opacity var(--transition-fast);
}

.video-controls-overlay.is-playing {
  opacity: 0;
}

.video-container:hover .video-controls-overlay {
  opacity: 1;
}

/* 居中播放按鈕 */
.video-play-btn-center {
  width: 64px;
  height: 64px;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  color: var(--gray-800);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.video-play-btn-center:hover {
  background: white;
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
}

.video-play-btn-center:active {
  transform: scale(0.95);
}

/* 底部控制列 */
.video-controls-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
}

.video-control-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  backdrop-filter: blur(4px);
}

.video-control-btn:hover {
  background: rgba(255, 255, 255, 0.35);
  transform: scale(1.1);
}

.video-control-btn:active {
  transform: scale(0.9);
}

/* 影片狀態指示器 */
.attachment-status-indicator.video-status {
  margin-top: 8px;
  align-self: flex-end;
}

/* ═══════════════════════════════════════════════════════════════
   響應式調整 - 影片播放器
   ═══════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .message-media.attachment-video {
    max-width: 280px;
  }

  .video-player {
    max-height: 300px;
  }

  .video-play-btn-center {
    width: 52px;
    height: 52px;
  }

  .video-play-btn-center svg {
    width: 24px;
    height: 24px;
  }

  .video-control-btn {
    width: 28px;
    height: 28px;
  }
}

@media (max-width: 480px) {
  .message-media.attachment-video {
    max-width: 240px;
  }

  .video-player {
    max-height: 220px;
  }

  .video-play-btn-center {
    width: 44px;
    height: 44px;
  }

  .video-play-btn-center svg {
    width: 20px;
    height: 20px;
  }

  .video-controls-bar {
    padding: var(--space-1) var(--space-2);
  }

  .video-control-btn {
    width: 24px;
    height: 24px;
  }

  .video-control-btn svg {
    width: 12px;
    height: 12px;
  }
}

/* 觸控設備優化 */
@media (pointer: coarse) {
  .video-controls-overlay {
    opacity: 1 !important;
  }

  .video-control-btn {
    min-width: 36px;
    min-height: 36px;
  }
}

/* 展開按鈕 */
.video-control-btn.expand-btn {
  margin-left: auto;
}

/* ═══════════════════════════════════════════════════════════════
   🎬 影片預覽 Modal 樣式
   ═══════════════════════════════════════════════════════════════ */

.video-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
}

.video-preview-modal {
  background: var(--gray-900);
  border-radius: var(--radius-xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  width: 90vw;
  max-width: 1000px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 標題列 */
.video-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background: var(--gray-800);
  border-bottom: 1px solid var(--gray-700);
}

.video-preview-title h3 {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin: 0 0 var(--space-1) 0;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-preview-meta {
  font-size: 0.8rem;
  color: var(--gray-400);
}

.video-preview-actions {
  display: flex;
  gap: var(--space-2);
}

.video-preview-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--gray-700);
  color: var(--gray-300);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.video-preview-btn:hover {
  background: var(--gray-600);
  color: white;
}

.video-preview-btn.close:hover {
  background: var(--red-600);
  color: white;
}

/* 影片內容區 */
.video-preview-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  min-height: 300px;
  max-height: calc(90vh - 200px);
  position: relative;
}

.video-preview-player-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview-player {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.video-preview-play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.video-preview-play-btn-center {
  width: 80px;
  height: 80px;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  color: var(--gray-800);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.video-preview-play-btn-center:hover {
  background: white;
  transform: scale(1.1);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

/* 控制列 */
.video-preview-controls {
  background: var(--gray-800);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--gray-700);
}

.video-progress-container {
  width: 100%;
  margin-bottom: var(--space-3);
}

.video-progress-bar {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--gray-600);
  border-radius: var(--radius-full);
  cursor: pointer;
  outline: none;
}

.video-progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.video-progress-bar::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.video-progress-bar::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
}

.video-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.video-controls-left,
.video-controls-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.video-ctrl-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--gray-700);
  color: var(--gray-300);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.video-ctrl-btn:hover {
  background: var(--gray-600);
  color: white;
}

.video-time-display {
  font-size: 0.85rem;
  color: var(--gray-400);
  font-family: monospace;
  min-width: 100px;
}

/* 音量控制 */
.video-volume-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.video-volume-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--gray-600);
  border-radius: var(--radius-full);
  cursor: pointer;
  outline: none;
}

.video-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.video-volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
}

/* 播放速度選單 */
.video-playback-rate {
  position: relative;
}

.playback-rate-btn {
  width: auto;
  padding: 0 var(--space-2);
  font-size: 0.8rem;
  font-weight: 600;
}

.playback-rate-menu {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: var(--space-2);
  background: var(--gray-700);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 10;
}

.playback-rate-option {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: none;
  color: var(--gray-300);
  font-size: 0.85rem;
  cursor: pointer;
  text-align: center;
  transition: all var(--transition-fast);
}

.playback-rate-option:hover {
  background: var(--gray-600);
  color: white;
}

.playback-rate-option.active {
  background: var(--primary-600);
  color: white;
}

/* ═══════════════════════════════════════════════════════════════
   響應式調整 - 影片預覽 Modal
   ═══════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .video-preview-modal {
    width: 95vw;
    max-height: 95vh;
  }

  .video-preview-header {
    padding: var(--space-3) var(--space-4);
  }

  .video-preview-title h3 {
    font-size: 0.9rem;
    max-width: 200px;
  }

  .video-preview-btn {
    width: 36px;
    height: 36px;
  }

  .video-preview-controls {
    padding: var(--space-3) var(--space-4);
  }

  .video-controls-row {
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .video-volume-slider {
    width: 60px;
  }

  .video-time-display {
    font-size: 0.75rem;
    min-width: 80px;
  }
}

@media (max-width: 480px) {
  .video-preview-header {
    padding: var(--space-2) var(--space-3);
  }

  .video-preview-title h3 {
    font-size: 0.85rem;
    max-width: 150px;
  }

  .video-preview-meta {
    font-size: 0.7rem;
  }

  .video-preview-btn {
    width: 32px;
    height: 32px;
  }

  .video-preview-play-btn-center {
    width: 60px;
    height: 60px;
  }

  .video-preview-play-btn-center svg {
    width: 32px;
    height: 32px;
  }

  .video-preview-controls {
    padding: var(--space-2) var(--space-3);
  }

  .video-ctrl-btn {
    width: 32px;
    height: 32px;
  }

  .video-volume-control {
    display: none; /* 手機版隱藏音量滑桿 */
  }

  .video-time-display {
    font-size: 0.7rem;
    min-width: 70px;
  }
}

/* 觸控設備優化 - 影片預覽 Modal */
@media (pointer: coarse) {
  .video-ctrl-btn {
    min-width: 40px;
    min-height: 40px;
  }

  .video-progress-bar {
    height: 8px;
  }

  .video-progress-bar::-webkit-slider-thumb {
    width: 18px;
    height: 18px;
  }
}
</style>