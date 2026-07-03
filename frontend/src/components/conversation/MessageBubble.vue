<template>
  <div
    class="message-bubble"
    :class="{
      'message-outgoing': isOutgoing,
      'message-incoming': !isOutgoing,
      'message-delivered': delivered && isOutgoing,
      'message-failed': !delivered && isOutgoing,
      'message-image': actualMessageType === 'image',
      'message-file': actualMessageType === 'file',
    }"
    @contextmenu="handleRightClick"
    @mouseenter="showActions = true"
    @mouseleave="showActions = false"
    @touchstart.passive="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove.passive="handleTouchMove"
  >
    <div class="message-content">
      <!-- Image Message (legacy fallback, only when no R2 image attachments) -->
      <div
        v-if="actualMessageType === 'image' && resolvedAttachmentUrl && imageAttachments.length === 0"
        class="message-media"
      >
        <div
          class="image-container"
          @click="openImagePreview"
        >
          <div
            class="image-placeholder"
            style="width: 300px; max-height: 400px"
          >
            <img
              :src="resolvedAttachmentUrl"
              :alt="attachmentName"
              class="message-image-content"
              width="300"
              style="
                width: 100%;
                height: auto;
                max-height: 400px;
                object-fit: contain;
                display: block;
              "
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

      <!-- Attachments Container - Images, Videos, and Documents -->
      <div
        v-else-if="
          imageAttachments.length > 0 ||
            videoAttachments.length > 0 ||
            documentAttachments.length > 0
        "
        class="message-attachments-container"
      >
        <!-- 圖片附件：簡單顯示，不使用 Flex Message Card -->
        <!--  CLS FIX: 使用 aspect-ratio 預留空間，防止圖片載入後版面位移 -->
        <div
          v-for="attachment in imageAttachments"
          :key="attachment.id"
          class="message-media attachment-image"
        >
          <div
            class="image-container attachment-image-container"
            @click="handleAttachmentPreview(attachment)"
          >
            <img
              :src="attachment.fileUrl"
              :alt="attachment.filename"
              class="message-image-content attachment-image-content"
              loading="lazy"
              @load="onImageLoad"
              @error="onImageError"
            >
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
          <!--  圖片附件發送狀態指示器 -->
          <div
            class="attachment-status-indicator image-status"
            :class="getAttachmentStatusClass(attachment)"
          >
            <template v-if="isAttachmentPending(attachment)">
              <span class="status-spinner" />
              <span class="status-text">傳送中...</span>
            </template>
            <template v-else-if="messageStatus === MESSAGE_STATUS.FAILED">
              <span class="status-icon failed" />
              <span class="status-text failed">發送失敗</span>
            </template>
            <template v-else>
              <span class="status-icon success" />
              <span class="status-text success">已發送</span>
            </template>
          </div>
        </div>

        <!-- Video attachments: Inline player -->
        <VideoPlayer
          v-for="attachment in videoAttachments"
          :key="attachment.id"
          :attachment="attachment"
          :message-status="messageStatus"
          :show-status="true"
          @preview="openVideoPreview"
          @download="downloadAttachment"
        />

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
                fileUrl: attachment.fileUrl,
              }"
              :compact="documentAttachments.length > 1"
              @preview="handleAttachmentPreview"
            />
            <!--  附件發送狀態指示器 -->
            <div
              class="attachment-status-indicator"
              :class="getAttachmentStatusClass(attachment)"
            >
              <template v-if="isAttachmentPending(attachment)">
                <span class="status-spinner" />
                <span class="status-text">傳送中...</span>
              </template>
              <template v-else-if="messageStatus === MESSAGE_STATUS.FAILED">
                <span class="status-icon failed" />
                <span class="status-text failed">發送失敗</span>
              </template>
              <template v-else>
                <span class="status-icon success" />
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
            style="width: 160px; height: 160px; position: relative"
          >
            <img
              :key="`sticker-${stickerMetadata?.stickerId}-${currentStickerUrlIndex}`"
              :src="stickerImageUrl"
              alt="LINE Sticker"
              class="sticker-image"
              style="width: 100%; height: 100%; object-fit: contain"
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
            />
          </div>

          <!-- Enhanced fallback for failed stickers -->
          <div
            v-else
            class="sticker-placeholder enhanced"
          >
            <div class="sticker-icon-large">
              <div class="sticker-emoji" />
            </div>
            <div class="sticker-fallback-content">
              <div class="sticker-text">
                {{ message.content }}
              </div>
              <div class="sticker-error-hint">
                <span v-if="currentStickerUrlIndex >= stickerUrls.length - 1"> 貼圖載入失敗 </span>
                <span v-else> 正在嘗試載入... </span>
              </div>
            </div>
          </div>

          <!-- Sticker metadata info (enhanced) -->
          <div
            v-if="stickerMetadata"
            class="sticker-info enhanced"
          >
            <span class="sticker-id-info">
              {{ stickerMetadata.packageId }} ·  {{ stickerMetadata.stickerId }}
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
        <!-- Agent attribution for internal QA -->
        <span
          v-if="isOutgoing && message.senderName"
          class="agent-attribution"
        >
          {{ message.senderName }}
        </span>

        <!--  Enhanced Message Status with Optimistic UI -->
        <div
          v-if="isOutgoing"
          class="message-status"
        >
          <!-- 撤回窗口倒數：訊息暫存中，尚未送出給客戶 -->
          <div
            v-if="isRecallable"
            class="status-buffered"
            :title="`可撤回，${countdownLabel} 後送出`"
          >
            <span class="buffered-chip">⏱ 可撤回 {{ countdownLabel }}</span>
          </div>

          <!-- 倒數歸零、等待送達確認（以 WS 事件為準，不假顯示已送達） -->
          <div
            v-else-if="isAwaitingDelivery"
            class="status-sending"
            title="傳送中..."
          >
            <div class="spinner-small" />
          </div>

          <!--  Sending状态 -->
          <div
            v-else-if="messageStatus === 'sending' || messageStatus === MESSAGE_STATUS.PENDING"
            class="status-sending"
            title="发送中..."
          >
            <div class="spinner-small" />
          </div>

          <!--  Sent/Delivered状态 -->
          <CheckIcon
            v-else-if="
              messageStatus === MESSAGE_STATUS.SENT ||
                messageStatus === MESSAGE_STATUS.DELIVERED ||
                delivered
            "
            class="status-delivered"
            title="已送达"
          />

          <!--  Failed状态 with重试按钮 -->
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
            />
          </div>

          <!-- Default状态 -->
          <CheckIcon
            v-else
            class="status-delivered"
          />
        </div>
      </div>

      <!--
        Message Actions: a minimal hover toolbar (one-click 複製 + a single
        ⋯ entry) plus a popover menu. The menu opens via the ⋯ button, a
        right-click (handleRightClick), or a long-press on touch — so the
        toolbar no longer needs to crowd the bubble with every action.
      -->
      <div
        v-if="showActions || showActionsMenu"
        ref="actionsEl"
        class="message-actions"
        :class="{ 'actions-outgoing': isOutgoing }"
      >
        <!-- Quick action: one-click copy (kept for frequency) -->
        <button
          class="action-btn"
          title="複製"
          @click.stop="copyMessage"
        >
          <CopyIcon />
        </button>

        <!-- Entry point: open the full actions menu -->
        <button
          class="action-btn"
          title="更多操作"
          @click.stop="toggleActionsMenu"
        >
          <MoreVerticalIcon />
        </button>

        <!--
          Popover menu — teleported to <body> and positioned fixed. The bubble
          lives inside nested stacking contexts (virtualized row uses
          transform + contain; toolbar uses backdrop-filter) and an
          overflow-clipped scroll list, so an in-bubble popover is both painted
          behind sibling rows and clipped. Teleport escapes both.
        -->
        <Teleport to="body">
          <div
            v-if="showActionsMenu"
            ref="menuEl"
            class="actions-dropdown actions-dropdown-floating"
            :style="{
              top: menuTop + 'px',
              left: menuLeft + 'px',
              visibility: menuPositioned ? 'visible' : 'hidden',
            }"
            @click.stop
          >
            <button
              class="dropdown-item"
              @click="copyMessage"
            >
              <CopyIcon />
              <span>複製</span>
            </button>

            <button
              v-if="!isOutgoing"
              class="dropdown-item"
              @click="replyToMessage"
            >
              <ReplyIcon />
              <span>回覆</span>
            </button>

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
        </Teleport>
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

    <!-- Image Preview Modal Component -->
    <ImagePreviewModal
      :show="showImagePreview"
      :image-url="previewImageAttachment?.fileUrl || resolvedAttachmentUrl || ''"
      :image-name="previewImageAttachment?.filename || attachmentName"
      :image-size="previewImageAttachment?.fileSize || attachmentSize || 0"
      @close="closeImagePreview"
      @download="handleImageDownload"
    />

    <!-- Video Preview Modal Component -->
    <VideoPreviewModal
      :show="showVideoPreview"
      :attachment="previewVideoAttachment"
      :download-attachment="downloadAttachment"
      @close="closeVideoPreview"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
  import type { Message } from '@/types'
  import SafeHtmlRenderer from '@/components/ui/SafeHtmlRenderer.vue'
  import FileAttachmentCard from '@/components/file/FileAttachmentCard.vue'
  import VideoPlayer from '@/components/media/VideoPlayer.vue'
  import VideoPreviewModal from '@/components/media/VideoPreviewModal.vue'
  import ImagePreviewModal from '@/components/conversation/support/ImagePreviewModal.vue'
  import { MESSAGE_STATUS } from '@/constants/message-status'

  // Import message utilities and composables
  import { isImageFile } from '@/utils/message'
  import {
    useMessageTime,
    useMessageAttachment,
    useMessageActions,
    useMessageSticker,
    useMessageContent,
    useVideoPlayer,
    useRecallCountdown,
    type FileAttachment,
  } from '@/composables/message'

  import {
    CheckIcon,
    XIcon,
    SearchIcon,
    DownloadIcon,
    CopyIcon,
    ReplyIcon,
    MoreVerticalIcon,
    ForwardIcon,
    TrashIcon,
  } from '@/components/icons'

  interface Props {
    message: Message
    delivered?: boolean
    showSender?: boolean
    attachmentUrl?: string
    attachmentName?: string
    attachmentSize?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    delivered: true,
    showSender: false,
    attachmentUrl: '',
    attachmentName: '',
    attachmentSize: 0,
  })

  const emit = defineEmits<{
    preview: [message: Message]
    'image-error': [message: Message]
    copy: [message: Message]
    reply: [message: Message]
    forward: [message: Message]
    recall: [message: Message]
    select: [message: Message]
    retry: [messageId: string] //  New: Retry failed message
  }>()

  // Use message composables
  const { formatTime } = useMessageTime()

  // Create reactive props for useMessageAttachment
  const attachmentProps = computed(() => ({
    message: props.message,
    attachmentUrl: props.attachmentUrl,
    attachmentName: props.attachmentName,
    attachmentSize: props.attachmentSize,
  }))

  const {
    attachmentUrl: resolvedAttachmentUrl, // Computed: extracts URL from props > metadata > content
    fileAttachments, // Used internally by imageAttachments, videoAttachments, and documentAttachments
    imageAttachments,
    videoAttachments,
    documentAttachments,
    // hasMultipleAttachments — removed: legacy file path no longer used
    isFileOnlyContent,
    messageStatus,
    downloadFile,
    downloadAttachment,
    handleAttachmentPreview: handleAttachmentPreviewBase,
    isAttachmentPending,
    getAttachmentStatusClass,
  } = useMessageAttachment(attachmentProps)

  // Mark fileAttachments as used (it's internally used by imageAttachments, videoAttachments, and documentAttachments)
  void fileAttachments

  // FIX: Handle attachment preview - open modal for images, emit event for others
  const handleAttachmentPreview = (attachment: FileAttachment) => {
    // For image attachments, open the local preview modal
    if (isImageFile(attachment)) {
      previewImageAttachment.value = attachment
      showImagePreview.value = true
      return
    }

    // For other attachments, emit the preview event
    handleAttachmentPreviewBase(attachment, message => emit('preview', message))
  }

  // Create reactive props for useMessageActions
  const actionsProps = computed(() => ({
    message: props.message,
  }))

  const actionsEmit = {
    copy: (message: Message) => emit('copy', message),
    reply: (message: Message) => emit('reply', message),
    forward: (message: Message) => emit('forward', message),
    recall: (message: Message) => emit('recall', message),
    select: (message: Message) => emit('select', message),
    retry: (messageId: string) => emit('retry', messageId),
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
    handleRetry,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
  } = useMessageActions(actionsProps, actionsEmit)

  // 撤回窗口倒數（全域共用 ticker，見 useRecallCountdown）
  const messageRef = computed(() => props.message)
  const { isRecallable, isAwaitingDelivery, countdownLabel } = useRecallCountdown(messageRef)

  // 撤回選項顯示條件：
  // - buffered 且窗口內 → 真撤回（取消發送，客戶無感）
  // - Facebook 已送達 → Graph API 可真刪除
  // - LINE 已送達 → 隱藏（LINE 無 unsend API，避免給客服錯誤預期）
  const canRecall = computed(() => {
    if (isRecallable.value) {
      return true
    }
    const status = props.message.deliveryStatus ?? props.message.status
    return (
      props.message.platform === 'facebook' &&
      (status === MESSAGE_STATUS.SENT || status === MESSAGE_STATUS.DELIVERED)
    )
  })

  // The actions menu is teleported to <body> and positioned as `fixed`, so it
  // escapes the nested stacking contexts (the virtualized row uses
  // transform + contain; the toolbar uses backdrop-filter) and the
  // overflow-clipped scroll list that would otherwise hide / clip an
  // in-bubble popover. actionsEl is the on-bubble toolbar used as the anchor.
  const actionsEl = ref<HTMLElement | null>(null)
  const menuEl = ref<HTMLElement | null>(null)
  const menuTop = ref(0)
  const menuLeft = ref(0)
  const menuPositioned = ref(false)

  // Place the floating menu next to its toolbar anchor: aligned to the inner
  // side of the column, flipping above when there is no room below. Computed
  // against the viewport because the menu is fixed-positioned at <body>.
  const positionMenu = () => {
    const anchor = actionsEl.value
    const menu = menuEl.value
    if (!anchor || !menu) {
      return
    }
    const a = anchor.getBoundingClientRect()
    const menuW = menu.offsetWidth
    const menuH = menu.offsetHeight
    const gap = 6
    const margin = 8

    const openUp = window.innerHeight - a.bottom < menuH + gap
    let top = openUp ? a.top - menuH - gap : a.bottom + gap
    let left = isOutgoing.value ? a.right - menuW : a.left

    left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin))
    top = Math.max(margin, Math.min(top, window.innerHeight - menuH - margin))

    menuLeft.value = left
    menuTop.value = top
    menuPositioned.value = true
  }

  // While the menu is open: close on outside click, and on scroll/resize
  // (a fixed menu would otherwise float detached from its bubble). The click
  // listener is armed on a macrotask so the opening click/long-press does not
  // immediately close it.
  let teardownMenu: (() => void) | null = null

  watch(showActionsMenu, (open) => {
    if (open) {
      menuPositioned.value = false
      nextTick(positionMenu)

      const close = () => {
        showActionsMenu.value = false
      }
      const timerId = setTimeout(() => {
        document.addEventListener('click', close)
      }, 0)
      window.addEventListener('scroll', close, true)
      window.addEventListener('resize', close)
      teardownMenu = () => {
        clearTimeout(timerId)
        document.removeEventListener('click', close)
        window.removeEventListener('scroll', close, true)
        window.removeEventListener('resize', close)
      }
    } else {
      menuPositioned.value = false
      teardownMenu?.()
      teardownMenu = null
    }
  })

  onUnmounted(() => {
    teardownMenu?.()
  })

  // Create reactive props for useMessageSticker
  const stickerProps = computed(() => ({
    message: props.message,
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
    onStickerLoad,
  } = useMessageSticker(stickerProps)

  // Create reactive props for useMessageContent
  const contentProps = computed(() => ({
    message: props.message,
  }))

  const { processedMessageContent, actualMessageType } = useMessageContent(contentProps)

  // State
  const showImagePreview = ref(false)
  const imageLoaded = ref(false)
  const imageError = ref(false)

  // Image preview attachment state (for attachment images)
  const previewImageAttachment = ref<FileAttachment | null>(null)

  // Video player composable - handles video preview modal state
  // Note: Inline video players (VideoPlayer.vue) manage their own state internally
  const {
    showVideoPreview,
    previewVideoAttachment,
    openVideoPreview,
    closeVideoPreview,
  } = useVideoPlayer({ downloadAttachment })

  // Computed properties
  const isOutgoing = computed(() => {
    // Support both senderType and direction for test compatibility
    if ('direction' in props.message) {
      return (props.message as { direction: string }).direction === 'outgoing'
    }
    // Both agent messages and system messages (e.g. auto-replies) are outgoing
    return props.message.senderType === 'agent' || props.message.senderType === 'system'
  })

  const senderName = computed(() => {
    if (props.message.senderType === 'customer' || props.message.senderType === 'user') {
      return props.message.senderName || '客戶'
    }
    return props.message.senderName || '客服'
  })

  const senderInitials = computed(() => {
    return senderName.value[0]
  })

  // Refactored: Attachment-related computed properties moved to useMessageAttachment composable
  // - attachmentUrl, attachmentName, attachmentSize
  // - fileAttachments, imageAttachments, nonImageAttachments
  // - hasMultipleAttachments, isFileOnlyContent
  // - messageStatus

  // Refactored: Sticker-related logic moved to useMessageSticker composable
  // - stickerMetadata, stickerUrls, stickerImageUrl
  // - currentStickerUrlIndex, stickerLoadError, stickerLoading
  // - onStickerLoadStart, onStickerError, onStickerLoad

  // Refactored: Content processing moved to useMessageContent composable
  // - actualMessageType (smart type detection from metadata)
  // - processedMessageContent (async processing with caching)
  // - contentCache (LRU cache with max 100 entries)
  // - processMessageContent() (debounced processing function)
  // - watch() for message changes
  // - onUnmounted() cleanup

  // Refactored: Formatting functions moved to utils and composables
  // - formatTime: from useMessageTime composable
  // - formatFileSize, getFileExtension, getFileTypeClass: from @/utils/message

  // getFileIcon — removed: legacy file rendering path no longer used

  // Image preview methods
  const openImagePreview = () => {
    if (actualMessageType.value === 'image') {
      showImagePreview.value = true
      emit('preview', props.message)
    }
  }

  const closeImagePreview = () => {
    showImagePreview.value = false
    previewImageAttachment.value = null
  }

  // Handle image download from ImagePreviewModal
  const handleImageDownload = () => {
    if (previewImageAttachment.value) {
      downloadAttachment(previewImageAttachment.value)
    } else {
      downloadFile()
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

  // Refactored: All sticker event handlers moved to useMessageSticker composable
  // - onStickerLoadStart(), onStickerError(), onStickerLoad()
  // - watch() for sticker metadata changes

  // Refactored: All action methods moved to useMessageActions composable
  // - handleRightClick(), toggleActionsMenu(), copyMessage()
  // - replyToMessage(), forwardMessage(), recallMessage(), selectMessage()
  // - handleRetry()
  // - showActions, showActionsMenu state
</script>

<style scoped>
  /* Import extracted CSS modules */
  @import '@/styles/components/message-bubble/index.css';
</style>

