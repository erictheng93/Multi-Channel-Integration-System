import { describe, it, expect, vi, beforeEach } from 'vitest'

const transport = vi.hoisted(() => ({
  uploadFileWithXhr: vi.fn(),
  uploadWithPresignedUrl: vi.fn(),
  checkPresignedUrlServiceStatus: vi.fn(),
  clearPresignedStatusCache: vi.fn()
}))
vi.mock('./file-upload/uploadTransport', () => transport)
vi.mock('@/api/files', () => ({ filesApi: {} }))

import { useFileUpload } from './useFileUpload'

const fileOf = (name: string, type: string, size = 10) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('useFileUpload.uploadSingleFile validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an unsupported mime type without touching the network', async () => {
    const { uploadSingleFile } = useFileUpload()
    const result = await uploadSingleFile(fileOf('a.exe', 'application/x-msdownload'))
    expect(result).toMatchObject({ success: false, error: '不支援的檔案格式' })
    expect(transport.uploadFileWithXhr).not.toHaveBeenCalled()
  })

  it('rejects a file over the 10MB default limit', async () => {
    const { uploadSingleFile } = useFileUpload()
    const result = await uploadSingleFile(fileOf('big.png', 'image/png', 10 * 1024 * 1024 + 1))
    expect(result.success).toBe(false)
    expect(result.error).toContain('檔案過大')
    expect(transport.uploadFileWithXhr).not.toHaveBeenCalled()
  })

  it('rejects a file name longer than 255 characters', async () => {
    const { uploadSingleFile } = useFileUpload()
    const result = await uploadSingleFile(fileOf(`${'a'.repeat(256)}.png`, 'image/png'))
    expect(result).toMatchObject({ success: false, error: '檔案名過長' })
    expect(transport.uploadFileWithXhr).not.toHaveBeenCalled()
  })

  it('uploads a valid file and returns the stored url and id', async () => {
    transport.uploadFileWithXhr.mockResolvedValue({ success: true, data: { url: '/f/1', fileId: 'f1' } })
    const { uploadSingleFile } = useFileUpload()
    const result = await uploadSingleFile(fileOf('ok.png', 'image/png', 10 * 1024 * 1024))
    expect(result).toEqual({ fileName: 'ok.png', success: true, url: '/f/1', fileId: 'f1' })
  })
})
