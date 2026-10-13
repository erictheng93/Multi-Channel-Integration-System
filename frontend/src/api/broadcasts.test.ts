import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBroadcast } from './broadcasts'

const input = { title: '通知', content: '內容', tagIds: [1], attachments: [] }

afterEach(() => vi.restoreAllMocks())

describe('broadcast error responses through the base client', () => {
  it('shows field labels and validation details for 422', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          data: { errors: [{ field: 'title', message: '請輸入 1 至 100 個字元' }] },
        }),
        { status: 422 }
      )
    )
    await expect(createBroadcast(input)).rejects.toThrow('標題：請輸入 1 至 100 個字元')
  })

  it.each([
    ['ATTACHMENT_NOT_FOUND', '圖片或預覽圖不存在'],
    ['ATTACHMENT_NOT_OWNED', '只能使用您自己上傳的圖片'],
    ['ATTACHMENT_ALREADY_BOUND', '圖片已用於其他訊息'],
    ['ATTACHMENT_BAD_MIME', '僅接受 JPEG / PNG'],
    ['ATTACHMENT_TOO_LARGE', '原圖不得超過 10MB'],
    ['NEW_ERROR_CODE', '請求內容有誤'],
  ])('translates %s by code without matching English error strings', async (code, message) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          code,
          error: 'arbitrary server message',
        }),
        { status: 422 }
      )
    )
    await expect(createBroadcast(input)).rejects.toThrow(message)
  })

  it('uses a Chinese fallback for old 422 responses without codes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'image not found',
        }),
        { status: 422 }
      )
    )
    await expect(createBroadcast(input)).rejects.toThrow('請求內容有誤')
  })
})
