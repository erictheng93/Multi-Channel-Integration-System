/**
 * Message Attachment Composable
 *
 * Handles all attachment-related logic for message bubbles:
 * - Attachment metadata extraction (URL, name, size)
 * - File attachments array processing
 * - Image/non-image attachment separation
 * - Download functionality
 * - Attachment preview handling
 * - Pending attachment status tracking
 *
 * @module composables/message/useMessageAttachment
 */

import { computed, type Ref, type ComputedRef } from 'vue'
import type { Message } from '@/types'
import { isImageFile, isVideoFile } from '@/utils/message'
import { MESSAGE_STATUS } from '@/constants/message-status'

/**
 * File Attachment Interface
 * Matches FileAttachmentCard's expected type
 */
export interface FileAttachment {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  fileUrl: string
  r2Key?: string
  isPending?: boolean // For optimistic UI during upload
}

/**
 * Pending Attachment Interface
 * Used for optimistic UI during file upload
 */
interface PendingAttachment {
  name: string
  size: number
  blobUrl?: string
  isImage: boolean
  fileType: string
  typeColor: string
}

/**
 * Props Interface for useMessageAttachment
 */
export interface MessageAttachmentProps {
  message: Message
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
}

/**
 * Message Attachment Composable
 *
 * Provides reactive attachment data and utility functions
 *
 * @param props - Reactive props containing message and attachment overrides
 * @returns Object containing attachment computeds and methods
 *
 * @example
 * ```typescript
 * const props = ref({ message, attachmentUrl: '...' })
 * const {
 *   attachmentUrl,
 *   attachmentName,
 *   fileAttachments,
 *   downloadFile,
 *   downloadAttachment
 * } = useMessageAttachment(props)
 * ```
 */
export function useMessageAttachment(props: Ref<MessageAttachmentProps>) {
  /**
   * Extract attachment URL from message
   * Priority: prop override > metadata.attachment.url > content URL match
   */
  const attachmentUrl = computed(() => {
    // Use prop if provided (for tests)
    if (props.value.attachmentUrl) {
      return props.value.attachmentUrl
    }

    // Check metadata
    if (props.value.message.metadata?.attachment?.url) {
      return props.value.message.metadata.attachment.url
    }

    // Fallback: extract URL from content
    const urlMatch = props.value.message.content?.match(/https?:\/\/[^\s]+/)
    return urlMatch ? urlMatch[0] : null
  })

  /**
   * Extract attachment name from message
   * Priority: prop override > metadata.attachment.name > content file match > default
   */
  const attachmentName = computed(() => {
    // Use prop if provided (for tests)
    if (props.value.attachmentName) {
      return props.value.attachmentName
    }

    // Check metadata
    if (props.value.message.metadata?.attachment?.name) {
      return props.value.message.metadata.attachment.name
    }

    // Fallback: extract filename from content
    const fileMatch = props.value.message.content?.match(/\[(?:檔案|圖片)\]\s*(.+)/)
    return fileMatch ? fileMatch[1] : '附件'
  })

  /**
   * Extract attachment size from message
   * Priority: prop override > metadata.attachment.size
   */
  const attachmentSize = computed(() => {
    // Use prop if provided (for tests)
    if (props.value.attachmentSize) {
      return props.value.attachmentSize
    }

    return props.value.message.metadata?.attachment?.size
  })

  /**
   * Process file_attachments array with support for optimistic UI
   * Priority 1: Confirmed file_attachments
   * Priority 2: Pending attachments (during upload)
   */
  const fileAttachments: ComputedRef<FileAttachment[]> = computed(() => {
    // Priority 1: Use confirmed file_attachments
    if (
      props.value.message.file_attachments &&
      props.value.message.file_attachments.length > 0
    ) {
      return props.value.message.file_attachments as FileAttachment[]
    }

    // Priority 2: Use pending attachments from optimistic UI (during upload)
    const pendingAttachments = (props.value.message.metadata as Record<string, unknown>)
      ?.pendingAttachments as PendingAttachment[] | undefined

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

  /**
   * Filter image attachments
   * Uses isImageFile utility to detect images by MIME type or extension
   */
  const imageAttachments = computed(() => {
    return fileAttachments.value.filter(isImageFile)
  })

  /**
   * Filter non-image attachments (legacy - use documentAttachments instead)
   * These will be displayed using Flex Message Card
   */
  const nonImageAttachments = computed(() => {
    return fileAttachments.value.filter((attachment) => !isImageFile(attachment))
  })

  /**
   * Filter video attachments
   * Uses isVideoFile utility to detect videos by MIME type or extension
   */
  const videoAttachments = computed(() => {
    return fileAttachments.value.filter(isVideoFile)
  })

  /**
   * Filter document attachments (non-image, non-video files)
   * These will be displayed using Flex Message Card
   */
  const documentAttachments = computed(() => {
    return fileAttachments.value.filter(
      (attachment) => !isImageFile(attachment) && !isVideoFile(attachment)
    )
  })

  /**
   * Check if message has multiple attachments
   */
  const hasMultipleAttachments = computed(() => {
    return fileAttachments.value.length > 1
  })

  /**
   * Check if message content is file-only placeholder
   * Matches patterns like: [檔案] filename, Sent a file: filename, Sent 2 files
   */
  const isFileOnlyContent = computed(() => {
    const content = props.value.message.content || ''
    // Match Chinese format: [檔案] [圖片] [影片] [語音] [貼圖] [位置] etc.
    // Match English format: Sent a file: filename
    // Match multi-file format: Sent 2 files, Sent 3 files
    return (
      /^\[(?:檔案|圖片|影片|語音|貼圖|位置)\](?:\s*.+)?$/.test(content) ||
      /^Sent a file:\s*.+$/i.test(content) ||
      /^Sent \d+ files$/i.test(content)
    )
  })

  /**
   * Get message status for optimistic UI
   * Priority: message.status > message.deliveryStatus > default
   */
  const messageStatus = computed(() => {
    // Priority 1: Use message.status (new optimistic UI field)
    if (props.value.message.status) {
      return props.value.message.status
    }

    // Priority 2: Use message.deliveryStatus (legacy field)
    if (props.value.message.deliveryStatus) {
      return props.value.message.deliveryStatus
    }

    // Default: assume sent
    return MESSAGE_STATUS.SENT
  })

  /**
   * Check if attachment is in pending state (uploading)
   *
   * @param attachment - Attachment to check
   * @returns True if attachment is pending
   */
  const isAttachmentPending = (attachment: {
    id?: string
    isPending?: boolean
  }): boolean => {
    // If attachment is explicitly marked as pending
    if (attachment.isPending) {
      return true
    }

    // If attachment ID starts with 'pending-'
    if (attachment.id?.startsWith('pending-')) {
      return true
    }

    // If message status is sending or pending
    if (
      messageStatus.value === 'sending' ||
      messageStatus.value === MESSAGE_STATUS.PENDING
    ) {
      return true
    }

    return false
  }

  /**
   * Get CSS class for attachment status indicator
   *
   * @param attachment - Attachment to get status for
   * @returns CSS class name
   */
  const getAttachmentStatusClass = (attachment: {
    id?: string
    isPending?: boolean
  }): string => {
    if (isAttachmentPending(attachment)) {
      return 'status-pending'
    }
    if (messageStatus.value === MESSAGE_STATUS.FAILED) {
      return 'status-failed'
    }
    return 'status-success'
  }

  /**
   * Download single attachment (legacy single-attachment mode)
   * Uses attachmentUrl and attachmentName from props/metadata
   */
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

  /**
   * Download specific attachment from file_attachments array
   *
   * @param attachment - Attachment object with fileUrl and filename
   */
  const downloadAttachment = (attachment: {
    fileUrl?: string
    filename?: string
  }) => {
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

  /**
   * Handle attachment preview (for image files)
   * This is a placeholder - actual preview logic should be in parent component
   *
   * @param attachment - Attachment to preview
   * @param onPreview - Callback to trigger preview
   */
  const handleAttachmentPreview = (
    attachment: FileAttachment,
    onPreview?: (message: Message) => void
  ) => {
    console.log('🖼️ [useMessageAttachment] Attachment preview requested:', attachment)
    if (onPreview) {
      onPreview(props.value.message)
    }
  }

  return {
    // Computed properties
    attachmentUrl,
    attachmentName,
    attachmentSize,
    fileAttachments,
    imageAttachments,
    nonImageAttachments,
    videoAttachments,
    documentAttachments,
    hasMultipleAttachments,
    isFileOnlyContent,
    messageStatus,

    // Methods
    downloadFile,
    downloadAttachment,
    handleAttachmentPreview,
    isAttachmentPending,
    getAttachmentStatusClass
  }
}
