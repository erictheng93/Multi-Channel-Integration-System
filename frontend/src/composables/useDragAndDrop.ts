/**
 * Drag and Drop Composable
 *
 * 管理文件拖放功能，包含拖拽状态、文件验证和回调处理
 * 使用拖拽计数器机制防止嵌套元素导致的误触发问题
 *
 * @module composables/useDragAndDrop
 * @example
 * ```typescript
 * const dragAndDrop = useDragAndDrop({
 * onFilesDropped: (files) => {
 * messageInput.handleFilesDropped(files)
 * },
 * maxFiles: 5,
 * maxFileSize: 10 * 1024 * 1024, // 10MB
 * })
 *
 * // In template
 * <div
 * @dragenter="dragAndDrop.onDragEnter"
 * @dragleave="dragAndDrop.onDragLeave"
 * @dragover="dragAndDrop.onDragOver"
 * @drop="dragAndDrop.onDrop"
 * >
 * <DragDropOverlay :is-visible="dragAndDrop.isDragging.value" />
 * </div>
 * ```
 */

import { ref } from 'vue'
import type { Ref } from 'vue'

/**
 * useDragAndDrop 配置选项
 */
export interface DragAndDropOptions {
  /**
   * 文件拖放回调
   * @param files - 拖放的文件列表
   */
  onFilesDropped?: (_files: File[]) => void

  /**
   * 文件验证回调 (可选)
   * @param files - 待验证的文件列表
   * @returns 验证结果 { valid: boolean, message?: string }
   */
  validateFiles?: (_files: File[]) => { valid: boolean; message?: string }

  /**
   * 最大文件数量 (默认: 10)
   */
  maxFiles?: number

  /**
   * 最大文件大小 (字节) (默认: 10MB)
   */
  maxFileSize?: number

  /**
   * 允许的文件类型 (MIME types)
   * 例如: ['image/*', 'application/pdf']
   * 默认: undefined (允许所有类型)
   */
  allowedTypes?: string[]

  /**
   * 拖拽错误回调
   * @param message - 错误消息
   */
  onError?: (_message: string) => void
}

/**
 * useDragAndDrop 返回值
 */
export interface DragAndDropReturn {
  // State
  /** 是否正在拖拽文件 */
  isDragging: Ref<boolean>
  /** 拖拽计数器 (用于处理嵌套元素) */
  dragCounter: Ref<number>

  // Event Handlers
  /** DragEnter 事件处理器 */
  onDragEnter: (_event: DragEvent) => void
  /** DragLeave 事件处理器 */
  onDragLeave: (_event: DragEvent) => void
  /** DragOver 事件处理器 */
  onDragOver: (_event: DragEvent) => void
  /** Drop 事件处理器 */
  onDrop: (_event: DragEvent) => void

  // Actions
  /** 重置拖拽状态 */
  reset: () => void
}

/**
 * 拖放管理 Composable
 *
 * 功能:
 * -  拖拽状态管理
 * -  拖拽计数器 (防止嵌套元素误触发)
 * -  文件类型验证
 * -  文件大小验证
 * -  文件数量验证
 * -  错误处理和回调
 *
 * 拖拽计数器原理:
 * - dragEnter 时 counter++
 * - dragLeave 时 counter--
 * - 只有当 counter <= 0 时才认为真正离开拖拽区域
 * - 这样可以避免在拖拽进入子元素时触发 dragLeave
 *
 * @param options - 配置选项
 * @returns 拖拽状态和事件处理器
 */
export function useDragAndDrop(options: DragAndDropOptions = {}): DragAndDropReturn {
  const {
    onFilesDropped,
    validateFiles,
    maxFiles = 10,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedTypes,
    onError,
  } = options

  // ============================================================================
  // State
  // ============================================================================

  const isDragging = ref(false)
  const dragCounter = ref(0)

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * 验证文件列表
   * @param files - 待验证的文件列表
   * @returns 验证结果
   */
  const validateFileList = (files: File[]): { valid: boolean; message?: string } => {
    // 1. 自定义验证器
    if (validateFiles) {
      const result = validateFiles(files)
      if (!result.valid) {
        return result
      }
    }

    // 2. 文件数量验证
    if (files.length > maxFiles) {
      return {
        valid: false,
        message: `最多只能上傳 ${maxFiles} 個文件`,
      }
    }

    // 3. 文件大小和类型验证
    for (const file of files) {
      // 大小验证
      if (file.size > maxFileSize) {
        const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(1)
        return {
          valid: false,
          message: `文件 "${file.name}" 超過大小限制 (最大 ${maxSizeMB}MB)`,
        }
      }

      // 类型验证
      if (allowedTypes && allowedTypes.length > 0) {
        const isAllowed = allowedTypes.some((type) => {
          if (type.endsWith('/*')) {
            // Wildcard matching: "image/*"
            const baseType = type.slice(0, -2)
            return file.type.startsWith(baseType)
          }
          return file.type === type
        })

        if (!isAllowed) {
          return {
            valid: false,
            message: `文件 "${file.name}" 類型不支援`,
          }
        }
      }
    }

    return { valid: true }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * DragEnter 事件处理器
   * 当拖拽进入目标区域时触发
   */
  const onDragEnter = (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()

    // 只处理文件拖拽
    if (!event.dataTransfer?.types.includes('Files')) {
      return
    }

    dragCounter.value++
    isDragging.value = true
  }

  /**
   * DragLeave 事件处理器
   * 当拖拽离开目标区域时触发
   */
  const onDragLeave = (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()

    dragCounter.value--

    // 只有当计数器归零时才认为真正离开
    if (dragCounter.value <= 0) {
      dragCounter.value = 0
      isDragging.value = false
    }
  }

  /**
   * DragOver 事件处理器
   * 当拖拽在目标区域上方移动时持续触发
   */
  const onDragOver = (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()

    // 设置拖放效果为复制
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  /**
   * Drop 事件处理器
   * 当文件被拖放到目标区域时触发
   */
  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()

    // 重置状态
    reset()

    // 获取文件列表
    const files = Array.from(event.dataTransfer?.files || [])

    if (files.length === 0) {
      return
    }

    // 验证文件
    const validation = validateFileList(files)

    if (!validation.valid) {
      onError?.(validation.message || '文件驗證失敗')
      return
    }

    // 回调处理文件
    onFilesDropped?.(files)
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * 重置拖拽状态
   */
  const reset = (): void => {
    isDragging.value = false
    dragCounter.value = 0
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isDragging,
    dragCounter,

    // Event Handlers
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,

    // Actions
    reset,
  }
}
