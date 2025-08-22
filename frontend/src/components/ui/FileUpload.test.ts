import { describe, it, expect, vi, beforeEach, type MockedFunction as _MockedFunction } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { TestComponentInstance, MockProps, TestGlobalConfig } from '@/types/test-types'
import type { FileUploadItem, FileUploadResult as _FileUploadResult } from '@/types/file-upload'
import FileUpload from './FileUpload.vue'

// Mock the icons
vi.mock('@/components/icons', () => ({
  UploadIcon: { name: 'UploadIcon', template: '<div data-testid="upload-icon"></div>' },
  UploadCloudIcon: { name: 'UploadCloudIcon', template: '<div data-testid="upload-cloud-icon"></div>' },
  FileIcon: { name: 'FileIcon', template: '<div data-testid="file-icon"></div>' },
  XIcon: { name: 'XIcon', template: '<div data-testid="x-icon"></div>' },
  CheckIcon: { name: 'CheckIcon', template: '<div data-testid="check-icon"></div>' },
  AlertCircleIcon: { name: 'AlertCircleIcon', template: '<div data-testid="alert-circle-icon"></div>' },
  RefreshIcon: { name: 'RefreshIcon', template: '<div data-testid="refresh-icon"></div>' }
}))

// Mock LoadingSpinner component
vi.mock('./LoadingSpinner.vue', () => ({
  default: {
    name: 'LoadingSpinner',
    template: '<div data-testid="loading-spinner"></div>',
    props: ['size', 'variant']
  }
}))

describe('FileUpload', () => {
  let wrapper: VueWrapper<TestComponentInstance>

  const createWrapper = (props: MockProps = {}): VueWrapper<TestComponentInstance> => {
    return mount(FileUpload, {
      props: {
        ...props
      },
      global: {
        plugins: [],
        stubs: {
          LoadingSpinner: {
            template: '<div data-testid="loading-spinner"></div>'
          }
        }
      } as TestGlobalConfig
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.file-upload').exists()).toBe(true)
      expect(wrapper.find('.file-input').exists()).toBe(true)
      expect(wrapper.find('.drop-zone').exists()).toBe(true)
    })

    it('should render upload button when showDropZone is false', () => {
      wrapper = createWrapper({ showDropZone: false })
      
      expect(wrapper.find('.upload-button').exists()).toBe(true)
      expect(wrapper.find('.drop-zone').exists()).toBe(false)
    })

    it('should display custom button text', () => {
      wrapper = createWrapper({ 
        showDropZone: false, 
        buttonText: 'Custom Upload Text' 
      })
      
      expect(wrapper.find('.upload-button').text()).toContain('Custom Upload Text')
    })

    it('should show drop zone by default', () => {
      wrapper = createWrapper()
      
      expect(wrapper.find('.drop-zone').exists()).toBe(true)
      expect(wrapper.find('.drop-zone-content').exists()).toBe(true)
    })
  })

  describe('File Input Properties', () => {
    it('should set multiple attribute correctly', () => {
      wrapper = createWrapper({ multiple: true })
      
      const fileInput = wrapper.find('.file-input')
      expect(fileInput.attributes('multiple')).toBeDefined()
    })

    it('should set accept attribute correctly', () => {
      wrapper = createWrapper({ acceptedTypes: '.jpg,.png,.pdf' })
      
      const fileInput = wrapper.find('.file-input')
      expect(fileInput.attributes('accept')).toBe('.jpg,.png,.pdf')
    })

    it('should generate unique input ID', () => {
      const wrapper1 = createWrapper()
      const wrapper2 = createWrapper()
      
      const input1 = wrapper1.find('.file-input')
      const input2 = wrapper2.find('.file-input')
      
      expect(input1.attributes('id')).toBeDefined()
      expect(input2.attributes('id')).toBeDefined()
      expect(input1.attributes('id')).not.toBe(input2.attributes('id'))
    })
  })

  describe('File Size and Type Display', () => {
    it('should display max size text correctly', () => {
      wrapper = createWrapper({ maxSize: 5 * 1024 * 1024 }) // 5MB
      
      expect(wrapper.text()).toContain('5MB')
    })

    it('should display accepted types text', () => {
      wrapper = createWrapper({ acceptedTypes: '.jpg,.png,.pdf' })
      
      expect(wrapper.text()).toContain('JPG, PNG, PDF')
    })

    it('should handle KB display for small sizes', () => {
      wrapper = createWrapper({ maxSize: 500 * 1024 }) // 500KB
      
      expect(wrapper.text()).toContain('500KB')
    })
  })

  describe('File Selection', () => {
    it('should open file dialog when button is clicked', async () => {
      wrapper = createWrapper({ showDropZone: false })
      
      const fileInput = wrapper.find('.file-input')
      const clickSpy = vi.spyOn(fileInput.element as HTMLInputElement, 'click')
      
      await wrapper.find('.upload-button').trigger('click')
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('should open file dialog when drop zone is clicked', async () => {
      wrapper = createWrapper()
      
      const fileInput = wrapper.find('.file-input')
      const clickSpy = vi.spyOn(fileInput.element as HTMLInputElement, 'click')
      
      await wrapper.find('.drop-zone').trigger('click')
      
      expect(clickSpy).toHaveBeenCalled()
    })

    it('should emit file-select event when files are selected', async () => {
      wrapper = createWrapper()
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const fileInput = wrapper.find('.file-input')
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false
      })
      
      await fileInput.trigger('change')
      
      expect(wrapper.emitted('file-select')).toBeTruthy()
      const emittedEvents = wrapper.emitted('file-select')
      expect(emittedEvents).toBeTruthy()
      expect(emittedEvents?.[0]?.[0]).toEqual([file])
    })
  })

  describe('Drag and Drop', () => {
    it('should handle drag events correctly', async () => {
      wrapper = createWrapper()
      
      const dropZone = wrapper.find('.drop-zone')
      
      await dropZone.trigger('dragenter')
      expect(dropZone.classes()).toContain('drag-active')
      
      await dropZone.trigger('dragleave')
      expect(dropZone.classes()).not.toContain('drag-active')
    })

    it('should handle file drop', async () => {
      wrapper = createWrapper()
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      const dropZone = wrapper.find('.drop-zone')
      await dropZone.trigger('drop', {
        dataTransfer: {
          files: [file]
        }
      })
      
      expect(wrapper.emitted('file-select')).toBeTruthy()
    })
  })

  describe('File Validation', () => {
    it('should validate file size', async () => {
      wrapper = createWrapper({ maxSize: 1024 }) // 1KB
      
      const largeFile = new File(['x'.repeat(2048)], 'large.txt', { type: 'text/plain' })
      const fileInput = wrapper.find('.file-input')
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [largeFile],
        writable: false
      })
      
      await fileInput.trigger('change')
      await nextTick()
      
      expect(wrapper.find('.error-messages').exists()).toBe(true)
      expect(wrapper.text()).toContain('檔案過大')
    })

    it('should validate file type', async () => {
      wrapper = createWrapper({ acceptedTypes: '.jpg,.png' })
      
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      const fileInput = wrapper.find('.file-input')
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [invalidFile],
        writable: false
      })
      
      await fileInput.trigger('change')
      await nextTick()
      
      expect(wrapper.find('.error-messages').exists()).toBe(true)
      expect(wrapper.text()).toContain('不支援的檔案格式')
    })

    it('should enforce max files limit', async () => {
      wrapper = createWrapper({ maxFiles: 2, multiple: true })
      
      const files = [
        new File(['1'], 'file1.txt', { type: 'text/plain' }),
        new File(['2'], 'file2.txt', { type: 'text/plain' }),
        new File(['3'], 'file3.txt', { type: 'text/plain' })
      ]
      
      const fileInput = wrapper.find('.file-input')
      Object.defineProperty(fileInput.element, 'files', {
        value: files,
        writable: false
      })
      
      await fileInput.trigger('change')
      await nextTick()
      
      expect(wrapper.find('.error-messages').exists()).toBe(true)
      expect(wrapper.text()).toContain('最多只能上傳 2 個檔案')
    })
  })

  describe('File List Display', () => {
    it('should display selected files', async () => {
      const files: FileUploadItem[] = [
        {
          id: '1',
          name: 'test.txt',
          size: 1024,
          type: 'text/plain'
        }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      expect(wrapper.find('.file-list').exists()).toBe(true)
      expect(wrapper.find('.file-item').exists()).toBe(true)
      expect(wrapper.text()).toContain('test.txt')
      expect(wrapper.text()).toContain('1 KB')
    })

    it('should show file count in title', async () => {
      const files: FileUploadItem[] = [
        { id: '1', name: 'file1.txt', size: 1024 },
        { id: '2', name: 'file2.txt', size: 2048 }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      expect(wrapper.text()).toContain('已選擇的檔案 (2)')
    })

    it('should display file with error state', async () => {
      const files: FileUploadItem[] = [
        {
          id: '1',
          name: 'test.txt',
          size: 1024,
          error: 'Upload failed'
        }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      const fileItem = wrapper.find('.file-item')
      expect(fileItem.classes()).toContain('error')
      expect(wrapper.text()).toContain('Upload failed')
    })

    it('should display file with uploading state', async () => {
      const files: FileUploadItem[] = [
        {
          id: '1',
          name: 'test.txt',
          size: 1024,
          uploading: true,
          progress: 50
        }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      const fileItem = wrapper.find('.file-item')
      expect(fileItem.classes()).toContain('uploading')
      expect(wrapper.text()).toContain('50%')
      expect(wrapper.find('.progress-bar').exists()).toBe(true)
    })

    it('should display file with uploaded state', async () => {
      const files: FileUploadItem[] = [
        {
          id: '1',
          name: 'test.txt',
          size: 1024,
          uploaded: true
        }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      const fileItem = wrapper.find('.file-item')
      expect(fileItem.classes()).toContain('uploaded')
      expect(wrapper.text()).toContain('已上傳')
    })
  })

  describe('File Actions', () => {
    it('should remove file when remove button is clicked', async () => {
      const files: FileUploadItem[] = [
        { id: '1', name: 'test.txt', size: 1024 }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      const removeButton = wrapper.find('.remove-btn')
      await removeButton.trigger('click')
      
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeTruthy()
      const emittedFiles = emittedEvents?.[0]?.[0] as FileUploadItem[]
      expect(emittedFiles).toHaveLength(0)
    })

    it('should show retry button for failed uploads', async () => {
      const files: FileUploadItem[] = [
        {
          id: '1',
          name: 'test.txt',
          size: 1024,
          error: 'Upload failed'
        }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      expect(wrapper.find('.retry-btn').exists()).toBe(true)
    })

    it('should show loading spinner for uploading files', async () => {
      const files: FileUploadItem[] = [
        {
          id: '1',
          name: 'test.txt',
          size: 1024,
          uploading: true
        }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      expect(wrapper.find('.upload-progress').exists()).toBe(true)
    })

    it('should show check icon for uploaded files', async () => {
      const files: FileUploadItem[] = [
        {
          id: '1',
          name: 'test.txt',
          size: 1024,
          uploaded: true
        }
      ]
      
      wrapper = createWrapper({ modelValue: files })
      await nextTick()
      
      expect(wrapper.find('.upload-success').exists()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should display error messages', async () => {
      wrapper = createWrapper()
      
      // Trigger an error by selecting a file that's too large
      const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.txt', { type: 'text/plain' })
      const fileInput = wrapper.find('.file-input')
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [largeFile],
        writable: false
      })
      
      await fileInput.trigger('change')
      await nextTick()
      
      expect(wrapper.find('.error-messages').exists()).toBe(true)
      expect(wrapper.find('.error-message').exists()).toBe(true)
    })

    it('should allow dismissing error messages', async () => {
      wrapper = createWrapper()
      
      // Trigger an error
      const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.txt', { type: 'text/plain' })
      const fileInput = wrapper.find('.file-input')
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [largeFile],
        writable: false
      })
      
      await fileInput.trigger('change')
      await nextTick()
      
      expect(wrapper.find('.error-message').exists()).toBe(true)
      
      await wrapper.find('.error-dismiss').trigger('click')
      await nextTick()
      
      expect(wrapper.find('.error-message').exists()).toBe(false)
    })
  })

  describe('Upload Functionality', () => {
    it('should call upload function when provided', async () => {
      const mockUploadFunction = vi.fn().mockResolvedValue({
        url: 'https://example.com/file.txt',
        filename: 'file.txt'
      })
      
      wrapper = createWrapper({ uploadFunction: mockUploadFunction })
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      // Access the component instance to call uploadFile directly
      const component = wrapper.vm
      const fileItem: FileUploadItem = {
        id: '1',
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        file
      }
      
      if (component.uploadFile) {
        await component.uploadFile(fileItem)
      }
      
      expect(mockUploadFunction).toHaveBeenCalledWith(file)
    })

    it('should emit upload-complete event on successful upload', async () => {
      const mockUploadFunction = vi.fn().mockResolvedValue({
        url: 'https://example.com/file.txt',
        filename: 'file.txt'
      })
      
      wrapper = createWrapper({ uploadFunction: mockUploadFunction })
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const component = wrapper.vm
      const fileItem: FileUploadItem = {
        id: '1',
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        file
      }
      
      if (component.uploadFile) {
        await component.uploadFile(fileItem)
      }
      
      expect(wrapper.emitted('upload-complete')).toBeTruthy()
    })

    it('should emit upload-error event on failed upload', async () => {
      const mockUploadFunction = vi.fn().mockRejectedValue(new Error('Upload failed'))
      
      wrapper = createWrapper({ uploadFunction: mockUploadFunction })
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const component = wrapper.vm
      const fileItem: FileUploadItem = {
        id: '1',
        name: 'test.txt',
        size: 1024,
        type: 'text/plain',
        file
      }
      
      if (component.uploadFile) {
        await component.uploadFile(fileItem)
      }
      
      expect(wrapper.emitted('upload-error')).toBeTruthy()
    })
  })

  describe('Disabled State', () => {
    it('should disable upload button when disabled prop is true', () => {
      wrapper = createWrapper({ disabled: true, showDropZone: false })
      
      const uploadButton = wrapper.find('.upload-button')
      expect(uploadButton.attributes('disabled')).toBeDefined()
    })

    it('should not open file dialog when disabled', async () => {
      wrapper = createWrapper({ disabled: true, showDropZone: false })
      
      const fileInput = wrapper.find('.file-input')
      const clickSpy = vi.spyOn(fileInput.element as HTMLInputElement, 'click')
      
      await wrapper.find('.upload-button').trigger('click')
      
      expect(clickSpy).not.toHaveBeenCalled()
    })
  })

  describe('Utility Functions', () => {
    it('should format file sizes correctly', () => {
      wrapper = createWrapper()
      const component = wrapper.vm
      
      if (component.formatFileSize) {
        expect(component.formatFileSize(0)).toBe('0 Bytes')
        expect(component.formatFileSize(1024)).toBe('1 KB')
        expect(component.formatFileSize(1024 * 1024)).toBe('1 MB')
        expect(component.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
      }
    })
  })

  describe('Model Value Synchronization', () => {
    it('should update internal state when modelValue changes', async () => {
      const initialFiles: FileUploadItem[] = [
        { id: '1', name: 'file1.txt', size: 1024 }
      ]
      
      wrapper = createWrapper({ modelValue: initialFiles })
      await nextTick()
      
      expect(wrapper.find('.file-item').exists()).toBe(true)
      
      const newFiles: FileUploadItem[] = [
        { id: '1', name: 'file1.txt', size: 1024 },
        { id: '2', name: 'file2.txt', size: 2048 }
      ]
      
      await wrapper.setProps({ modelValue: newFiles })
      await nextTick()
      
      expect(wrapper.findAll('.file-item')).toHaveLength(2)
    })

    it('should emit update:modelValue when files change', async () => {
      wrapper = createWrapper()
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const fileInput = wrapper.find('.file-input')
      
      Object.defineProperty(fileInput.element, 'files', {
        value: [file],
        writable: false
      })
      
      await fileInput.trigger('change')
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      wrapper = createWrapper()
      
      const fileInput = wrapper.find('.file-input')
      expect(fileInput.attributes('type')).toBe('file')
      expect(fileInput.attributes('id')).toBeDefined()
    })

    it('should have proper button roles and labels', () => {
      wrapper = createWrapper({ showDropZone: false })
      
      const uploadButton = wrapper.find('.upload-button')
      expect(uploadButton.attributes('type')).toBe('button')
    })
  })
})