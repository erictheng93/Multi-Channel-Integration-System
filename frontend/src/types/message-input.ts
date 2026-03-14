/**
 * Shared TypeScript interfaces for the MessageInput component and its composables/sub-components.
 */

/** Represents a file attachment in the message input area. */
export interface MessageInputAttachment {
  name: string
  size: number
  file: globalThis.File
  blobUrl?: string // Used for image preview
  isImage: boolean // Whether the file is an image
  fileType: string // File type label (e.g., '圖片', 'PDF', 'Word')
  typeColor: string // Color associated with the file type
}

/** Data emitted when file attachments are sent — used for Flex Message Card display. */
export interface FileAttachmentEmitData {
  id: string
  filename: string
  mimeType: string
  fileSize: number
  fileUrl: string
}

/** Result of file type detection. */
export interface FileTypeInfo {
  fileType: string
  typeColor: string
  isImage: boolean
}

/** Result of a single file upload via XHR. */
export interface UploadResult {
  success: boolean
  data?: {
    attachmentId: string
    filename: string
    url: string
  }
  error?: string
}
