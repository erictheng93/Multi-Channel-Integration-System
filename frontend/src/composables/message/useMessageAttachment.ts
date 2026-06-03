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
import { ensureDownloadFilename } from '@/utils/message/formatting'
import { MESSAGE_STATUS } from '@/constants/message-status'
import { getApiUrl } from '@/config/runtime'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useMessageAttachment')

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
  // Signed force-download URL (Content-Disposition: attachment). Preferred by
  // downloadAttachment over fileUrl, which is served inline and would open the
  // file in a new view instead of downloading it.
  downloadUrl?: string
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
 * attachmentUrl,
 * attachmentName,
 * fileAttachments,
 * downloadFile,
 * downloadAttachment
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

    // Check metadata - standard attachment format
    if (props.value.message.metadata?.attachment?.url) {
      return props.value.message.metadata.attachment.url
    }

    // Check metadata - LINE image format (originalContentUrl / previewImageUrl)
    // These are LINE API URLs that require auth, so we proxy them through our backend
    const metadata = props.value.message.metadata
    if (metadata) {
      const meta = typeof metadata === 'string' ? (() => { try { return JSON.parse(metadata) } catch { return null } })() : metadata
      if (meta?.originalContentUrl || meta?.previewImageUrl) {
        // Use proxy endpoint to download from LINE API with auth
        const lineMessageId = meta.originalContentUrl?.match(/\/message\/(\d+)\/content/)?.[1]
        if (lineMessageId) {
          return getApiUrl(`/api/files/line-proxy/${lineMessageId}`)
        }
        // Fallback to direct URL (won't work without auth, but keeps the data available)
        return meta.originalContentUrl || meta.previewImageUrl
      }
      // Check generic image metadata keys
      if (meta?.imageUrl || meta?.previewUrl) {
        return meta.imageUrl || meta.previewUrl
      }
    }

    // Fallback: extract URL from content
    const urlMatch = props.value.message.content?.match(/https?:\/\/[^\s]+/)
    return urlMatch ? urlMatch[0] : null
  })

  /**
   * Extract attachment name from message
   * Priority: prop override > metadata.attachment.name > metadata.fileName (LINE) > content file match > default
   */
  const attachmentName = computed(() => {
    // Use prop if provided (for tests)
    if (props.value.attachmentName) {
      return props.value.attachmentName
    }

    // Check metadata (handle both object and JSON string)
    const rawMetadata = props.value.message.metadata
    if (rawMetadata) {
      const meta = typeof rawMetadata === 'string'
        ? (() => { try { return JSON.parse(rawMetadata) } catch { return null } })()
        : rawMetadata

      // Standard attachment format
      if (meta?.attachment?.name) {
        return meta.attachment.name
      }
      // LINE file message format (stores fileName in metadata)
      if (meta?.fileName) {
        return meta.fileName
      }
    }

    // Fallback: extract filename from content
    const fileMatch = props.value.message.content?.match(/\[(?:檔案|圖片)\]\s*(.+)/)
    return fileMatch ? fileMatch[1] : '附件'
  })

  /**
   * Extract attachment size from message
   * Priority: prop override > metadata.attachment.size > metadata.fileSize (LINE)
   */
  const attachmentSize = computed(() => {
    // Use prop if provided (for tests)
    if (props.value.attachmentSize) {
      return props.value.attachmentSize
    }

    // Parse metadata (handle both object and JSON string)
    const rawMetadata = props.value.message.metadata
    if (rawMetadata) {
      const meta = typeof rawMetadata === 'string'
        ? (() => { try { return JSON.parse(rawMetadata) } catch { return null } })()
        : rawMetadata

      if (meta?.attachment?.size) {
        return meta.attachment.size
      }
      // LINE file message format
      if (meta?.fileSize) {
        return meta.fileSize
      }
    }

    return undefined
  })

  /**
   * Parse metadata once for reuse across multiple computeds
   */
  const parsedMetadata = computed(() => {
    const raw = props.value.message.metadata
    if (!raw) {return null}
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return null }
    }
    return raw
  })

  /**
   * Process file_attachments array with support for optimistic UI
   * Priority 1: Confirmed file_attachments (with metadata reconciliation)
   * Priority 2: Pending attachments (during upload)
   */
  const fileAttachments: ComputedRef<FileAttachment[]> = computed(() => {
    // Priority 1: Use confirmed file_attachments
    if (
      props.value.message.file_attachments &&
      props.value.message.file_attachments.length > 0
    ) {
      const attachments = props.value.message.file_attachments as FileAttachment[]
      const meta = parsedMetadata.value

      // Reconciliation: fix corrupted file_attachments from old webhook processing.
      // Old code sometimes stored default filenames (e.g., "image_12345") and wrong
      // mimeTypes (e.g., "image/jpeg" for PDFs) when LINE API type was misidentified.
      // If metadata has a proper fileName, use it to correct the attachment data.
      if (meta?.fileName && attachments.length === 1) {
        const att = attachments[0]
        if (!att) {return attachments}
        const isDefaultFilename = /^(image|file|video|audio)_\d+$/.test(att.filename)
        if (isDefaultFilename || att.filename !== meta.fileName) {
          const ext = (meta.fileName as string).split('.').pop()?.toLowerCase() || ''
          const extMimeMap: Record<string, string> = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          }
          const correctedMime = extMimeMap[ext]

          return [{
            ...att,
            filename: meta.fileName as string,
            // Only override mimeType if we have a definitive mapping from the extension
            mimeType: correctedMime || att.mimeType,
          }] as FileAttachment[]
        }
      }

      return attachments
    }

    // Priority 2: Use pending attachments from optimistic UI (during upload)
    const pendingAttachments = (props.value.message.metadata as Record<string, unknown>)
      ?.pendingAttachments as PendingAttachment[] | undefined

    if (pendingAttachments && pendingAttachments.length > 0) {
      // Normalize pending attachments to match file_attachments structure
      return pendingAttachments.map((pending, index): FileAttachment => ({
        id: `pending-${index}`,
        filename: pending.name,
        mimeType: pending.isImage ? 'image/*' : pending.fileType,
        fileSize: pending.size,
        fileUrl: pending.blobUrl || '', // Use blob URL for preview during upload
        isPending: true // Mark as pending for UI differentiation
      }))
    }

    // Priority 3: Synthesize from metadata when media processing failed.
    // If file_attachments is empty but metadata has fileName (LINE file message),
    // create a synthetic attachment so FileAttachmentCard renders instead of plain text.
    const meta = parsedMetadata.value
    if (meta?.fileName && meta?.originalContentUrl) {
      const fileName = meta.fileName as string
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      const extMimeMap: Record<string, string> = {
        // Image types — so isImageFile() classifies correctly via MIME check
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        // Video types
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'webm': 'video/webm',
        // Document types
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }
      // Use LINE proxy URL as fallback download link
      const lineMessageId = (meta.originalContentUrl as string).match(/\/message\/(\d+)\/content/)?.[1]
      const proxyUrl = lineMessageId ? getApiUrl(`/api/files/line-proxy/${lineMessageId}`) : ''

      return [{
        id: `metadata-fallback-0`,
        filename: fileName,
        mimeType: extMimeMap[ext] || 'application/octet-stream',
        fileSize: (meta.fileSize as number) || 0,
        fileUrl: proxyUrl,
      }]
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
      // Use mime-aware filename so legacy rows without extension still open.
      const mime = (props.value.message.metadata as { mimeType?: string } | undefined)?.mimeType
      link.download = ensureDownloadFilename(attachmentName.value, mime)
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
    id?: string
    fileUrl?: string
    downloadUrl?: string
    filename?: string
    mimeType?: string
  }) => {
    // Prefer the signed force-download URL (Content-Disposition: attachment).
    // fileUrl points at the raw R2 object served `inline`, so an <a download>
    // to it just opens the image in a new view (the reported bug) — and the
    // `download` attribute is ignored cross-origin anyway. Fall back to fileUrl,
    // then to the attachment-id proxy route for legacy rows.
    const href = attachment.downloadUrl
      || attachment.fileUrl
      || (attachment.id ? getApiUrl(`/api/files/download/${attachment.id}`) : '');
    if (!href) {return}

    const link = document.createElement('a')
    link.href = href
    // `download` is a hint only (browsers ignore it cross-origin); the backend
    // is the source of truth for the filename via Content-Disposition.
    link.download = ensureDownloadFilename(attachment.filename, attachment.mimeType)
    // Deliberately no target="_blank": with Content-Disposition: attachment,
    // the browser downloads in place and never navigates, so opening a new tab
    // just flashes an empty window.
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    onPreview?: (_message: Message) => void
  ) => {
    frontendLogger.debug('[useMessageAttachment] Attachment preview requested:', attachment)
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
