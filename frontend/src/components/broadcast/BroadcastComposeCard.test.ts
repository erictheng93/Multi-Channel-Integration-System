import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BroadcastComposeCard from './BroadcastComposeCard.vue'
import type * as BroadcastsApi from '@/api/broadcasts'

const upload = vi.hoisted(() => vi.fn())
vi.mock('@/api/broadcasts', async (importOriginal) => ({
  ...(await importOriginal<typeof BroadcastsApi>()),
  uploadBroadcastImage: upload
}))

const preview = { total: 3, byPlatform: { line: 3, facebook: 0 }, sendable: 3, skipped: [] }

function mountCard() {
  return mount(BroadcastComposeCard, {
    props: {
      tags: [{ id: 7, name: 'VIP' }] as never,
      preview,
      previewTagId: 7,
      previewLoading: false,
      sending: false,
      error: null
    }
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
  beforeEach(() => {
    upload.mockReset()
    upload.mockImplementation(async (file: File) => ({ attachmentId: `a-${file.name}`, previewAttachmentId: `p-${file.name}` }))
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
        { attachmentId: 'a-2.png', previewAttachmentId: 'p-2.png' }
      ]
    })
  })

  it('caps the selection at 4 images', async () => {
    const wrapper = mountCard()
    await pick(wrapper, ['1', '2', '3', '4', '5'].map((n) => image(`${n}.jpg`)))
    expect(upload).toHaveBeenCalledTimes(4)
    expect(wrapper.text()).toContain('超出的已略過')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
  })

  it('rejects non JPEG/PNG and files over 10MB without uploading', async () => {
    const wrapper = mountCard()
    await pick(wrapper, [image('a.gif', 'image/gif'), image('big.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1)])
    expect(upload).not.toHaveBeenCalled()
  })

  it('blocks submit while nothing but a title is filled in', async () => {
    const wrapper = mountCard()
    await wrapper.find('input[type="text"]').setValue('Promo')
    await wrapper.find('select').setValue(7)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
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
      attachments: [{ attachmentId: 'a-1.jpg', previewAttachmentId: 'p-1.jpg' }]
    })
  })
})
