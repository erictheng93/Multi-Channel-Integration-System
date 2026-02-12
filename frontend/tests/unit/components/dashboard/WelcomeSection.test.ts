/**
 * Unit Tests for WelcomeSection Component
 *
 * @module tests/unit/components/dashboard/WelcomeSection.test
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WelcomeSection from '@/components/dashboard/WelcomeSection.vue'

// Stub child components
const PrimaryActionButtonStub = {
  name: 'PrimaryActionButton',
  template: '<button class="primary-action-button" @click="$emit(\'click\')">{{ text }}</button>',
  props: ['text', 'icon', 'to']
}

const RefreshButtonStub = {
  name: 'RefreshButton',
  template: '<button class="refresh-button" @click="$emit(\'refresh\')" :disabled="loading">Refresh</button>',
  props: ['loading']
}

describe('WelcomeSection', () => {
  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '张三',
          currentDate: '2025年1月5日 星期日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-section').exists()).toBe(true)
      expect(wrapper.find('.welcome-content').exists()).toBe(true)
      expect(wrapper.find('.welcome-greeting').exists()).toBe(true)
      expect(wrapper.find('.welcome-actions').exists()).toBe(true)
    })

    it('应该显示欢迎消息', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '张三',
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const title = wrapper.find('.welcome-title')
      expect(title.text()).toBe('歡迎，张三')
    })

    it('应该显示当前日期', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '张三',
          currentDate: '2025年1月5日 星期日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const subtitle = wrapper.find('.welcome-subtitle')
      expect(subtitle.text()).toBe('2025年1月5日 星期日')
    })

    it('应该渲染操作按钮', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.primary-action-button').exists()).toBe(true)
      expect(wrapper.find('.refresh-button').exists()).toBe(true)
    })
  })

  describe('欢迎消息', () => {
    it('应该使用默认欢迎前缀', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '李四',
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toBe('歡迎，李四')
    })

    it('应该支持自定义欢迎前缀', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '王五',
          currentDate: '2025年1月5日',
          welcomePrefix: 'Hello'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toBe('Hello，王五')
    })

    it('应该使用默认用户名', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toBe('歡迎，載入中...')
    })

    it('应该处理空用户名', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '',
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toBe('歡迎，')
    })
  })

  describe('加载状态', () => {
    it('应该将加载状态传递给刷新按钮', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日',
          loading: true
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const refreshButton = wrapper.findComponent(RefreshButtonStub)
      expect(refreshButton.props('loading')).toBe(true)
    })

    it('默认不应该处于加载状态', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const refreshButton = wrapper.findComponent(RefreshButtonStub)
      expect(refreshButton.props('loading')).toBe(false)
    })
  })

  describe('事件处理', () => {
    it('应该触发刷新事件', async () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const refreshButton = wrapper.findComponent(RefreshButtonStub)
      await refreshButton.trigger('refresh')

      expect(wrapper.emitted('refresh')).toBeTruthy()
      expect(wrapper.emitted('refresh')).toHaveLength(1)
    })

    it('应该在多次点击刷新按钮时触发多个事件', async () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const refreshButton = wrapper.findComponent(RefreshButtonStub)

      await refreshButton.trigger('refresh')
      await refreshButton.trigger('refresh')
      await refreshButton.trigger('refresh')

      expect(wrapper.emitted('refresh')).toHaveLength(3)
    })
  })

  describe('按钮配置', () => {
    it('主操作按钮应该有正确的文本', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const primaryButton = wrapper.findComponent(PrimaryActionButtonStub)
      expect(primaryButton.props('text')).toBe('查看對話')
    })

    it('主操作按钮应该导航到对话页面', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const primaryButton = wrapper.findComponent(PrimaryActionButtonStub)
      expect(primaryButton.props('to')).toBe('/conversations')
    })

    it('主操作按钮应该有图标', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const primaryButton = wrapper.findComponent(PrimaryActionButtonStub)
      expect(primaryButton.props('icon')).toBeDefined()
    })
  })

  describe('DOM 结构', () => {
    it('应该有正确的嵌套结构', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const section = wrapper.find('.welcome-section')
      expect(section.exists()).toBe(true)

      const content = section.find('.welcome-content')
      expect(content.exists()).toBe(true)

      const greeting = content.find('.welcome-greeting')
      const actions = content.find('.welcome-actions')
      expect(greeting.exists()).toBe(true)
      expect(actions.exists()).toBe(true)
    })

    it('greeting 应该在 actions 之前', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      const content = wrapper.find('.welcome-content')
      const children = Array.from(content.element.children)
      const greetingIndex = children.findIndex(el => el.classList.contains('welcome-greeting'))
      const actionsIndex = children.findIndex(el => el.classList.contains('welcome-actions'))

      expect(greetingIndex).toBeLessThan(actionsIndex)
    })
  })

  describe('响应式更新', () => {
    it('应该在用户名更新时重新渲染', async () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '张三',
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toBe('歡迎，张三')

      await wrapper.setProps({ userName: '李四' })
      expect(wrapper.find('.welcome-title').text()).toBe('歡迎，李四')
    })

    it('应该在日期更新时重新渲染', async () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-subtitle').text()).toBe('2025年1月5日')

      await wrapper.setProps({ currentDate: '2025年1月6日' })
      expect(wrapper.find('.welcome-subtitle').text()).toBe('2025年1月6日')
    })

    it('应该在加载状态更新时重新渲染', async () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日',
          loading: false
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      let refreshButton = wrapper.findComponent(RefreshButtonStub)
      expect(refreshButton.props('loading')).toBe(false)

      await wrapper.setProps({ loading: true })
      refreshButton = wrapper.findComponent(RefreshButtonStub)
      expect(refreshButton.props('loading')).toBe(true)
    })

    it('应该在欢迎前缀更新时重新渲染', async () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '张三',
          currentDate: '2025年1月5日',
          welcomePrefix: '你好'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toBe('你好，张三')

      await wrapper.setProps({ welcomePrefix: 'Hello' })
      expect(wrapper.find('.welcome-title').text()).toBe('Hello，张三')
    })
  })

  describe('边界情况', () => {
    it('应该处理超长用户名', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '这是一个非常非常非常非常非常长的用户名用于测试边界情况处理',
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toContain('这是一个非常非常非常非常非常长的用户名用于测试边界情况处理')
    })

    it('应该处理超长日期', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: '2025年1月5日 星期日 北京时间 上午10:30:45'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-subtitle').text()).toBe('2025年1月5日 星期日 北京时间 上午10:30:45')
    })

    it('应该处理特殊字符在用户名中', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '张<>&"\'三',
          currentDate: '2025年1月5日'
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').exists()).toBe(true)
    })

    it('应该处理空日期字符串', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          currentDate: ''
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-subtitle').text()).toBe('')
    })

    it('应该处理空欢迎前缀', () => {
      const wrapper = mount(WelcomeSection, {
        props: {
          userName: '张三',
          currentDate: '2025年1月5日',
          welcomePrefix: ''
        },
        global: {
          stubs: {
            PrimaryActionButton: PrimaryActionButtonStub,
            RefreshButton: RefreshButtonStub
          }
        }
      })

      expect(wrapper.find('.welcome-title').text()).toBe('，张三')
    })
  })
})
