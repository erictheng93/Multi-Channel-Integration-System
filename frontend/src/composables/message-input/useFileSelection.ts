import { ref } from 'vue'
import type { MessageInputAttachment } from '@/types/message-input'
import { useFileTypeDetection } from './useFileTypeDetection'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useFileSelection')

export interface FileSelectionOptions {
  /** Called when a validation error occurs (e.g., file too large). */
  onError: (_message: string) => void
  /** Called after each attachment is successfully added. */
  onAttachmentAdd: (_attachment: MessageInputAttachment) => void
}

/**
 * Manages file selection, validation, duplicate prevention, and blob URL lifecycle.
 */
export function useFileSelection(options: FileSelectionOptions) {
  const { getFileTypeInfo } = useFileTypeDetection()

  const attachments = ref<MessageInputAttachment[]>([])
  const fileInputRef = ref<HTMLInputElement>()

  /** Open the native file picker dialog. */
  const triggerFileUpload = () => {
    fileInputRef.value?.click()
  }

  /**
   * Build a dedup key from file metadata.
   * Uses name + size + lastModified to prevent Vue Strict Mode double-add.
   */
  const buildFileKey = (file: globalThis.File) =>
    `${file.name}-${file.size}-${file.lastModified}`

  /**
   * Process a single file: validate, create attachment object, add to list.
   * Returns true if the file was added, false if skipped/rejected.
   */
  const processFile = (
    file: globalThis.File,
    existingKeys: Set<string>,
  ): boolean => {
    const key = buildFileKey(file)

    // Duplicate check
    if (existingKeys.has(key)) {
      if (import.meta.env.DEV) {
        frontendLogger.debug(`[FileSelection] Skipping duplicate file: ${file.name}`)
      }
      return false
    }

    // Size validation (max 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      options.onError(`File ${file.name} exceeds 10MB limit`)
      return false
    }

    const typeInfo = getFileTypeInfo(file)
    const blobUrl = typeInfo.isImage ? URL.createObjectURL(file) : undefined

    const attachment: MessageInputAttachment = {
      name: file.name,
      size: file.size,
      file,
      blobUrl,
      isImage: typeInfo.isImage,
      fileType: typeInfo.fileType,
      typeColor: typeInfo.typeColor,
    }

    attachments.value.push(attachment)
    existingKeys.add(key)
    options.onAttachmentAdd(attachment)

    if (import.meta.env.DEV) {
      frontendLogger.debug(`[FileSelection] Added file: ${file.name}`)
    }
    return true
  }

  /** Handle the native <input type="file"> change event. */
  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = target.files

    if (!files) {
      return
    }

    const existingKeys = new Set(
      attachments.value.map(a => buildFileKey(a.file)),
    )

    if (import.meta.env.DEV) {
      frontendLogger.debug('[handleFileSelect] Called', {
        filesCount: files.length,
        existingAttachments: attachments.value.length,
        isDev: import.meta.env.DEV,
      })
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) { continue }
      processFile(file, existingKeys)
    }

    // Clear input so re-selecting the same file still triggers change
    target.value = ''
  }

  /** Add files programmatically (e.g., from drag-and-drop). */
  const addFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    const existingKeys = new Set(
      attachments.value.map(a => buildFileKey(a.file)),
    )

    if (import.meta.env.DEV) {
      frontendLogger.debug('[addFiles] Called (drag & drop)', {
        filesCount: fileArray.length,
        existingAttachments: attachments.value.length,
      })
    }

    for (const file of fileArray) {
      processFile(file, existingKeys)
    }
  }

  /** Remove an attachment by index and revoke its blob URL. */
  const removeAttachment = (index: number) => {
    const attachment = attachments.value[index]
    if (attachment?.blobUrl) {
      URL.revokeObjectURL(attachment.blobUrl)
    }
    attachments.value.splice(index, 1)
  }

  /** Revoke all blob URLs (call on unmount / conversation change). */
  const cleanupBlobUrls = () => {
    attachments.value.forEach(attachment => {
      if (attachment.blobUrl) {
        URL.revokeObjectURL(attachment.blobUrl)
      }
    })
  }

  /** Clear all attachments without revoking blob URLs (used during send). */
  const clearAttachments = () => {
    attachments.value = []
  }

  return {
    attachments,
    fileInputRef,
    triggerFileUpload,
    handleFileSelect,
    addFiles,
    removeAttachment,
    cleanupBlobUrls,
    clearAttachments,
  }
}
