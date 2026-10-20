import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import BroadcastComposeCard from './BroadcastComposeCard.vue'
import type * as BroadcastsApi from '@/api/broadcasts'

const upload = vi.hoisted(() => vi.fn())
const cleanup = vi.hoisted(() => vi.fn())
enableAutoUnmount(afterEach)
vi.mock('@/api/broadcasts', async importOriginal => ({
  ...(await importOriginal<typeof BroadcastsApi>()),
  uploadBroadcastImage: upload,
  cleanupBroadcastImage: cleanup,
}))

const preview = { total: 3, byPlatform: { line: 3, facebook: 0 }, sendable: 3, skipped: [] }

function mountCard() {
  return mount(BroadcastComposeCard, {
    attachTo: document.body,
    props: {
      tags: [{ id: 7, name: 'VIP' }] as never,
      preview,
      previewTagId: 7,
      previewLoading: false,
      sending: false,
      error: null,
    },
  })
}

const image = (name: string, type = 'image/jpeg', size = 1000) =>
  new File([new Uint8Array(size)], name, { type })

async function pick(wrapper: ReturnType<typeof mountCard>, files: File[]) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('BroadcastComposeCard images', () => {
  it.each(['remove', 'unmount'])('reclaims uploads that complete after %s', async action => {
    let resolveUpload!: (_value: BroadcastsApi.BroadcastAttachmentInput) => void
    upload.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveUpload = resolve
        })
    )
    const wrapper = mountCard()
    await pick(wrapper, [image('1.jpg')])
    if (action === 'remove') {
      await wrapper.find('button[aria-label="移除圖片 1"]').trigger('click')
    } else {
      wrapper.unmount()
    }
    expect(cleanup).not.toHaveBeenCalled()
    resolveUpload({ attachmentId: 'late-original', previewAttachmentId: 'late-preview' })
    await flushPromises()
    expect(cleanup).toHaveBeenCalledExactlyOnceWith({
      attachmentId: 'late-original',
      previewAttachmentId: 'late-preview',
    })
  })
  it('deletes finished uploads when an unsent form is discarded, but keeps them once sent', async () => {
    const discarded = mountCard()
    await pick(discarded, [image('1.jpg')])
    discarded.unmount()
    expect(cleanup).toHaveBeenCalledExactlyOnceWith({ attachmentId: 'a-1.jpg', previewAttachmentId: 'p-1.jpg' })

    cleanup.mockClear()
    const sent = mountCard()
    await pick(sent, [image('2.jpg')])
    await sent.find('input[type="text"]').setValue('Promo')
    await sent.find('select').setValue(7)
    await sent.find('form').trigger('submit')
    expect(sent.emitted('send')).toHaveLength(1)
    sent.unmount()
    expect(cleanup).not.toHaveBeenCalled()
  })
  beforeEach(() => {
    upload.mockReset()
    cleanup.mockReset().mockResolvedValue(undefined)
    upload.mockImplementation(async (file: File) => ({
      attachmentId: `a-${file.name}`,
      previewAttachmentId: `p-${file.name}`,
    }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends image-only broadcasts with attachments in picked order', async () => {
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('Promo')
    await wrapper.find('select').setValue(7)
    await pick(wrapper, [image('1.jpg'), image('2.png', 'image/png')])
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('send')?.[0]?.[0]).toEqual({
      title: 'Promo',
      content: '',
      tagIds: [7],
      attachments: [
        { attachmentId: 'a-1.jpg', previewAttachmentId: 'p-1.jpg' },
        { attachmentId: 'a-2.png', previewAttachmentId: 'p-2.png' },
      ],
    })
  })

  it('caps the selection at 4 images', async () => {
    const wrapper = mountCard()
    await pick(
      wrapper,
      ['1', '2', '3', '4', '5'].map(n => image(`${n}.jpg`))
    )
    expect(upload).toHaveBeenCalledTimes(4)
    expect(wrapper.text()).toContain('超出的已略過')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
  })

  it('rejects non JPEG/PNG and files over 10MB without uploading', async () => {
    const wrapper = mountCard()
    await pick(wrapper, [
      image('a.gif', 'image/gif'),
      image('big.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1),
    ])
    expect(upload).not.toHaveBeenCalled()
    expect(wrapper.find('[role="status"]').text()).toContain('僅接受 10MB 以內的 JPEG / PNG 圖片')
  })

  it('blocks submit while nothing but a title is filled in', async () => {
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('Promo')
    await wrapper.find('select').setValue(7)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('keeps both invalid-format and image-count notices', async () => {
    const wrapper = mountCard()
    await pick(wrapper, [
      image('bad.gif', 'image/gif'),
      ...['1', '2', '3', '4', '5'].map(n => image(`${n}.jpg`)),
    ])
    const notice = wrapper.find('[role="status"]').text()
    expect(notice).toContain('僅接受 10MB 以內的 JPEG / PNG 圖片')
    expect(notice).toContain('最多 4 張圖片')
  })

  it('retains focus on the moved image and sends the reordered attachments', async () => {
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('通知')
    await wrapper.find('select').setValue(7)
    await pick(wrapper, [image('1.jpg'), image('2.jpg')])
    await wrapper.find('button[aria-label="將圖片 2 往前移"]').trigger('click')
    expect(document.activeElement).toBe(
      wrapper.find('button[aria-label="將圖片 1 往後移"]').element
    )
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('send')?.[0]?.[0]).toMatchObject({
      attachments: [
        { attachmentId: 'a-2.jpg', previewAttachmentId: 'p-2.jpg' },
        { attachmentId: 'a-1.jpg', previewAttachmentId: 'p-1.jpg' },
      ],
    })
  })

  it('keeps focus on the same after button across consecutive backward moves', async () => {
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('通知')
    await wrapper.find('select').setValue(7)
    await pick(wrapper, ['1', '2', '3', '4'].map(n => image(`${n}.jpg`)))
    const after = wrapper.find('button[aria-label="將圖片 1 往後移"]')
    const movedKey = wrapper.findAll('.image-tile')[0]!.attributes('data-image-key')
    ;(after.element as HTMLButtonElement).focus()

    for (const position of [2, 3]) {
      await after.trigger('click')
      expect(after.attributes('aria-label')).toBe(`將圖片 ${position} 往後移`)
      expect(after.attributes('disabled')).toBeUndefined()
      expect(document.activeElement).toBe(after.element)
      expect(wrapper.findAll('.image-tile')[position - 1]!.attributes('data-image-key')).toBe(
        movedKey
      )
    }

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('send')?.[0]?.[0]).toMatchObject({
      attachments: ['2', '3', '1', '4'].map(n => ({
        attachmentId: `a-${n}.jpg`,
        previewAttachmentId: `p-${n}.jpg`,
      })),
    })
  })

  it('removes images, revokes URLs, and moves focus to the next tile or picker', async () => {
    const wrapper = mountCard()
    await pick(wrapper, [image('1.jpg'), image('2.jpg')])
    await wrapper.find('button[aria-label="移除圖片 1"]').trigger('click')
    expect(wrapper.findAll('.image-tile')).toHaveLength(1)
    expect(document.activeElement).toBe(wrapper.find('button[aria-label="移除圖片 1"]').element)
    await wrapper.find('button[aria-label="移除圖片 1"]').trigger('click')
    expect(wrapper.findAll('.image-tile')).toHaveLength(0)
    expect(document.activeElement).toBe(wrapper.find('input[type="file"]').element)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(cleanup.mock.calls).toEqual([
      [{ attachmentId: 'a-1.jpg', previewAttachmentId: 'p-1.jpg' }],
      [{ attachmentId: 'a-2.jpg', previewAttachmentId: 'p-2.jpg' }],
    ])
  })

  it('announces uploading and errors and blocks even text broadcasts with an error tile', async () => {
    let rejectUpload!: (_error: Error) => void
    upload.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpload = reject
        })
    )
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('通知')
    await wrapper.find('textarea').setValue('文字')
    await wrapper.find('select').setValue(7)
    await pick(wrapper, [image('1.jpg')])
    expect(wrapper.find('[role="status"]').text()).toContain('上傳中')
    rejectUpload(new Error('上傳失敗'))
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('圖片 1：上傳失敗')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('send')).toBeUndefined()
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it('retries a failed upload from the error tile and then allows submit', async () => {
    upload.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('Promo')
    await wrapper.find('select').setValue(7)
    await pick(wrapper, [image('1.jpg')])

    expect(wrapper.text()).toContain('boom')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    await wrapper.find('button[aria-label="重試上傳圖片 1"]').trigger('click')
    await flushPromises()

    expect(upload).toHaveBeenCalledTimes(2)
    expect(wrapper.find('button[aria-label="重試上傳圖片 1"]').exists()).toBe(false)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('send')?.[0]?.[0]).toMatchObject({
      attachments: [{ attachmentId: 'a-1.jpg', previewAttachmentId: 'p-1.jpg' }],
    })
  })
})
