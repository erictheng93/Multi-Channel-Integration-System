import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileMessage from '@/components/conversation/message-types/FileMessage.vue'
import type { Message } from '@/types'

describe('FileMessage Component', () => {
  const createMessage = (): Message => ({
    id: 'file-1',
    conversationId: 'conv-1',
    content: '',
    messageType: 'file',
    senderType: 'customer',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    metadata: null
  })

  it('renders successfully', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'https://example.com/file.pdf',
        fileName: 'document.pdf'
      }
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('displays file name', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'report.pdf'
      }
    })
    expect(wrapper.find('.file-name').text()).toBe('report.pdf')
    wrapper.unmount()
  })

  it('displays formatted file size', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'file.pdf',
        fileSize: 1024
      }
    })
    expect(wrapper.find('.file-size').text()).toBe('1 KB')
    wrapper.unmount()
  })

  it('displays file extension', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'document.pdf'
      }
    })
    expect(wrapper.find('.file-type').text()).toBe('PDF')
    wrapper.unmount()
  })

  it('shows download button', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'file.pdf'
      }
    })
    const btn = wrapper.find('.file-action-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('下載')
    wrapper.unmount()
  })

  it('emits download event when button clicked', async () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'https://example.com/file.pdf',
        fileName: 'document.pdf'
      }
    })
    
    await wrapper.find('.file-action-btn').trigger('click')
    
    expect(wrapper.emitted('download')).toBeTruthy()
    expect(wrapper.emitted('download')![0]).toEqual([
      'https://example.com/file.pdf',
      'document.pdf'
    ])
    wrapper.unmount()
  })

  it('shows upload progress when provided', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'file.pdf',
        uploadProgress: 45
      }
    })
    
    expect(wrapper.find('.file-progress').exists()).toBe(true)
    expect(wrapper.find('.progress-text').text()).toBe('45%')
    wrapper.unmount()
  })

  it('hides progress when upload is complete', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'file.pdf',
        uploadProgress: 100
      }
    })
    
    expect(wrapper.find('.file-progress').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables download button when uploading', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'file.pdf',
        uploadProgress: 50
      }
    })
    
    const btn = wrapper.find('.file-action-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('displays caption when provided', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'file.pdf',
        caption: 'Important document'
      }
    })
    
    expect(wrapper.find('.file-caption').text()).toBe('Important document')
    wrapper.unmount()
  })

  it('hides caption when not provided', () => {
    const wrapper = mount(FileMessage, {
      props: {
        message: createMessage(),
        fileUrl: 'test.pdf',
        fileName: 'file.pdf'
      }
    })
    
    expect(wrapper.find('.file-caption').exists()).toBe(false)
    wrapper.unmount()
  })
})
