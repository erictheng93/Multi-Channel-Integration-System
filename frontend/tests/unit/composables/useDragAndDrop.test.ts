import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDragAndDrop } from '@/composables/useDragAndDrop'

// Helper to create mock DragEvent
const createMockDragEvent = (options: {
  types?: string[]
  files?: File[]
} = {}): DragEvent => {
  const { types = ['Files'], files = [] } = options

  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types,
      files,
      dropEffect: 'none' as DataTransfer['dropEffect'],
    } as DataTransfer,
  } as unknown as DragEvent
}

// Helper to create mock File with custom size
const createMockFile = (options: {
  name?: string
  size?: number
  type?: string
} = {}): File => {
  const {
    name = 'test.txt',
    size = 1024,
    type = 'text/plain',
  } = options

  // Create a file with content that matches the desired size
  // For size validation tests, we need the actual file size to match
  const content = 'x'.repeat(size)
  return new File([content], name, { type })
}

describe('useDragAndDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const dragDrop = useDragAndDrop()

      expect(dragDrop.isDragging.value).toBe(false)
      expect(dragDrop.dragCounter.value).toBe(0)
    })

    it('should accept custom options', () => {
      const onFilesDropped = vi.fn()
      const onError = vi.fn()

      const dragDrop = useDragAndDrop({
        onFilesDropped,
        onError,
        maxFiles: 5,
        maxFileSize: 5 * 1024 * 1024,
        allowedTypes: ['image/*'],
      })

      expect(dragDrop.isDragging.value).toBe(false)
      expect(dragDrop.dragCounter.value).toBe(0)
    })
  })

  describe('DragEnter handler', () => {
    it('should set isDragging to true on dragEnter', () => {
      const dragDrop = useDragAndDrop()
      const event = createMockDragEvent()

      dragDrop.onDragEnter(event)

      expect(dragDrop.isDragging.value).toBe(true)
      expect(dragDrop.dragCounter.value).toBe(1)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })

    it('should increment dragCounter on each dragEnter', () => {
      const dragDrop = useDragAndDrop()

      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.dragCounter.value).toBe(1)

      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.dragCounter.value).toBe(2)

      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.dragCounter.value).toBe(3)
    })

    it('should ignore non-file drag events', () => {
      const dragDrop = useDragAndDrop()
      const event = createMockDragEvent({ types: ['text/plain'] })

      dragDrop.onDragEnter(event)

      expect(dragDrop.isDragging.value).toBe(false)
      expect(dragDrop.dragCounter.value).toBe(0)
    })
  })

  describe('DragLeave handler', () => {
    it('should decrement dragCounter on dragLeave', () => {
      const dragDrop = useDragAndDrop()

      // Enter twice
      dragDrop.onDragEnter(createMockDragEvent())
      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.dragCounter.value).toBe(2)

      // Leave once
      dragDrop.onDragLeave(createMockDragEvent())
      expect(dragDrop.dragCounter.value).toBe(1)
      expect(dragDrop.isDragging.value).toBe(true) // Still dragging
    })

    it('should set isDragging to false when counter reaches 0', () => {
      const dragDrop = useDragAndDrop()

      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(true)

      dragDrop.onDragLeave(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(false)
      expect(dragDrop.dragCounter.value).toBe(0)
    })

    it('should not go below 0 on multiple dragLeaves', () => {
      const dragDrop = useDragAndDrop()

      dragDrop.onDragLeave(createMockDragEvent())
      dragDrop.onDragLeave(createMockDragEvent())

      expect(dragDrop.dragCounter.value).toBe(0)
      expect(dragDrop.isDragging.value).toBe(false)
    })

    it('should handle nested elements correctly', () => {
      const dragDrop = useDragAndDrop()

      // Enter parent
      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(true)
      expect(dragDrop.dragCounter.value).toBe(1)

      // Enter child (fires dragEnter on child + dragLeave on parent)
      dragDrop.onDragEnter(createMockDragEvent())
      dragDrop.onDragLeave(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(true) // Still dragging
      expect(dragDrop.dragCounter.value).toBe(1)

      // Leave child (back to parent)
      dragDrop.onDragLeave(createMockDragEvent())
      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(true)

      // Leave parent completely
      dragDrop.onDragLeave(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(false)
    })
  })

  describe('DragOver handler', () => {
    it('should set dropEffect to copy', () => {
      const dragDrop = useDragAndDrop()
      const event = createMockDragEvent()

      dragDrop.onDragOver(event)

      expect(event.dataTransfer?.dropEffect).toBe('copy')
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalled()
    })

    it('should handle missing dataTransfer gracefully', () => {
      const dragDrop = useDragAndDrop()
      const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: null,
      } as unknown as DragEvent

      // Should not throw
      expect(() => {
        dragDrop.onDragOver(event)
      }).not.toThrow()
    })
  })

  describe('Drop handler', () => {
    it('should call onFilesDropped with valid files', () => {
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({ onFilesDropped })

      const files = [
        createMockFile({ name: 'file1.txt', size: 1024 }),
        createMockFile({ name: 'file2.txt', size: 2048 }),
      ]

      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(onFilesDropped).toHaveBeenCalledTimes(1)
      expect(onFilesDropped).toHaveBeenCalledWith(expect.arrayContaining(files))
    })

    it('should reset state after drop', () => {
      const dragDrop = useDragAndDrop()

      dragDrop.onDragEnter(createMockDragEvent())
      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.dragCounter.value).toBe(2)

      const event = createMockDragEvent({
        files: [createMockFile()],
      })
      dragDrop.onDrop(event)

      expect(dragDrop.isDragging.value).toBe(false)
      expect(dragDrop.dragCounter.value).toBe(0)
    })

    it('should not call onFilesDropped if no files', () => {
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({ onFilesDropped })

      const event = createMockDragEvent({ files: [] })
      dragDrop.onDrop(event)

      expect(onFilesDropped).not.toHaveBeenCalled()
    })
  })

  describe('File validation', () => {
    it('should reject files exceeding maxFiles limit', () => {
      const onError = vi.fn()
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({
        maxFiles: 2,
        onError,
        onFilesDropped,
      })

      const files = [
        createMockFile({ name: 'file1.txt' }),
        createMockFile({ name: 'file2.txt' }),
        createMockFile({ name: 'file3.txt' }),
      ]

      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(onError).toHaveBeenCalledWith('最多只能上傳 2 個文件')
      expect(onFilesDropped).not.toHaveBeenCalled()
    })

    it('should reject files exceeding maxFileSize', () => {
      const onError = vi.fn()
      const onFilesDropped = vi.fn()
      const maxFileSize = 1024 // 1KB
      const dragDrop = useDragAndDrop({
        maxFileSize,
        onError,
        onFilesDropped,
      })

      const files = [
        createMockFile({ name: 'large.txt', size: 2048 }), // 2KB
      ]

      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('超過大小限制')
      )
      expect(onFilesDropped).not.toHaveBeenCalled()
    })

    it('should reject files with disallowed types', () => {
      const onError = vi.fn()
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({
        allowedTypes: ['image/*'],
        onError,
        onFilesDropped,
      })

      const files = [
        createMockFile({ name: 'doc.pdf', type: 'application/pdf' }),
      ]

      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('類型不支援')
      )
      expect(onFilesDropped).not.toHaveBeenCalled()
    })

    it('should accept files matching wildcard types', () => {
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({
        allowedTypes: ['image/*'],
        onFilesDropped,
      })

      const files = [
        createMockFile({ name: 'photo.jpg', type: 'image/jpeg' }),
        createMockFile({ name: 'picture.png', type: 'image/png' }),
      ]

      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(onFilesDropped).toHaveBeenCalledWith(expect.arrayContaining(files))
    })

    it('should accept files matching exact types', () => {
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({
        allowedTypes: ['application/pdf', 'text/plain'],
        onFilesDropped,
      })

      const files = [
        createMockFile({ name: 'doc.pdf', type: 'application/pdf' }),
      ]

      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(onFilesDropped).toHaveBeenCalledWith(expect.arrayContaining(files))
    })

    it('should use custom validation function', () => {
      const validateFiles = vi.fn().mockReturnValue({
        valid: false,
        message: 'Custom validation error',
      })
      const onError = vi.fn()
      const onFilesDropped = vi.fn()

      const dragDrop = useDragAndDrop({
        validateFiles,
        onError,
        onFilesDropped,
      })

      const files = [createMockFile()]
      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(validateFiles).toHaveBeenCalledWith(files)
      expect(onError).toHaveBeenCalledWith('Custom validation error')
      expect(onFilesDropped).not.toHaveBeenCalled()
    })

    it('should pass custom validation before built-in checks', () => {
      const validateFiles = vi.fn().mockReturnValue({ valid: true })
      const onFilesDropped = vi.fn()

      const dragDrop = useDragAndDrop({
        validateFiles,
        maxFiles: 10,
        onFilesDropped,
      })

      const files = [createMockFile()]
      const event = createMockDragEvent({ files })
      dragDrop.onDrop(event)

      expect(validateFiles).toHaveBeenCalledWith(files)
      expect(onFilesDropped).toHaveBeenCalled()
    })
  })

  describe('Reset functionality', () => {
    it('should reset state', () => {
      const dragDrop = useDragAndDrop()

      dragDrop.onDragEnter(createMockDragEvent())
      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(true)
      expect(dragDrop.dragCounter.value).toBe(2)

      dragDrop.reset()

      expect(dragDrop.isDragging.value).toBe(false)
      expect(dragDrop.dragCounter.value).toBe(0)
    })

    it('should be idempotent - resetting twice should work', () => {
      const dragDrop = useDragAndDrop()

      dragDrop.onDragEnter(createMockDragEvent())
      dragDrop.reset()
      dragDrop.reset()

      expect(dragDrop.isDragging.value).toBe(false)
      expect(dragDrop.dragCounter.value).toBe(0)
    })
  })

  describe('Integration scenarios', () => {
    it('should support full drag-and-drop workflow', () => {
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({ onFilesDropped })

      // 1. Drag enter
      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(true)

      // 2. Drag over
      dragDrop.onDragOver(createMockDragEvent())

      // 3. Drop
      const files = [createMockFile()]
      dragDrop.onDrop(createMockDragEvent({ files }))

      expect(onFilesDropped).toHaveBeenCalledWith(files)
      expect(dragDrop.isDragging.value).toBe(false)
    })

    it('should handle drag cancel workflow', () => {
      const onFilesDropped = vi.fn()
      const dragDrop = useDragAndDrop({ onFilesDropped })

      // Drag enter
      dragDrop.onDragEnter(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(true)

      // Drag leave without drop
      dragDrop.onDragLeave(createMockDragEvent())
      expect(dragDrop.isDragging.value).toBe(false)
      expect(onFilesDropped).not.toHaveBeenCalled()
    })

    it('should work without callbacks', () => {
      const dragDrop = useDragAndDrop()

      // Should not throw
      expect(() => {
        dragDrop.onDragEnter(createMockDragEvent())
        dragDrop.onDragOver(createMockDragEvent())
        const files = [createMockFile()]
        dragDrop.onDrop(createMockDragEvent({ files }))
      }).not.toThrow()
    })
  })
})
