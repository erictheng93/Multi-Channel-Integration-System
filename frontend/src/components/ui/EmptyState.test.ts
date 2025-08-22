// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/components/ui/EmptyState.test.ts
// Created by: Component Test Developer

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import EmptyState from './EmptyState.vue'

describe('EmptyState Component', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createWrapper = (props = {}) => {
    return mount(EmptyState, {
      props: {
        title: '沒有資料',
        description: '目前沒有任何資料可顯示',
        ...props
      },
      global: {
        plugins: [pinia]
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render empty state component', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })

    it('should display title', () => {
      const wrapper = createWrapper({ title: '沒有對話' })

      expect(wrapper.find('.empty-title').text()).toBe('沒有對話')
    })

    it('should display description', () => {
      const wrapper = createWrapper({ 
        description: '目前沒有任何對話記錄' 
      })

      expect(wrapper.find('.empty-description').text()).toBe('目前沒有任何對話記錄')
    })
  })

  describe('Action Button', () => {
    it('should show action button when actionText is provided', () => {
      const wrapper = createWrapper({ 
        actionText: '新增對話'
      })

      expect(wrapper.find('.empty-action').exists()).toBe(true)
      expect(wrapper.find('.empty-action').text()).toBe('新增對話')
    })

    it('should not show action button when actionText is not provided', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.empty-action').exists()).toBe(false)
    })

    it('should emit action event when action button is clicked', async () => {
      const wrapper = createWrapper({ 
        actionText: '新增對話'
      })

      await wrapper.find('.empty-action').trigger('click')

      expect(wrapper.emitted('action')).toBeTruthy()
    })

    it('should disable action button when loading', () => {
      const wrapper = createWrapper({ 
        actionText: '新增對話',
        loading: true
      })

      // When loading is true, the action button should not be rendered
      // Instead, only the loading spinner should be visible
      expect(wrapper.find('.empty-action').exists()).toBe(false)
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      const wrapper = createWrapper({ 
        loading: true
      })

      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    })

    it('should not show loading spinner when not loading', () => {
      const wrapper = createWrapper({ 
        loading: false
      })

      expect(wrapper.find('.loading-spinner').exists()).toBe(false)
    })

    it('should show loading text when loading', () => {
      const wrapper = createWrapper({ 
        loading: true,
        loadingText: '載入中...'
      })

      expect(wrapper.text()).toContain('載入中...')
    })
  })

  describe('Size Variants', () => {
    it('should render small size variant', () => {
      const wrapper = createWrapper({ 
        size: 'small'
      })

      expect(wrapper.find('.empty-state').classes()).toContain('small')
    })

    it('should render medium size variant (default)', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.empty-state').classes()).toContain('medium')
    })

    it('should render large size variant', () => {
      const wrapper = createWrapper({ 
        size: 'large'
      })

      expect(wrapper.find('.empty-state').classes()).toContain('large')
    })
  })

  describe('Custom Content', () => {
    it('should render custom content in default slot', () => {
      const wrapper = mount(EmptyState, {
        props: {
          title: '沒有資料'
        },
        slots: {
          default: '<div class="custom-content">自定義內容</div>'
        },
        global: {
          plugins: [createPinia()]
        }
      })

      expect(wrapper.find('.custom-content').exists()).toBe(true)
      expect(wrapper.find('.custom-content').text()).toBe('自定義內容')
    })

    it('should render custom action in action slot', () => {
      const wrapper = mount(EmptyState, {
        props: {
          title: '沒有資料'
        },
        slots: {
          action: '<button class="custom-action">自定義按鈕</button>'
        },
        global: {
          plugins: [createPinia()]
        }
      })

      expect(wrapper.find('.custom-action').exists()).toBe(true)
      expect(wrapper.find('.custom-action').text()).toBe('自定義按鈕')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing title gracefully', () => {
      const wrapper = createWrapper({ 
        title: undefined,
        description: '描述文字'
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-description').text()).toBe('描述文字')
    })

    it('should handle missing description gracefully', () => {
      const wrapper = createWrapper({ 
        title: '標題',
        description: undefined
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-title').text()).toBe('標題')
    })
  })
})