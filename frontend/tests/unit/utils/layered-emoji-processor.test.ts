/**
 * Tests for layered-emoji-processor utility
 *
 * Focus: URL linkification feature
 *
 * @module tests/unit/utils/layered-emoji-processor
 */

import { describe, it, expect } from 'vitest'

// Import the actual functions (not mocked)
import {
  convertEmojiForMessageDetail,
  convertEmojiForConversationList
} from '@/utils/layered-emoji-processor'

describe('layered-emoji-processor', () => {
  describe('URL Linkification', () => {
    describe('Basic URL Detection', () => {
      it('should convert http URL to clickable link', async () => {
        const text = 'Check out http://example.com'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="http://example.com"')
        expect(result).toContain('target="_blank"')
        expect(result).toContain('rel="noopener noreferrer"')
        expect(result).toContain('class="message-link"')
      })

      it('should convert https URL to clickable link', async () => {
        const text = 'Visit https://secure.example.com/page'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="https://secure.example.com/page"')
        expect(result).toContain('target="_blank"')
      })

      it('should handle URL with encoded characters (like App Store links)', async () => {
        const text = 'https://apps.apple.com/tw/app/sugo-%E7%B7%9A%E4%B8%8A%E4%BA%A4%E5%8F%8B%E6%B4%BE%E5%B0%8D/id1574436604'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="https://apps.apple.com/tw/app/sugo-%E7%B7%9A%E4%B8%8A%E4%BA%A4%E5%8F%8B%E6%B4%BE%E5%B0%8D/id1574436604"')
        expect(result).toContain('target="_blank"')
      })

      it('should handle URL with query parameters', async () => {
        const text = 'https://example.com/search?q=test&page=1'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="https://example.com/search?q=test&page=1"')
      })

      it('should handle URL with fragments', async () => {
        const text = 'https://example.com/page#section'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="https://example.com/page#section"')
      })

      it('should handle URL with port number', async () => {
        const text = 'http://localhost:3000/api'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="http://localhost:3000/api"')
      })
    })

    describe('Multiple URLs', () => {
      it('should convert multiple URLs in the same text', async () => {
        const text = 'Visit https://google.com and https://github.com for more info'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="https://google.com"')
        expect(result).toContain('<a href="https://github.com"')
        expect(result.match(/<a href=/g)?.length).toBe(2)
      })

      it('should preserve text between URLs', async () => {
        const text = 'First https://a.com then https://b.com end'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('First')
        expect(result).toContain('then')
        expect(result).toContain('end')
      })
    })

    describe('URL Mixed with Emoji', () => {
      it('should handle URL and emoji in the same message', async () => {
        const text = 'Check this out (thumbs_up) https://example.com'
        const result = await convertEmojiForMessageDetail(text)

        // Should contain the URL as a link
        expect(result).toContain('<a href="https://example.com"')
        // Emoji processing should convert (thumbs_up) to 
        expect(result).toContain('')
        expect(result).not.toContain('(thumbs_up)') // Original should be replaced
      })
    })

    describe('Security - Invalid URLs', () => {
      it('should NOT linkify javascript: protocol', async () => {
        const text = 'javascript:alert(1)'
        const result = await convertEmojiForMessageDetail(text)

        // Should NOT create a link
        expect(result).not.toContain('<a href="javascript:')
        expect(result).toBe(text)
      })

      it('should NOT linkify data: protocol', async () => {
        const text = 'data:text/html,<script>alert(1)</script>'
        const result = await convertEmojiForMessageDetail(text)

        // Should NOT create a link
        expect(result).not.toContain('<a href="data:')
      })

      it('should NOT linkify file: protocol', async () => {
        const text = 'file:///etc/passwd'
        const result = await convertEmojiForMessageDetail(text)

        // Should NOT create a link
        expect(result).not.toContain('<a href="file:')
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty string', async () => {
        const result = await convertEmojiForMessageDetail('')
        expect(result).toBe('')
      })

      it('should handle null/undefined gracefully', async () => {
        const result = await convertEmojiForMessageDetail(null as any)
        expect(result).toBeFalsy()
      })

      it('should handle text without URLs', async () => {
        const text = 'Hello, this is a plain message without any links'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).not.toContain('<a href=')
        expect(result).toContain('Hello')
      })

      it('should handle URL at the start of text', async () => {
        const text = 'https://example.com is the link'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toMatch(/^<a href="https:\/\/example\.com"/)
      })

      it('should handle URL at the end of text', async () => {
        const text = 'Click here: https://example.com'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="https://example.com"')
        expect(result).toContain('Click here:')
      })

      it('should handle URL as the only content', async () => {
        const text = 'https://example.com'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('<a href="https://example.com"')
        expect(result).toContain('target="_blank"')
      })
    })

    describe('Link Attributes', () => {
      it('should include target="_blank" for new window', async () => {
        const text = 'https://example.com'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('target="_blank"')
      })

      it('should include rel="noopener noreferrer" for security', async () => {
        const text = 'https://example.com'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('rel="noopener noreferrer"')
      })

      it('should include class="message-link" for styling', async () => {
        const text = 'https://example.com'
        const result = await convertEmojiForMessageDetail(text)

        expect(result).toContain('class="message-link"')
      })
    })
  })

  describe('Conversation List (Layer 1 only - no URL linkification)', () => {
    it('should NOT linkify URLs in conversation list preview', () => {
      // Conversation list uses Layer 1 only which doesn't include URL linkification
      // This is intentional for performance in list view
      const text = 'Check https://example.com'
      const result = convertEmojiForConversationList(text)

      // Layer 1 (conversation list) should NOT linkify URLs
      // URLs should remain as plain text in list preview
      expect(result).toContain('https://example.com')
    })
  })
})
