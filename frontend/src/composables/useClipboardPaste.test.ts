import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import {
  useClipboardPaste,
  extractClipboardImages,
  type ClipboardPasteOptions,
} from './useClipboardPaste'

// ============================================================================
// Test helpers
// ============================================================================

const createImageFile = (
  name = 'image.png',
  type = 'image/png',
  content = 'fake-image-data',
): File => new File([content], name, { type })

interface ClipboardItemEntry {
  kind: string
  type: string
  file?: File
}

const createClipboardData = (entries: ClipboardItemEntry[]): DataTransfer => {
  const items = entries.map(entry => ({
    kind: entry.kind,
    type: entry.type,
    getAsFile: () => entry.file ?? null,
  }))
  const files = entries
    .filter(entry => entry.file)
    .map(entry => entry.file)
  return { items, files } as unknown as DataTransfer
}

const createPasteEvent = (entries: ClipboardItemEntry[]): Event => {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: createClipboardData(entries),
  })
  return event
}

const imageEntry = (file: File): ClipboardItemEntry => ({
  kind: 'file',
  type: file.type,
  file,
})

// ============================================================================
// extractClipboardImages
// ============================================================================

describe('extractClipboardImages', () => {
  it('returns empty array for null clipboard data', () => {
    expect(extractClipboardImages(null)).toEqual([])
  })

  it('extracts image file items and ignores string items', () => {
    const file = createImageFile()
    const data = createClipboardData([
      { kind: 'string', type: 'text/plain' },
      imageEntry(file),
    ])

    const result = extractClipboardImages(data)

    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('image/png')
  })

  it('ignores non-image file items', () => {
    const pdf = new File(['pdf-data'], 'doc.pdf', { type: 'application/pdf' })
    const data = createClipboardData([{ kind: 'file', type: 'application/pdf', file: pdf }])

    expect(extractClipboardImages(data)).toEqual([])
  })

  it('returns empty array for text-only clipboard', () => {
    const data = createClipboardData([{ kind: 'string', type: 'text/plain' }])

    expect(extractClipboardImages(data)).toEqual([])
  })

  it('renames generic clipboard screenshot names to pasted-timestamp', () => {
    const data = createClipboardData([imageEntry(createImageFile('image.png'))])

    const [result] = extractClipboardImages(data)

    expect(result?.name).toMatch(/^pasted-\d{8}-\d{6}\.png$/)
  })

  it('keeps original name for real filenames', () => {
    const data = createClipboardData([
      imageEntry(createImageFile('screenshot-2026.jpg', 'image/jpeg')),
    ])

    const [result] = extractClipboardImages(data)

    expect(result?.name).toBe('screenshot-2026.jpg')
  })

  it('maps image/jpeg to .jpg extension when renaming', () => {
    const data = createClipboardData([
      imageEntry(createImageFile('image.jpeg', 'image/jpeg')),
    ])

    const [result] = extractClipboardImages(data)

    expect(result?.name).toMatch(/\.jpg$/)
  })

  it('appends index suffix for multiple generic-named images', () => {
    const data = createClipboardData([
      imageEntry(createImageFile('image.png', 'image/png', 'aaa')),
      imageEntry(createImageFile('image.png', 'image/png', 'bbbb')),
    ])

    const result = extractClipboardImages(data)

    expect(result[0]?.name).toMatch(/^pasted-\d{8}-\d{6}\.png$/)
    expect(result[1]?.name).toMatch(/^pasted-\d{8}-\d{6}-2\.png$/)
  })

  it('preserves lastModified when renaming (dedup key stability)', () => {
    const file = createImageFile()
    const data = createClipboardData([imageEntry(file)])

    const [result] = extractClipboardImages(data)

    expect(result?.lastModified).toBe(file.lastModified)
  })

  it('falls back to clipboard files when items is empty', () => {
    const file = createImageFile('photo.png')
    const data = { items: [], files: [file] } as unknown as DataTransfer

    const result = extractClipboardImages(data)

    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('photo.png')
  })
})

// ============================================================================
// useClipboardPaste (document-level listener)
// ============================================================================

describe('useClipboardPaste', () => {
  let wrapper: VueWrapper | null = null

  const mountWithComposable = (options: ClipboardPasteOptions): VueWrapper => {
    wrapper = mount(
      defineComponent({
        setup() {
          useClipboardPaste(options)
          return () => null
        },
      }),
    )
    return wrapper
  }

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.replaceChildren()
  })

  it('calls onFilesPasted when an image is pasted outside editable elements', () => {
    const onFilesPasted = vi.fn()
    mountWithComposable({ onFilesPasted })

    const event = createPasteEvent([imageEntry(createImageFile())])
    document.body.dispatchEvent(event)

    expect(onFilesPasted).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)

    const files = onFilesPasted.mock.calls[0]?.[0] as File[]
    expect(files).toHaveLength(1)
    expect(files[0]?.name).toMatch(/^pasted-\d{8}-\d{6}\.png$/)
  })

  it('skips paste events targeting an input element', () => {
    const onFilesPasted = vi.fn()
    mountWithComposable({ onFilesPasted })

    const input = document.createElement('input')
    document.body.appendChild(input)

    input.dispatchEvent(createPasteEvent([imageEntry(createImageFile())]))

    expect(onFilesPasted).not.toHaveBeenCalled()
  })

  it('skips paste events targeting a textarea element', () => {
    const onFilesPasted = vi.fn()
    mountWithComposable({ onFilesPasted })

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    textarea.dispatchEvent(createPasteEvent([imageEntry(createImageFile())]))

    expect(onFilesPasted).not.toHaveBeenCalled()
  })

  it('ignores text-only paste and preserves browser default', () => {
    const onFilesPasted = vi.fn()
    mountWithComposable({ onFilesPasted })

    const event = createPasteEvent([{ kind: 'string', type: 'text/plain' }])
    document.body.dispatchEvent(event)

    expect(onFilesPasted).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('reports error and skips callback when file count exceeds maxFiles', () => {
    const onFilesPasted = vi.fn()
    const onError = vi.fn()
    mountWithComposable({ onFilesPasted, onError, maxFiles: 2 })

    document.body.dispatchEvent(
      createPasteEvent([
        imageEntry(createImageFile('image.png', 'image/png', 'a')),
        imageEntry(createImageFile('image.png', 'image/png', 'bb')),
        imageEntry(createImageFile('image.png', 'image/png', 'ccc')),
      ]),
    )

    expect(onError).toHaveBeenCalledWith('最多只能上傳 2 個文件')
    expect(onFilesPasted).not.toHaveBeenCalled()
  })

  it('reports error and skips callback when a file exceeds maxFileSize', () => {
    const onFilesPasted = vi.fn()
    const onError = vi.fn()
    mountWithComposable({ onFilesPasted, onError, maxFileSize: 4 })

    document.body.dispatchEvent(
      createPasteEvent([
        imageEntry(createImageFile('image.png', 'image/png', 'more-than-4-bytes')),
      ]),
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[0]).toContain('超過大小限制')
    expect(onFilesPasted).not.toHaveBeenCalled()
  })

  it('removes the document listener on unmount', () => {
    const onFilesPasted = vi.fn()
    mountWithComposable({ onFilesPasted })

    wrapper?.unmount()
    wrapper = null

    document.body.dispatchEvent(createPasteEvent([imageEntry(createImageFile())]))

    expect(onFilesPasted).not.toHaveBeenCalled()
  })
})
