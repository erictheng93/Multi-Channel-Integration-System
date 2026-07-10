/**
 * Clipboard Paste Composable
 *
 * 管理剪貼簿圖片貼上功能（Ctrl/Cmd+V），分成兩層：
 * - 元件層級：extractClipboardImages() 供輸入框 @paste 處理器使用
 * - 視圖層級：useClipboardPaste() 在 document 註冊監聽器，
 *   讓焦點不在輸入框時（如剛點過訊息列表）也能貼上圖片
 *
 * 事件分工：焦點位於可編輯元素（input/textarea/contenteditable）時，
 * document 監聽器不動作，交由元素自身的 @paste 處理，避免重複加入附件，
 * 也避免劫持其他輸入框（如搜尋框）的正常文字貼上。
 *
 * @module composables/useClipboardPaste
 * @example
 * ```typescript
 * useClipboardPaste({
 *   onFilesPasted: (files) => {
 *     messageInput.handleFilesDropped(files)
 *   },
 *   maxFiles: 10,
 *   maxFileSize: 10 * 1024 * 1024, // 10MB
 *   onError: (message) => showError(message),
 * })
 * ```
 */

import { onMounted, onUnmounted } from 'vue'

// ============================================================================
// 檔名處理
// ============================================================================

/** MIME → 副檔名對照（重新命名剪貼簿截圖時使用） */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
}

/**
 * 判斷是否為剪貼簿產生的通用檔名（Chrome/Firefox 的截圖一律叫 "image.png"）。
 * 從檔案總管複製的真實檔案會保留原名，不應改名。
 */
const isGenericClipboardName = (name: string): boolean =>
  !name || /^image\.[a-z0-9]+$/i.test(name)

/**
 * 為貼上的截圖產生可辨識的檔名：pasted-YYYYMMDD-HHmmss[-N].ext
 * 保留原始 lastModified，維持 useFileSelection 去重鍵的行為。
 */
const renameClipboardImage = (file: File, index: number): File => {
  if (!isGenericClipboardName(file.name)) {
    return file
  }

  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const suffix = index > 0 ? `-${index + 1}` : ''
  const extension = EXTENSION_BY_MIME[file.type] ?? 'png'

  return new File([file], `pasted-${stamp}${suffix}.${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  })
}

// ============================================================================
// 剪貼簿圖片抽取
// ============================================================================

/**
 * 從剪貼簿資料取出圖片檔案，並為通用檔名的截圖重新命名。
 * 純文字貼上會回傳空陣列（呼叫端應放行瀏覽器預設行為）。
 */
export function extractClipboardImages(data: DataTransfer | null): File[] {
  if (!data) {
    return []
  }

  const images: File[] = []

  if (data.items && data.items.length > 0) {
    for (const item of Array.from(data.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          images.push(file)
        }
      }
    }
  } else if (data.files) {
    // 相容處理：部分環境只填 files、不填 items
    for (const file of Array.from(data.files)) {
      if (file.type.startsWith('image/')) {
        images.push(file)
      }
    }
  }

  return images.map((file, index) => renameClipboardImage(file, index))
}

// ============================================================================
// 視圖層級 Composable
// ============================================================================

/**
 * useClipboardPaste 配置選項
 */
export interface ClipboardPasteOptions {
  /**
   * 圖片貼上回調
   * @param files - 貼上的圖片檔案列表（已完成改名）
   */
  onFilesPasted?: (_files: File[]) => void

  /**
   * 最大檔案數量（預設: 10）
   */
  maxFiles?: number

  /**
   * 最大檔案大小（位元組）（預設: 10MB）
   */
  maxFileSize?: number

  /**
   * 錯誤回調
   * @param message - 錯誤消息
   */
  onError?: (_message: string) => void
}

/**
 * 視圖層級剪貼簿貼上 Composable
 *
 * 在 document 註冊 paste 監聽器（onMounted 掛載、onUnmounted 移除），
 * 需在元件 setup 內呼叫。驗證訊息與 useDragAndDrop 保持一致。
 */
export function useClipboardPaste(options: ClipboardPasteOptions = {}): void {
  const {
    onFilesPasted,
    maxFiles = 10,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    onError,
  } = options

  /** 可編輯元素自行處理貼上（含 MessageInput 的 @paste），避免重複附件 */
  const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return false
    }
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable
    )
  }

  const handlePaste = (event: globalThis.ClipboardEvent): void => {
    if (isEditableTarget(event.target)) {
      return
    }

    const images = extractClipboardImages(event.clipboardData)
    if (images.length === 0) {
      return
    }

    event.preventDefault()

    if (images.length > maxFiles) {
      onError?.(`最多只能上傳 ${maxFiles} 個文件`)
      return
    }

    for (const file of images) {
      if (file.size > maxFileSize) {
        const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(1)
        onError?.(`文件 "${file.name}" 超過大小限制 (最大 ${maxSizeMB}MB)`)
        return
      }
    }

    onFilesPasted?.(images)
  }

  onMounted(() => {
    document.addEventListener('paste', handlePaste)
  })

  onUnmounted(() => {
    document.removeEventListener('paste', handlePaste)
  })
}
