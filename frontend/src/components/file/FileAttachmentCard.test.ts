import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FileAttachmentCard from './FileAttachmentCard.vue'

const baseAttachment = {
  id: 'att-1',
  filename: 'invoice.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
  fileUrl: 'https://example.com/expired-file-url'
}

describe('FileAttachmentCard', () => {
  it('uses a fresh downloadUrl for the open button when present', () => {
    const wrapper = mount(FileAttachmentCard, {
      props: {
        attachment: {
          ...baseAttachment,
          downloadUrl: 'https://example.com/fresh-download-url'
        }
      }
    })

    expect(wrapper.get('a.action-button').attributes('href')).toBe(
      'https://example.com/fresh-download-url'
    )
  })

  it('falls back to fileUrl when downloadUrl is absent', () => {
    const wrapper = mount(FileAttachmentCard, {
      props: {
        attachment: baseAttachment
      }
    })

    expect(wrapper.get('a.action-button').attributes('href')).toBe(
      'https://example.com/expired-file-url'
    )
  })
})
