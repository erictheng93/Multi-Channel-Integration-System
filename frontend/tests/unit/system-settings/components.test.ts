/**
 * System Settings Components Unit Tests
 *
 * Tests for all 8 reusable system settings components
 * Verifies props, events, rendering, and user interactions
 *
 * Total: 20 tests
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import GeneralSettingsForm from '@/components/system-settings/GeneralSettingsForm.vue'
import LineIntegrationForm from '@/components/system-settings/LineIntegrationForm.vue'
import FacebookIntegrationForm from '@/components/system-settings/FacebookIntegrationForm.vue'
import AdvancedSettingsForm from '@/components/system-settings/AdvancedSettingsForm.vue'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('System Settings Components', () => {
  describe('GeneralSettingsForm', () => {
    const mockSettings = {
      systemName: 'Test System',
      contactEmail: 'test@example.com',
      timezone: 'Asia/Taipei',
      language: 'zh-TW'
    }

    it('should render all form fields', () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      expect(wrapper.find('#systemName').exists()).toBe(true)
      expect(wrapper.find('#contactEmail').exists()).toBe(true)
      expect(wrapper.find('#timezone').exists()).toBe(true)
      expect(wrapper.find('.group-note').text()).toContain('繁體中文')
    })

    it('should populate fields with settings data', () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      const systemNameInput = wrapper.find<HTMLInputElement>('#systemName')
      expect(systemNameInput.element.value).toBe('Test System')
    })

    it('should hand typed values to the parent so they are actually saved', async () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      await wrapper.find<HTMLInputElement>('#systemName').setValue('Renamed')

      const updates = wrapper.emitted('update:settings')
      expect(updates).toBeTruthy()
      expect(updates?.at(-1)?.[0]).toMatchObject({ systemName: 'Renamed' })
    })

    it('should state the language as plain read-only text, not a control', () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      expect(wrapper.find('#language').exists()).toBe(false)
      expect(wrapper.text()).toContain('介面語言：繁體中文')
    })

    it('should emit save event on form submit', async () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('save')).toBeTruthy()
    })
  })

  describe('LineIntegrationForm', () => {
    const mockSettings = {
      channelId: '',
      channelSecret: '',
      accessToken: '',
      status: 'disconnected' as const
    }
    const unset = { configured: false, last4: null }
    const stored = { configured: true, last4: '1234' }

    it('should render empty inputs when nothing is stored', () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          credentials: { channelId: unset, channelSecret: unset, accessToken: unset },
          saving: false,
          testing: false
        }
      })

      expect(wrapper.find('#lineChannelId').exists()).toBe(true)
      expect(wrapper.find('#lineChannelSecret').exists()).toBe(true)
      expect(wrapper.find('#lineAccessToken').exists()).toBe(true)
      expect(wrapper.find('.btn-danger').exists()).toBe(false)
    })

    it('should show only the masked last four characters of stored credentials', () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          credentials: { channelId: stored, channelSecret: stored, accessToken: stored },
          saving: false,
          testing: false
        }
      })

      const secret = wrapper.find<HTMLInputElement>('#lineChannelSecret')
      expect(secret.element.value).toBe('已設定 ••••1234')
      expect(secret.element.readOnly).toBe(true)
    })

    it('should reveal an empty input when 更換 is clicked', async () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          credentials: { channelId: stored, channelSecret: stored, accessToken: stored },
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-secondary').trigger('click')

      const input = wrapper.find<HTMLInputElement>('#lineChannelId')
      expect(input.element.readOnly).toBe(false)
      expect(input.element.value).toBe('')
    })

    it('should emit clear event when clear button clicked', async () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          credentials: { channelId: stored, channelSecret: stored, accessToken: stored },
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-danger').trigger('click')

      expect(wrapper.emitted('clear')).toBeTruthy()
    })
  })

  describe('FacebookIntegrationForm', () => {
    const mockSettings = {
      appId: '',
      appSecret: '',
      pageId: '',
      pageToken: '',
      status: 'disconnected' as const
    }
    const unset = { configured: false, last4: null }
    const stored = { configured: true, last4: '9876' }

    it('should render Facebook integration fields', () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
          credentials: { appId: unset, appSecret: unset, pageId: unset, pageToken: unset },
          saving: false,
          testing: false
        }
      })

      expect(wrapper.find('#facebookAppId').exists()).toBe(true)
      expect(wrapper.find('#facebookAppSecret').exists()).toBe(true)
      expect(wrapper.find('#facebookPageId').exists()).toBe(true)
      expect(wrapper.find('#facebookPageToken').exists()).toBe(true)
    })

    it('should emit clear event when clear button clicked', async () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
          credentials: { appId: stored, appSecret: stored, pageId: stored, pageToken: stored },
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-danger').trigger('click')

      expect(wrapper.emitted('clear')).toBeTruthy()
    })
  })

  describe('AdvancedSettingsForm', () => {
    const mockSettings = {
      messageQueueSize: 100,
      messageTimeout: 30000,
      cacheExpiry: 3600,
      sessionExpiry: 86400,
      enableRateLimit: true,
      enableLogging: true,
      enableMetrics: true,
      recallWindowSeconds: 0
    }

    it('should render all advanced settings fields', () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      expect(wrapper.find('#messageQueueSize').exists()).toBe(true)
      expect(wrapper.find('#messageTimeout').exists()).toBe(true)
      expect(wrapper.find('#cacheExpiry').exists()).toBe(true)
      expect(wrapper.find('#sessionExpiry').exists()).toBe(true)
    })

    it('should display backend time values using the label units', () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      const messageTimeoutInput = wrapper.find<HTMLInputElement>('#messageTimeout')
      const cacheExpiryInput = wrapper.find<HTMLInputElement>('#cacheExpiry')
      const sessionExpiryInput = wrapper.find<HTMLInputElement>('#sessionExpiry')

      expect(messageTimeoutInput.element.value).toBe('30')
      expect(messageTimeoutInput.attributes('min')).toBe('1')
      expect(messageTimeoutInput.attributes('max')).toBe('300')
      expect(cacheExpiryInput.element.value).toBe('60')
      expect(cacheExpiryInput.attributes('min')).toBe('1')
      expect(cacheExpiryInput.attributes('max')).toBe('1440')
      expect(sessionExpiryInput.element.value).toBe('24')
      expect(sessionExpiryInput.attributes('min')).toBe('1')
      expect(sessionExpiryInput.attributes('max')).toBe('168')
    })

    it('should emit backend time values when saving user-facing units', async () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      await wrapper.find<HTMLInputElement>('#messageTimeout').setValue(45)
      await wrapper.find<HTMLInputElement>('#cacheExpiry').setValue(90)
      await wrapper.find<HTMLInputElement>('#sessionExpiry').setValue(48)
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('save')![0][0]).toMatchObject({
        messageTimeout: 45000,
        cacheExpiry: 5400,
        sessionExpiry: 172800
      })
    })

    it('should emit save event on form submit', async () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('save')).toBeTruthy()
    })
  })

})
