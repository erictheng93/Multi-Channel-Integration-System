/**
 * Tests for SafeHtmlRenderer component
 *
 * This component sanitizes HTML content using a whitelist-based approach.
 * These tests verify that the sanitization works correctly, especially
 * for the newly added anchor tag support for URL linkification.
 *
 * @module tests/unit/components/ui/SafeHtmlRenderer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import SafeHtmlRenderer from '@/components/ui/SafeHtmlRenderer.vue'

describe('SafeHtmlRenderer', () => {
  let wrapper: VueWrapper | null = null

  afterEach(async () => {
    await flushPromises()
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    document.body.innerHTML = ''
  })

  describe('Basic Rendering', () => {
    it('should render plain text', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: 'Hello World'
        }
      })

      await flushPromises()

      expect(wrapper.text()).toContain('Hello World')
    })

    it('should render allowed span tags', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<span class="test">Styled text</span>'
        }
      })

      await flushPromises()

      const span = wrapper.find('span.test')
      expect(span.exists()).toBe(true)
      expect(span.text()).toBe('Styled text')
    })

    it('should render allowed div tags', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<div class="container">Content</div>'
        }
      })

      await flushPromises()

      const div = wrapper.find('.safe-html-container .container')
      expect(div.exists()).toBe(true)
    })
  })

  describe('Link (Anchor Tag) Rendering', () => {
    it('should render anchor tags with valid https href', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://example.com')
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
      expect(link.text()).toBe('Link')
    })

    it('should render anchor tags with valid http href', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="http://example.com">HTTP Link</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('http://example.com')
    })

    it('should preserve class attribute on anchor tags', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="https://example.com" class="message-link">Styled Link</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a.message-link')
      expect(link.exists()).toBe(true)
    })

    it('should preserve title attribute on anchor tags', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="https://example.com" title="Click to visit">Link with Title</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.attributes('title')).toBe('Click to visit')
    })
  })

  describe('Security - Invalid href Protocols', () => {
    it('should strip javascript: href (XSS prevention)', async () => {
      // This test verifies the sanitizer blocks javascript: protocol
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="javascript:void(0)">Safe Text</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      // href should be stripped (not present) - sanitizer blocks dangerous protocols
      expect(link.attributes('href')).toBeUndefined()
    })

    it('should strip data: href (XSS prevention)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="data:text/plain,test">Data Link</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBeUndefined()
    })

    it('should strip file: href (security)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="file:///home/user">Local File</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBeUndefined()
    })
  })

  describe('Security - Disallowed Tags', () => {
    it('should strip script tags (XSS prevention)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<script>console.log("test")</script>'
        }
      })

      await flushPromises()

      const script = wrapper.find('script')
      expect(script.exists()).toBe(false)
    })

    it('should strip iframe tags (security)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<iframe src="https://example.com"></iframe>'
        }
      })

      await flushPromises()

      const iframe = wrapper.find('iframe')
      expect(iframe.exists()).toBe(false)
    })

    it('should strip form tags (security)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<form action="https://example.com"><input type="text"></form>'
        }
      })

      await flushPromises()

      const form = wrapper.find('form')
      expect(form.exists()).toBe(false)
    })

    it('should strip button tags', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<button type="button">Click</button>'
        }
      })

      await flushPromises()

      const button = wrapper.find('button')
      expect(button.exists()).toBe(false)
    })
  })

  describe('Security - Disallowed Attributes', () => {
    it('should strip onclick attribute (XSS prevention)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="https://example.com" onclick="console.log(1)">Link</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('onclick')).toBeUndefined()
    })

    it('should strip onerror attribute (XSS prevention)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<img src="https://example.com/img.png" onerror="console.log(1)">'
        }
      })

      await flushPromises()

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('onerror')).toBeUndefined()
    })

    it('should strip onload attribute (XSS prevention)', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<img src="https://example.com/img.png" onload="console.log(1)">'
        }
      })

      await flushPromises()

      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('onload')).toBeUndefined()
    })
  })

  describe('Mixed Content', () => {
    it('should render multiple links with text between them', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: 'Visit <a href="https://google.com" target="_blank">Google</a> or <a href="https://github.com" target="_blank">GitHub</a> for info'
        }
      })

      await flushPromises()

      const links = wrapper.findAll('a')
      expect(links.length).toBe(2)
      expect(links[0].attributes('href')).toBe('https://google.com')
      expect(links[1].attributes('href')).toBe('https://github.com')
      expect(wrapper.text()).toContain('Visit')
      expect(wrapper.text()).toContain('or')
      expect(wrapper.text()).toContain('for info')
    })

    it('should render link with emoji span', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<span class="emoji">thumbs up</span> Check out <a href="https://example.com" target="_blank">this link</a>'
        }
      })

      await flushPromises()

      const emoji = wrapper.find('span.emoji')
      const link = wrapper.find('a')

      expect(emoji.exists()).toBe(true)
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://example.com')
    })
  })

  describe('URL with Special Characters', () => {
    it('should handle URL with encoded characters', async () => {
      const encodedUrl = 'https://apps.apple.com/tw/app/sugo-%E7%B7%9A%E4%B8%8A%E4%BA%A4%E5%8F%8B%E6%B4%BE%E5%B0%8D/id1574436604'
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: `<a href="${encodedUrl}" target="_blank" rel="noopener noreferrer" class="message-link">${encodedUrl}</a>`
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe(encodedUrl)
    })

    it('should handle URL with query parameters', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: '<a href="https://example.com/search?q=test&lang=en" target="_blank">Search</a>'
        }
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.attributes('href')).toBe('https://example.com/search?q=test&lang=en')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty html', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: ''
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toBe('')
    })

    it('should update when html prop changes', async () => {
      wrapper = mount(SafeHtmlRenderer, {
        props: {
          html: 'Original'
        }
      })

      await flushPromises()
      expect(wrapper.text()).toContain('Original')

      await wrapper.setProps({
        html: '<a href="https://example.com" target="_blank">New Link</a>'
      })

      await flushPromises()

      const link = wrapper.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://example.com')
    })
  })
})
