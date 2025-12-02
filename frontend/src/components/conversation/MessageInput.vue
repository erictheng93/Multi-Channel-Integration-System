<template>
  <div class="message-input">
    <!-- Reply Reference -->
    <div
      v-if="replyToMessage"
      class="reply-reference"
    >
      <div class="reply-content">
        <div class="reply-header">
          <span class="reply-label">回覆</span>
          <span class="reply-sender">{{ replyToMessage.senderName }}</span>
        </div>
        <div class="reply-text">
          {{ replyToMessage.content }}
        </div>
      </div>
      <button
        class="reply-close"
        @click="clearReply"
      >
        <XIcon />
      </button>
    </div>

    <div class="input-container">
      <div class="input-wrapper">
        <!-- 🔧 FIX: 移除 sending 條件，讓輸入框在文件發送時保持可用 -->
        <textarea
          ref="textareaRef"
          v-model="messageText"
          placeholder="輸入訊息..."
          class="message-textarea"
          :disabled="disabled"
          rows="1"
          @keydown="handleKeydown"
          @input="handleInput"
        />

        <div class="input-actions">
          <div class="emoji-picker-container">
            <button
              class="action-btn"
              type="button"
              :disabled="disabled || false"
              title="Emoji"
              @click="toggleEmojiPicker"
            >
              <SmileIcon />
            </button>

            <div
              v-if="showEmojiPicker"
              class="emoji-picker-popup"
            >
              <EmojiPicker @emoji-select="insertEmoji" />
            </div>
          </div>

          <button
            class="action-btn"
            type="button"
            :disabled="disabled || false"
            title="Attachment"
            @click="triggerFileUpload"
          >
            <PaperclipIcon />
          </button>
        </div>
      </div>

      <button
        class="send-button"
        :class="{ sending: sending }"
        @click="sendMessage"
      >
        <SendIcon />
        <span v-if="!sending">送出</span>
        <LoadingIcon
          v-else
          class="animate-spin loading-icon"
        />
      </button>
    </div>

    <!-- File upload input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/*,application/pdf,.doc,.docx"
      class="file-input"
      @change="handleFileSelect"
    >

    <!-- Attachments preview - Phase 3A 增強預覽卡片 -->
    <div
      v-if="attachments.length > 0"
      class="attachments-preview"
    >
      <div
        v-for="(attachment, index) in attachments"
        :key="index"
        class="attachment-card"
      >
        <!-- 圖片預覽 -->
        <div
          v-if="attachment.isImage && attachment.blobUrl"
          class="attachment-thumbnail"
        >
          <img
            :src="attachment.blobUrl"
            :alt="attachment.name"
            class="thumbnail-image"
          >
        </div>
        <!-- 非圖片檔案圖標 -->
        <div
          v-else
          class="attachment-icon"
          :style="{ backgroundColor: attachment.typeColor + '15' }"
        >
          <FileIcon :style="{ color: attachment.typeColor }" />
        </div>

        <!-- 檔案資訊 -->
        <div class="attachment-details">
          <div class="attachment-name-row">
            <span class="attachment-name">{{ attachment.name }}</span>
            <button
              class="remove-attachment"
              type="button"
              title="移除附件"
              @click="removeAttachment(index)"
            >
              <XIcon />
            </button>
          </div>
          <div class="attachment-meta">
            <span
              class="attachment-type"
              :style="{ color: attachment.typeColor }"
            >
              {{ attachment.fileType }}
            </span>
            <span class="attachment-size">{{ formatFileSize(attachment.size) }}</span>
            <span class="attachment-status">待發送</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <div
      v-if="error"
      class="error-message"
    >
      <div class="error-content">
        <XCircleIcon class="error-icon" />
        <span>{{ error }}</span>
      </div>
      <button
        class="error-close"
        @click="error = ''"
      >
        <XIcon />
      </button>
    </div>

    <!-- Success message -->
    <div
      v-if="successMessage"
      class="success-message"
    >
      <div class="success-content">
        <CheckCircleIcon class="success-icon" />
        <span>{{ successMessage }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
  import { messageApi } from '@/api/message'
  import { useAuthStore } from '@/stores/auth'
  import {
    SendIcon,
    SmileIcon,
    PaperclipIcon,
    FileIcon,
    XIcon,
    LoadingIcon,
    XCircleIcon,
    CheckCircleIcon,
  } from '@/components/icons'
  import EmojiPicker from '@/components/ui/EmojiPicker.vue'

  interface Props {
    conversationId: string
    disabled?: boolean
  }

  interface Attachment {
    name: string
    size: number
    file: globalThis.File
    blobUrl?: string      // 用於圖片預覽
    isImage: boolean      // 是否為圖片
    fileType: string      // 檔案類型標籤
    typeColor: string     // 類型顏色
  }

  // 檔案附件資料 - 用於 Flex Message Card 顯示
  interface FileAttachmentEmitData {
    id: string
    filename: string
    mimeType: string
    fileSize: number
    fileUrl: string
  }

  const props = defineProps<Props>()

  // Phase 3B: 擴展 emit 事件支援樂觀更新
  const emit = defineEmits<{
    // 原有事件 - 訊息發送成功
    'message-sent': [data: {
      content: string
      attachments: Attachment[]
      file_attachments?: FileAttachmentEmitData[]
    }]
    // Phase 3B: 訊息開始發送（樂觀更新）
    'message-pending': [data: {
      tempId: string                    // 臨時 ID
      content: string
      attachments: Attachment[]         // 包含 blobUrl 的附件
      status: 'uploading' | 'sending'
      uploadProgress?: number           // 上傳進度 0-100
    }]
    // Phase 3B: 上傳進度更新
    'upload-progress': [data: {
      tempId: string
      progress: number                  // 0-100
      status: 'uploading' | 'sending'
    }]
    // Phase 3B: 訊息發送完成（替換臨時訊息）
    'message-confirmed': [data: {
      tempId: string                    // 臨時 ID
      realId: string                    // 真實訊息 ID
      file_attachments?: FileAttachmentEmitData[]
    }]
    // Phase 3C: 訊息發送失敗（含重試資料）
    'message-failed': [data: {
      tempId: string
      error: string
      // 重試所需的原始資料
      retryData?: {
        content: string
        attachments: Attachment[]  // 原始檔案物件供重試上傳
      }
    }]
    'attachment-upload': [attachment: Attachment]
  }>()
  // Auth Store
  const authStore = useAuthStore()

  // ═══════════════════════════════════════════════════════════════════════════
  // API URL Helper - 開發環境使用相對路徑 (通過 Vite Proxy)，生產環境使用絕對路徑
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 獲取 API URL
   * - 開發環境 (localhost): 使用相對路徑，通過 Vite Proxy 避免 CORS 問題
   * - 生產環境: 使用絕對路徑直接連接後端
   *
   * @param endpoint - API 端點 (例如 '/api/files/upload')
   * @returns 完整的 URL 或相對路徑
   */
  const getApiUrl = (endpoint: string): string => {
    const isDev = import.meta.env.DEV

    if (isDev) {
      // 開發環境: 使用相對路徑，讓 Vite Proxy 處理
      console.log(`[API URL] Dev mode - using relative path: ${endpoint}`)
      return endpoint
    } else {
      // 生產環境: 使用絕對路徑
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com'
      const fullUrl = `${baseUrl}${endpoint}`
      console.log(`[API URL] Production mode - using absolute URL: ${fullUrl}`)
      return fullUrl
    }
  }

  // 獲取檔案類型資訊
  const getFileTypeInfo = (file: globalThis.File): { fileType: string; typeColor: string; isImage: boolean } => {
    const mimeType = file.type.toLowerCase()
    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    // 圖片
    if (mimeType.startsWith('image/')) {
      return { fileType: '圖片', typeColor: '#00BCD4', isImage: true }
    }

    // PDF
    if (mimeType.includes('pdf') || ext === 'pdf') {
      return { fileType: 'PDF', typeColor: '#E53935', isImage: false }
    }

    // Word
    if (mimeType.includes('word') || mimeType.includes('document') || ['doc', 'docx'].includes(ext)) {
      return { fileType: 'Word', typeColor: '#2196F3', isImage: false }
    }

    // Excel
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
      return { fileType: 'Excel', typeColor: '#4CAF50', isImage: false }
    }

    // PowerPoint
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || ['ppt', 'pptx'].includes(ext)) {
      return { fileType: 'PPT', typeColor: '#FF9800', isImage: false }
    }

    // 影片
    if (mimeType.startsWith('video/')) {
      return { fileType: '影片', typeColor: '#9C27B0', isImage: false }
    }

    // 音訊
    if (mimeType.startsWith('audio/')) {
      return { fileType: '音訊', typeColor: '#E91E63', isImage: false }
    }

    // 壓縮檔
    if (mimeType.includes('zip') || mimeType.includes('rar') || ['zip', 'rar', '7z'].includes(ext)) {
      return { fileType: '壓縮檔', typeColor: '#795548', isImage: false }
    }

    // 文字檔
    if (mimeType.includes('text') || ['txt', 'md', 'json', 'xml'].includes(ext)) {
      return { fileType: '文字', typeColor: '#607D8B', isImage: false }
    }

    // 預設
    return { fileType: '檔案', typeColor: '#9E9E9E', isImage: false }
  }

  // defineExpose moved to end of script section

  // Refs
  const textareaRef = ref<globalThis.HTMLTextAreaElement>()
  const fileInputRef = ref<HTMLInputElement>()

  // State
  const messageText = ref('')
  const attachments = ref<Attachment[]>([])
  const sending = ref(false)
  const uploadingFiles = ref(false)  // 🔧 FIX: 獨立追蹤文件上傳狀態
  const error = ref('')
  const successMessage = ref('')
  const showEmojiPicker = ref(false)
  const replyToMessage = ref<{ content: string; senderName: string } | null>(null)

  // Computed - 移除 canSend 邏輯，按鈕始終可用（除了 sending 狀態）

  // Methods
  const handleInput = () => {
    error.value = ''
    autoResize()
  }

  const autoResize = () => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 120)}px`
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    // Esc 鍵 - 清空輸入或關閉表情選擇器或清除回復引用
    if (event.key === 'Escape') {
      event.preventDefault()
      if (showEmojiPicker.value) {
        showEmojiPicker.value = false
      } else if (replyToMessage.value) {
        replyToMessage.value = null
      } else if (messageText.value.trim()) {
        messageText.value = ''
        autoResize()
      }
      return
    }

    // Enter 鍵處理
    if (event.key === 'Enter') {
      // Shift+Enter - 換行
      if (event.shiftKey) {
        // 允許默認行為（換行）
        return
      }

      // Ctrl+Enter 或 Cmd+Enter - 發送消息
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        sendMessage()
        return
      }

      // 普通 Enter - 發送消息
      event.preventDefault()
      sendMessage()
      return
    }

    // Ctrl/Cmd + A - 全選文本
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      // 允許默認行為
      return
    }

    // Ctrl/Cmd + Z - 撤銷
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      // 允許默認行為
      return
    }

    // 上/下箭頭 - 瀏覽消息歷史（如果輸入框為空）
    if (!messageText.value.trim() && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      // TODO: 實現消息歷史瀏覽功能
      console.log(`Message history navigation: ${event.key}`)
      return
    }
  }

  // Phase 3B: 樂觀更新版本的發送訊息
  // 🔧 FIX: 文件上傳和文字發送獨立運作，客服可以在文件上傳時繼續發送文字
  const sendMessage = async () => {
    const content = messageText.value.trim()
    const currentAttachments = [...attachments.value]
    const hasAttachments = currentAttachments.length > 0

    // 如果沒有內容也沒有附件，不發送
    if (!content && !hasAttachments) {
      return
    }

    // 🔧 FIX: 允許併發上傳 - 不阻擋任何發送操作
    // 每次發送都是獨立的，可以同時上傳多組文件

    // 🔧 FIX: 移除檔案數量文字提示
    // 如果有附件但沒有內容，使用空字串而不是生成 "📎 X 個檔案" 文字
    // 這樣發送檔案時不會出現多餘的文字訊息
    const finalContent = content

    // Phase 3B: 生成臨時 ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // 🔧 FIX: 根據是否有附件設置不同的狀態
    if (hasAttachments) {
      uploadingFiles.value = true  // 文件上傳狀態
    }
    sending.value = true  // 通用發送狀態（用於按鈕動畫）
    error.value = ''
    successMessage.value = ''

    // ⚡ Phase 3B: 立即發送樂觀更新 - 用戶馬上看到訊息
    emit('message-pending', {
      tempId,
      content: finalContent,
      attachments: currentAttachments, // 包含 blobUrl 供預覽
      status: hasAttachments ? 'uploading' : 'sending',
      uploadProgress: 0
    })

    // ⚡ Phase 3B: 立即清空輸入區 - 提供即時反饋
    const savedContent = finalContent
    const savedAttachments = currentAttachments
    messageText.value = ''
    // 不要清理 blob URLs，因為它們正在被使用
    attachments.value = []
    replyToMessage.value = null

    await nextTick()
    autoResize()

    try {
      const attachmentIds: string[] = []
      const fileAttachmentsData: FileAttachmentEmitData[] = []

      // 🚀 Phase 3B 優化: 並行上傳檔案，大幅提升多文件上傳速度
      if (hasAttachments) {
        const totalFiles = savedAttachments.length

        // 追蹤每個文件的上傳進度
        const fileProgresses = new Map<number, number>()

        // 計算並發送總進度
        const updateOverallProgress = () => {
          let totalProgress = 0
          fileProgresses.forEach(p => { totalProgress += p })
          const overallProgress = Math.round(totalProgress / totalFiles)
          emit('upload-progress', {
            tempId,
            progress: Math.min(overallProgress, 99), // 保留 1% 給最終確認
            status: 'uploading'
          })
        }

        // 🚀 並行上傳所有文件
        const uploadPromises = savedAttachments.map((attachment, index) =>
          uploadAttachmentWithProgress(
            attachment,
            (fileProgress) => {
              fileProgresses.set(index, fileProgress)
              updateOverallProgress()
            }
          ).then(uploadResponse => {
            if (uploadResponse.success && uploadResponse.data) {
              return {
                success: true as const,
                attachmentId: uploadResponse.data.attachmentId,
                data: {
                  id: uploadResponse.data.attachmentId,
                  filename: uploadResponse.data.filename || attachment.file.name,
                  mimeType: attachment.file.type,
                  fileSize: attachment.file.size,
                  fileUrl: uploadResponse.data.url
                }
              }
            } else {
              return {
                success: false as const,
                error: uploadResponse.error || 'File upload failed',
                filename: attachment.name
              }
            }
          }).catch(err => ({
            success: false as const,
            error: err instanceof Error ? err.message : 'Upload failed',
            filename: attachment.name
          }))
        )

        // 等待所有上傳完成
        const uploadResults = await Promise.all(uploadPromises)

        // 檢查失敗的上傳
        const failedUploads = uploadResults.filter(r => !r.success)
        if (failedUploads.length > 0) {
          const failedNames = failedUploads.map(f => 'filename' in f ? f.filename : 'unknown').join(', ')
          console.error('Attachment upload errors:', failedUploads)

          emit('message-failed', {
            tempId,
            error: `檔案上傳失敗: ${failedNames}`,
            retryData: {
              content: savedContent,
              attachments: savedAttachments
            }
          })
          error.value = `檔案 ${failedNames} 上傳失敗`
          sending.value = false
          uploadingFiles.value = false
          return
        }

        // 收集成功的結果
        for (const result of uploadResults) {
          if (result.success && 'attachmentId' in result) {
            attachmentIds.push(result.attachmentId)
            fileAttachmentsData.push(result.data)
          }
        }

        console.log(`🚀 [並行上傳] ${totalFiles} 個文件全部上傳完成`)

        // 上傳完成，更新狀態為發送中
        emit('upload-progress', {
          tempId,
          progress: 100,
          status: 'sending'
        })
      }

      // 發送訊息到後端
      const response = await messageApi.send(props.conversationId, {
        content: savedContent,
        messageType: hasAttachments ? 'file' : 'text',
        platform: 'line',
        attachmentIds,
        senderId: authStore.currentAgent?.id,
      })

      if (response.success && response.data) {
        // ⚡ Phase 3B: 發送成功，確認訊息
        emit('message-confirmed', {
          tempId,
          realId: response.data.id || tempId,
          // eslint-disable-next-line camelcase
          file_attachments: fileAttachmentsData
        })

        // 同時發送原有事件保持向後相容
        emit('message-sent', {
          content: savedContent,
          attachments: savedAttachments,
          // eslint-disable-next-line camelcase
          file_attachments: fileAttachmentsData
        })

        successMessage.value = '訊息發送成功'
        setTimeout(() => {
          successMessage.value = ''
        }, 3000)
      } else {
        const errorMsg = (response.error as { message?: string })?.message || '發送失敗'
        // Phase 3C: 發送失敗（含重試資料）
        emit('message-failed', {
          tempId,
          error: errorMsg,
          retryData: {
            content: savedContent,
            attachments: savedAttachments
          }
        })
        error.value = errorMsg
      }
    } catch (err) {
      console.error('Send message error:', err)

      let errorMsg = '發送失敗，請重試'
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMsg = '網路連接失敗，請檢查網路後重試'
      } else if (err instanceof Error) {
        errorMsg = `發送失敗：${err.message}`
      }

      // Phase 3C: 發送失敗（含重試資料）
      emit('message-failed', {
        tempId,
        error: errorMsg,
        retryData: {
          content: savedContent,
          attachments: savedAttachments
        }
      })
      error.value = errorMsg
    } finally {
      sending.value = false
      // 🔧 FIX: 重置文件上傳狀態
      if (hasAttachments) {
        uploadingFiles.value = false
      }
    }
  }

  // Phase 3B: 帶進度追蹤的檔案上傳
  const uploadAttachmentWithProgress = async (
    attachment: Attachment,
    onProgress: (_progress: number) => void
  ): Promise<{ success: boolean; data?: { attachmentId: string; filename: string; url: string }; error?: string }> => {
    return new Promise((resolve) => {
      const xhr = new globalThis.XMLHttpRequest()

      // 獲取 API URL - 開發環境使用相對路徑 (Vite Proxy)，生產環境使用絕對路徑
      const url = getApiUrl(`/api/conversations/${props.conversationId}/attachments`)

      // 🔧 FIX: 使用正確的 localStorage key，與 auth store 一致
      const token = localStorage.getItem('token') || localStorage.getItem('authToken')

      // 真實上傳進度追蹤
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          onProgress(Math.min(percentComplete, 95)) // 保留 5% 給伺服器處理
        }
      }

      xhr.onload = () => {
        onProgress(100)

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve({
              success: true,
              data: {
                attachmentId: response.data?.attachmentId || response.attachmentId,
                filename: response.data?.filename || attachment.name,
                url: response.data?.url || ''
              }
            })
          } catch {
            resolve({ success: false, error: '解析伺服器響應失敗' })
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            resolve({ success: false, error: errorResponse.error || `上傳失敗 (${xhr.status})` })
          } catch {
            resolve({ success: false, error: `上傳失敗 (${xhr.status})` })
          }
        }
      }

      xhr.onerror = () => {
        resolve({ success: false, error: '網路錯誤，請檢查網路連線' })
      }

      xhr.ontimeout = () => {
        resolve({ success: false, error: '上傳超時，請稍後重試' })
      }

      xhr.open('POST', url, true)
      xhr.timeout = 120000 // 2 分鐘超時

      // 🔧 FIX: 同時設置兩種認證方式，確保與後端兼容
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.setRequestHeader('X-Session-Id', token)
      }

      const formData = new globalThis.FormData()
      formData.append('file', attachment.file)
      formData.append('messageType', attachment.isImage ? 'image' : 'file')

      xhr.send(formData)
    })
  }

  const triggerFileUpload = () => {
    fileInputRef.value?.click()
  }

  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = target.files

    if (!files) {
      return
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!file) {
        continue
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        error.value = `File ${file.name} exceeds 10MB limit`
        continue
      }

      // 獲取檔案類型資訊
      const typeInfo = getFileTypeInfo(file)

      // 為圖片生成 blob URL 預覽
      const blobUrl = typeInfo.isImage ? URL.createObjectURL(file) : undefined

      const attachment: Attachment = {
        name: file.name,
        size: file.size,
        file,
        blobUrl,
        isImage: typeInfo.isImage,
        fileType: typeInfo.fileType,
        typeColor: typeInfo.typeColor,
      }

      attachments.value.push(attachment)
      emit('attachment-upload', attachment)
    }

    // Clear input
    target.value = ''
  }

  const removeAttachment = (index: number) => {
    const attachment = attachments.value[index]
    // 清理 blob URL 以釋放記憶體
    if (attachment?.blobUrl) {
      URL.revokeObjectURL(attachment.blobUrl)
    }
    attachments.value.splice(index, 1)
  }

  // 清理所有 blob URLs
  const cleanupBlobUrls = () => {
    attachments.value.forEach(attachment => {
      if (attachment.blobUrl) {
        URL.revokeObjectURL(attachment.blobUrl)
      }
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return '0 B'
    }

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const toggleEmojiPicker = () => {
    showEmojiPicker.value = !showEmojiPicker.value
  }

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.value
    if (!textarea) {
      return
    }

    const startPos = textarea.selectionStart
    const endPos = textarea.selectionEnd
    const textBefore = messageText.value.substring(0, startPos)
    const textAfter = messageText.value.substring(endPos)

    messageText.value = textBefore + emoji + textAfter

    // 關閉表情選擇器
    showEmojiPicker.value = false

    // 將光標定位到插入的表情符號後面
    nextTick(() => {
      if (textarea) {
        const newPos = startPos + emoji.length
        textarea.setSelectionRange(newPos, newPos)
        textarea.focus()
        autoResize()
      }
    })
  }

  // 外部調用的快速發送消息方法
  const sendQuickMessage = async (quickText: string) => {
    if (!quickText.trim() || sending.value) {
      return false
    }

    // 設置消息內容
    messageText.value = quickText.trim()

    // 等待下一幀更新完成
    await nextTick()

    // 發送消息
    await sendMessage()

    return true
  }

  // 外部調用的設置文本方法（不發送消息）
  const setMessageText = (text: string) => {
    if (!text.trim()) {
      return false
    }

    messageText.value = text.trim()

    // 自動調整高度
    nextTick(() => {
      autoResize()
      // 聚焦到輸入框
      textareaRef.value?.focus()
    })

    return true
  }

  // 設置回復引用的方法
  const setReplyTo = (content: string, senderName: string) => {
    replyToMessage.value = { content, senderName }

    // 聚焦到輸入框
    nextTick(() => {
      textareaRef.value?.focus()
    })
  }

  // 清除回復引用
  const clearReply = () => {
    replyToMessage.value = null
  }

  // Watch for prop changes
  watch(
    () => props.conversationId,
    () => {
      // 清理 blob URLs
      cleanupBlobUrls()

      // Clear input when conversation changes
      messageText.value = ''
      attachments.value = []
      replyToMessage.value = null
      error.value = ''

      nextTick(() => {
        autoResize()
      })
    }
  )

  // 點擊外部關閉表情選擇器
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as globalThis.Element
    if (showEmojiPicker.value && !target.closest('.emoji-picker-container')) {
      showEmojiPicker.value = false
    }
  }

  // 生命周期管理
  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
    autoResize()
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    // 清理 blob URLs 以釋放記憶體
    cleanupBlobUrls()
  })

  // 暴露方法給父組件調用
  defineExpose({
    sendQuickMessage,
    setMessageText,
    setReplyTo,
    clearReply,
    focus: () => textareaRef.value?.focus(),
  })
</script>

<style scoped>
  /* 🎨 Clean, Minimal Input Design */
  .message-input {
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }

  .reply-reference {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(59, 130, 246, 0.05));
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: 16px 16px 0 0;
    padding: 16px 20px;
    margin-bottom: -1px;
    position: relative;
    overflow: hidden;
  }

  .reply-reference::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #6366f1, #3b82f6);
    border-radius: 0 2px 2px 0;
  }

  .reply-content {
    flex: 1;
    min-width: 0;
    padding-left: 12px;
  }

  .reply-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .reply-label {
    font-size: 11px;
    font-weight: 600;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 2px 8px;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(99, 102, 241, 0.2);
  }

  .reply-sender {
    font-size: 14px;
    font-weight: 600;
    color: #4338ca;
    opacity: 0.9;
  }

  .reply-text {
    font-size: 14px;
    color: #475569;
    line-height: 1.5;
    max-height: 42px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2; /* Fallback for older browsers */
    -webkit-box-orient: vertical;
    opacity: 0.8;
    font-weight: 400;
  }

  .reply-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: rgba(71, 85, 105, 0.05);
    color: #64748b;
    cursor: pointer;
    border-radius: 14px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    margin-left: 12px;
    flex-shrink: 0;
    backdrop-filter: blur(8px);
  }

  .reply-close:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    transform: scale(1.05);
  }

  .reply-close:active {
    transform: scale(0.95);
  }

  .reply-close svg {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
  }

  .reply-close:hover svg {
    transform: rotate(90deg);
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 0.5rem 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: all 0.2s ease;
  }

  .input-container:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .message-textarea {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    font-size: 1rem;
    line-height: 1.4;
    padding: 0.6em 0;
    background: transparent;
    color: var(--gray-900);
    min-height: 24px;
    max-height: 120px;
    vertical-align: middle;
  }

  .message-textarea::placeholder {
    color: var(--gray-400);
    font-size: 1rem;
  }

  .message-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .emoji-picker-container {
    position: relative;
  }

  .emoji-picker-popup {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: var(--space-2);
    z-index: 1000;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    color: var(--gray-500);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--gray-100);
    color: var(--gray-700);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn svg {
    width: 18px;
    height: 18px;
  }

  /* 🎨 Original Green Send Button */
  .send-button {
    --bezier: cubic-bezier(0.22, 0.61, 0.36, 1);
    --edge-light: hsla(0, 0%, 50%, 0.8);
    --text-light: rgba(255, 255, 255, 0.4);
    --back-color: 140, 70%; /* Green theme: 140° hue, 70% saturation */

    cursor: pointer;
    padding: 1em 2em;
    border-radius: 0.7em;
    min-height: 3.5em;
    min-width: 7em;
    display: flex;
    align-items: center;
    gap: 0.7em;
    justify-content: center;
    flex-shrink: 0;

    font-size: 18px;
    letter-spacing: 0.05em;
    line-height: 1;
    font-weight: 600;

    background: linear-gradient(
      140deg,
      hsla(var(--back-color), 60%, 1) min(2em, 20%),
      hsla(var(--back-color), 55%, 0.6) min(8em, 100%)
    );
    color: #000;
    border: 0;
    box-shadow: inset 0.4px 1px 4px var(--edge-light);

    transition: all 0.1s var(--bezier);
  }

  .send-button:hover {
    --edge-light: hsla(0, 0%, 50%, 1);
    text-shadow: 0px 0px 10px var(--text-light);
    box-shadow:
      inset 0.4px 1px 4px var(--edge-light),
      2px 4px 8px hsla(0, 0%, 0%, 0.295);
    transform: scale(1.1);
  }

  .send-button:active {
    --text-light: rgba(255, 255, 255, 1);

    background: linear-gradient(
      140deg,
      hsla(var(--back-color), 60%, 1) min(2em, 20%),
      hsla(var(--back-color), 55%, 0.6) min(8em, 100%)
    );
    box-shadow:
      inset 0.4px 1px 8px var(--edge-light),
      0px 0px 8px hsla(var(--back-color), 50%, 0.6);
    text-shadow: 0px 0px 20px var(--text-light);
    color: #000;
    letter-spacing: 0.1em;
    transform: scale(1);
  }

  .send-button.sending {
    --back-color: 140, 60%;
    animation: pulse-green 2s infinite;
  }

  .send-button svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .send-button span {
    font-weight: 600;
    white-space: nowrap;
  }

  .send-button .loading-icon {
    width: 20px;
    height: 20px;
  }

  @keyframes pulse-green {
    0%,
    100% {
      background: linear-gradient(
        140deg,
        hsla(140, 60%, 60%, 1) min(2em, 20%),
        hsla(140, 60%, 55%, 0.6) min(8em, 100%)
      );
    }
    50% {
      background: linear-gradient(
        140deg,
        hsla(140, 80%, 70%, 1) min(2em, 20%),
        hsla(140, 80%, 65%, 0.6) min(8em, 100%)
      );
    }
  }

  .file-input {
    display: none;
  }

  /* Phase 3A: 增強附件預覽卡片樣式 */
  .attachments-preview {
    margin-top: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .attachment-card {
    display: flex;
    align-items: stretch;
    width: calc(50% - var(--space-2));
    min-width: 200px;
    max-width: 300px;
    background: white;
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
  }

  .attachment-card:hover {
    border-color: var(--gray-300);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .attachment-thumbnail {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    background: var(--gray-100);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .attachment-icon {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .attachment-icon svg {
    width: 28px;
    height: 28px;
  }

  .attachment-details {
    flex: 1;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .attachment-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .attachment-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--gray-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .attachment-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.6875rem;
  }

  .attachment-type {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .attachment-size {
    color: var(--gray-500);
  }

  .attachment-status {
    color: var(--gray-400);
    padding-left: var(--space-2);
    border-left: 1px solid var(--gray-200);
  }

  .remove-attachment {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: var(--gray-400);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .remove-attachment:hover {
    background: var(--red-100);
    color: var(--red-600);
  }

  .remove-attachment svg {
    width: 12px;
    height: 12px;
  }

  .error-message {
    margin-top: var(--space-2);
    padding: var(--space-3);
    background: var(--red-50);
    border: 1px solid var(--red-200);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--red-700);
  }

  .error-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .error-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: var(--red-500);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .error-close:hover {
    background: var(--red-100);
    color: var(--red-700);
  }

  .error-close svg {
    width: 12px;
    height: 12px;
  }

  .success-message {
    margin-top: var(--space-2);
    padding: var(--space-3);
    background: var(--green-50);
    border: 1px solid var(--green-200);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    animation: slideIn 0.3s ease-out;
  }

  .success-content {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--green-700);
  }

  .success-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
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

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* 平板設備優化 */
  @media (max-width: 1024px) {
    .message-input {
      max-width: 1500px;
      margin: 0 auto;
    }

    .emoji-picker-popup {
      right: auto;
      left: 0;
    }
  }

  @media (max-width: 768px) {
    .reply-reference {
      padding: 12px 16px;
      border-radius: 14px 14px 0 0;
    }

    .reply-content {
      padding-left: 8px;
    }

    .reply-header {
      gap: 6px;
      margin-bottom: 4px;
    }

    .reply-label {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
    }

    .reply-sender {
      font-size: 13px;
    }

    .reply-text {
      font-size: 13px;
      max-height: 36px;
    }

    .reply-close {
      width: 24px;
      height: 24px;
      border-radius: 12px;
      margin-left: 8px;
    }

    .reply-close svg {
      width: 14px;
      height: 14px;
    }

    .input-container {
      padding: 12px 16px;
      gap: 10px;
      border-radius: 18px;
    }

    .message-textarea {
      font-size: 1rem; /* iOS 防縮放 */
      min-height: 24px;
      padding: 0.6em 0;
      line-height: 1.4;
    }

    .send-button {
      min-width: 5.5em;
      min-height: 3em;
      padding: 0.8em 1.5em;
      font-size: 16px;
      gap: 0.6em;
    }

    .send-button svg {
      width: 18px;
      height: 18px;
    }

    .send-button .loading-icon {
      width: 18px;
      height: 18px;
    }

    .action-btn {
      width: 32px;
      height: 32px;
      border-radius: 16px;
    }

    .action-btn svg {
      width: 18px;
      height: 18px;
    }

    .emoji-picker-popup {
      position: fixed;
      bottom: 60px;
      left: var(--space-2);
      right: var(--space-2);
      margin-bottom: 0;
      z-index: 9999;
    }

    .attachments-preview {
      margin-top: var(--space-2);
      gap: var(--space-2);
    }

    .attachment-card {
      width: 100%;
      max-width: none;
      min-width: 0;
    }

    .attachment-thumbnail,
    .attachment-icon {
      width: 56px;
      height: 56px;
    }

    .attachment-icon svg {
      width: 22px;
      height: 22px;
    }

    .attachment-details {
      padding: var(--space-2);
    }

    .attachment-name {
      font-size: 0.75rem;
    }

    .attachment-meta {
      font-size: 0.625rem;
    }

    .error-message,
    .success-message {
      padding: var(--space-2);
      font-size: 0.75rem;
    }
  }

  /* 小屏設備進一步優化 */
  @media (max-width: 480px) {
    .input-container {
      padding: var(--space-1) var(--space-2);
    }

    .input-actions {
      gap: 2px;
    }

    .action-btn {
      width: 24px;
      height: 24px;
    }

    .action-btn svg {
      width: 14px;
      height: 14px;
    }

    .send-button {
      min-width: 4.5em;
      min-height: 2.5em;
      padding: 0.6em 1em;
      font-size: 14px;
      gap: 0.5em;
    }

    .send-button svg {
      width: 16px;
      height: 16px;
    }

    .send-button .loading-icon {
      width: 16px;
      height: 16px;
    }

    /* 確保表情選擇器不會被虛擬鍵盤遮蓋 */
    .emoji-picker-popup {
      bottom: 50px;
      left: var(--space-1);
      right: var(--space-1);
    }
  }

  /* 觸摸設備優化 */
  @media (pointer: coarse) {
    .action-btn {
      min-width: 44px;
      min-height: 44px;
    }

    .send-button {
      min-width: 44px;
      min-height: 44px;
    }

    .quick-reply-btn {
      min-height: 44px;
    }

    .remove-attachment {
      min-width: 32px;
      min-height: 32px;
    }

    .error-close {
      min-width: 28px;
      min-height: 28px;
    }
  }
</style>
