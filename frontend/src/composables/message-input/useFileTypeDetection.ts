import type { FileTypeInfo } from '@/types/message-input'

/**
 * Pure utility functions for file type classification and formatting.
 * No reactive state — safe to call anywhere.
 */
export function useFileTypeDetection() {
  /**
   * Classify a File into a human-readable type with associated color.
   * Covers 11 MIME/extension categories.
   */
  const getFileTypeInfo = (file: globalThis.File): FileTypeInfo => {
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

  /** Format byte count into a human-readable string (e.g., "1.5 KB"). */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return '0 B'
    }

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return {
    getFileTypeInfo,
    formatFileSize,
  }
}
