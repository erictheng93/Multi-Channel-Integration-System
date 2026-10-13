import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupBroadcastImage, uploadBroadcastImage } from './broadcasts'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn(), preview: vi.fn() }))
vi.mock('./files', () => ({ filesApi: { uploadFile: mocks.upload, deleteFile: mocks.remove } }))
vi.mock('@/utils/broadcast-image-preview', () => ({ createBroadcastPreview: mocks.preview }))

describe('broadcast upload cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.preview.mockResolvedValue(new File(['preview'], 'preview.jpg', { type: 'image/jpeg' }))
    mocks.remove.mockResolvedValue({ success: true })
  })
  const file = new File(['original'], 'original.jpg', { type: 'image/jpeg' })
  const uploaded = (id: string) => ({ success: true, data: { fileId: id } })

  it('keeps both successful uploads', async () => {
    mocks.upload
      .mockResolvedValueOnce(uploaded('original'))
      .mockResolvedValueOnce(uploaded('preview'))
    expect(await uploadBroadcastImage(file)).toEqual({
      attachmentId: 'original',
      previewAttachmentId: 'preview',
    })
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it.each([0, 1])(
    'cleans the successful partner when upload %i fails, including late success',
    async failedIndex => {
      let resolveSuccess!: (_value: ReturnType<typeof uploaded>) => void
      const lateSuccess = new Promise(resolve => {
        resolveSuccess = resolve
      })
      mocks.upload.mockImplementationOnce(() =>
        failedIndex === 0 ? Promise.reject(new Error('上傳失敗')) : lateSuccess
      )
      mocks.upload.mockImplementationOnce(() =>
        failedIndex === 1 ? Promise.reject(new Error('上傳失敗')) : lateSuccess
      )
      const assertion = expect(uploadBroadcastImage(file)).rejects.toThrow('上傳失敗')
      await Promise.resolve()
      expect(mocks.remove).not.toHaveBeenCalled()
      resolveSuccess(uploaded('successful-partner'))
      await assertion
      expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('successful-partner')
    }
  )

  it('preserves the upload error when best-effort deletion fails', async () => {
    mocks.upload
      .mockResolvedValueOnce(uploaded('original'))
      .mockRejectedValueOnce(new Error('上傳失敗'))
    mocks.remove.mockRejectedValue(new Error('刪除失敗'))
    await expect(uploadBroadcastImage(file)).rejects.toThrow('上傳失敗')
  })

  it('attempts deletion of both files even when one deletion fails', async () => {
    mocks.remove
      .mockRejectedValueOnce(new Error('刪除失敗'))
      .mockResolvedValueOnce({ success: true })
    await expect(
      cleanupBroadcastImage({ attachmentId: 'original', previewAttachmentId: 'preview' })
    ).resolves.toBeUndefined()
    expect(mocks.remove.mock.calls).toEqual([['original'], ['preview']])
  })
})
