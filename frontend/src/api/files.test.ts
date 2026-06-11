import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn()
  }
}))

import { filesApi } from './files'
import { apiClient } from './base'

describe('filesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads a single file through the upload transport', async () => {
    const formData = new globalThis.FormData()
    vi.mocked(apiClient.uploadFile).mockResolvedValueOnce({
      success: true,
      data: { fileId: 'file-1', filename: 'a.png', url: '/a.png' }
    })

    await filesApi.uploadFile(formData)

    expect(apiClient.uploadFile).toHaveBeenCalledWith('/files/upload', formData)
  })

  it('builds file list query parameters', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: { items: [] } })

    await filesApi.getFiles(2, 50, 'line')

    expect(apiClient.get).toHaveBeenCalledWith('/files?page=2&pageSize=50&platform=line')
  })

  it('requests a signed upload URL with estimated size fallback', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      data: {
        presignedUrl: 'https://upload.example/file',
        fileId: 'file-1',
        publicUrl: 'https://cdn.example/file',
        expiresAt: '2026-01-01T00:00:00.000Z'
      }
    })

    await filesApi.generateSignedUrl('a.png', 'image/png')

    expect(apiClient.post).toHaveBeenCalledWith('/files/presigned-url', {
      filename: 'a.png',
      mimeType: 'image/png',
      size: 1024 * 1024
    })
  })

  it('builds search filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: { items: [] } })

    await filesApi.searchFiles('invoice', {
      platform: 'facebook',
      type: 'image',
      dateFrom: '2026-01-01',
      dateTo: '2026-02-01',
      page: 3,
      pageSize: 10
    })

    expect(apiClient.get).toHaveBeenCalledWith(
      '/files/search?q=invoice&page=3&pageSize=10&platform=facebook&type=image&dateFrom=2026-01-01&dateTo=2026-02-01'
    )
  })
})
