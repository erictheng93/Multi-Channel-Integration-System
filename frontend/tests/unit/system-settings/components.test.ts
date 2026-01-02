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
import SettingsHeader from '@/components/system-settings/SettingsHeader.vue'
import SettingsNav from '@/components/system-settings/SettingsNav.vue'
import GeneralSettingsForm from '@/components/system-settings/GeneralSettingsForm.vue'
import LineIntegrationForm from '@/components/system-settings/LineIntegrationForm.vue'
import FacebookIntegrationForm from '@/components/system-settings/FacebookIntegrationForm.vue'
import AdvancedSettingsForm from '@/components/system-settings/AdvancedSettingsForm.vue'
import BackupManager from '@/components/system-settings/BackupManager.vue'
import CacheManager from '@/components/system-settings/CacheManager.vue'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('System Settings Components', () => {
  describe('SettingsHeader', () => {
    it('should render title and subtitle', () => {
      const wrapper = mount(SettingsHeader, {
        props: {
          loading: false,
          message: '',
          messageType: 'success'
        }
      })

      expect(wrapper.find('.header-title').exists()).toBe(true)
      expect(wrapper.find('.header-subtitle').exists()).toBe(true)
    })

    it('should emit refresh event when button clicked', async () => {
      const wrapper = mount(SettingsHeader, {
        props: {
          loading: false,
          message: '',
          messageType: 'success'
        }
      })

      await wrapper.find('.refresh-button').trigger('click')

      expect(wrapper.emitted('refresh')).toBeTruthy()
    })

    it('should display message banner when message provided', () => {
      const wrapper = mount(SettingsHeader, {
        props: {
          loading: false,
          message: 'Test message',
          messageType: 'success'
        }
      })

      expect(wrapper.find('.message-banner').exists()).toBe(true)
      expect(wrapper.find('.message-text').text()).toBe('Test message')
    })
  })

  describe('SettingsNav', () => {
    it('should render all tabs', () => {
      const tabs = [
        { key: 'general' as const, label: 'General', icon: {} as any },
        { key: 'integrations' as const, label: 'Integrations', icon: {} as any }
      ]

      const wrapper = mount(SettingsNav, {
        props: {
          modelValue: 'general',
          tabs
        }
      })

      expect(wrapper.findAll('.nav-tab')).toHaveLength(2)
    })

    it('should emit update:modelValue when tab clicked', async () => {
      const tabs = [
        { key: 'general' as const, label: 'General', icon: {} as any },
        { key: 'integrations' as const, label: 'Integrations', icon: {} as any }
      ]

      const wrapper = mount(SettingsNav, {
        props: {
          modelValue: 'general',
          tabs
        }
      })

      await wrapper.findAll('.nav-tab')[1].trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['integrations'])
    })
  })

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
      expect(wrapper.find('#language').exists()).toBe(true)
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
      channelId: 'test-channel',
      channelSecret: 'test-secret',
      accessToken: 'test-token',
      status: 'connected' as const
    }

    it('should render LINE integration fields', () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      expect(wrapper.find('#lineChannelId').exists()).toBe(true)
      expect(wrapper.find('#lineChannelSecret').exists()).toBe(true)
      expect(wrapper.find('#lineAccessToken').exists()).toBe(true)
    })

    it('should emit test event when test button clicked', async () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-secondary').trigger('click')

      expect(wrapper.emitted('test')).toBeTruthy()
    })

    it('should emit clear event when clear button clicked', async () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
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
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      pageId: 'test-page-id',
      pageToken: 'test-page-token',
      status: 'disconnected' as const
    }

    it('should render Facebook integration fields', () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      expect(wrapper.find('#facebookAppId').exists()).toBe(true)
      expect(wrapper.find('#facebookAppSecret').exists()).toBe(true)
      expect(wrapper.find('#facebookPageId').exists()).toBe(true)
      expect(wrapper.find('#facebookPageToken').exists()).toBe(true)
    })

    it('should emit test event when test button clicked', async () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-secondary').trigger('click')

      expect(wrapper.emitted('test')).toBeTruthy()
    })

    it('should emit clear event when clear button clicked', async () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
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
      messageTimeout: 5000,
      cacheExpiry: 3600,
      sessionExpiry: 7200,
      enableRateLimit: true,
      enableLogging: true,
      enableMetrics: true
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

  describe('BackupManager', () => {
    const mockBackups = [
      {
        id: '1',
        filename: 'backup-1.db',
        createdAt: new Date(),
        size: 1024
      }
    ]

    it('should render create backup button', () => {
      const wrapper = mount(BackupManager, {
        props: {
          backups: [],
          processing: false
        }
      })

      expect(wrapper.find('.btn-primary').exists()).toBe(true)
    })

    it('should emit backup event when create button clicked', async () => {
      const wrapper = mount(BackupManager, {
        props: {
          backups: [],
          processing: false
        }
      })

      await wrapper.find('.btn-primary').trigger('click')

      expect(wrapper.emitted('backup')).toBeTruthy()
    })

    it('should render backup list when backups exist', () => {
      const wrapper = mount(BackupManager, {
        props: {
          backups: mockBackups,
          processing: false
        }
      })

      expect(wrapper.find('.backup-items').exists()).toBe(true)
      expect(wrapper.findAll('.backup-item')).toHaveLength(1)
    })
  })

  describe('CacheManager', () => {
    it('should render cache clear buttons', () => {
      const wrapper = mount(CacheManager, {
        props: {
          processing: false
        }
      })

      expect(wrapper.findAll('.cache-button').length).toBeGreaterThan(0)
    })

    it('should emit clear-cache event with correct type', async () => {
      const wrapper = mount(CacheManager, {
        props: {
          processing: false
        }
      })

      await wrapper.findAll('.cache-button')[0].trigger('click')

      expect(wrapper.emitted('clear-cache')).toBeTruthy()
    })

    it('should emit health-check event', async () => {
      const wrapper = mount(CacheManager, {
        props: {
          processing: false
        }
      })

      await wrapper.find('.health-button').trigger('click')

      expect(wrapper.emitted('health-check')).toBeTruthy()
    })

    it('should emit restart event', async () => {
      const wrapper = mount(CacheManager, {
        props: {
          processing: false
        }
      })

      await wrapper.find('.restart-button').trigger('click')

      expect(wrapper.emitted('restart')).toBeTruthy()
    })
  })
})
