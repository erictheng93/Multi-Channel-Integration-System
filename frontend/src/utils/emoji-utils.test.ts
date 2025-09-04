import { describe, it, expect } from 'vitest'
import { 
  convertEmojiDescriptions, 
  hasEmojiDescriptions, 
  extractEmojiDescriptions 
} from './emoji-utils'

describe('EmojiUtils', () => {
  describe('convertEmojiDescriptions', () => {
    it('should convert single emoji description to emoji', () => {
      const text = 'Hello (flexed biceps) world!'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('Hello 💪 world!')
    })

    it('should convert multiple emoji descriptions', () => {
      const text = '(flexed biceps)(flexed biceps)(hungry)(pleading)(smile)'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('💪💪😋🥺😄')
    })

    it('should handle complex text with mixed emoji descriptions', () => {
      const text = 'I am (hungry) and (smile) today (flexed biceps)'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('I am 😋 and 😄 today 💪')
    })

    it('should handle text without emoji descriptions', () => {
      const text = 'Regular text without emojis'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('Regular text without emojis')
    })

    it('should handle empty string', () => {
      const result = convertEmojiDescriptions('')
      expect(result).toBe('')
    })

    it('should handle unknown emoji descriptions gracefully', () => {
      const text = 'Hello (unknown emoji) world'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('Hello (unknown emoji) world')
    })

    it('should handle multiple spaces in descriptions', () => {
      const text = '(flexed   biceps) and (pleading  face)'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('💪 and 🥺')
    })

    it('should handle uppercase descriptions', () => {
      const text = '(FLEXED BICEPS) and (Hungry)'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('💪 and 😋')
    })

    it('should convert common emoji variants', () => {
      const text = '(thumbs up) (thumbsup) (+1)'
      const result = convertEmojiDescriptions(text)
      expect(result).toBe('👍 👍 👍')
    })
  })

  describe('hasEmojiDescriptions', () => {
    it('should detect emoji descriptions', () => {
      expect(hasEmojiDescriptions('(smile)')).toBe(true)
      expect(hasEmojiDescriptions('Hello (world)')).toBe(true)
      expect(hasEmojiDescriptions('Regular text')).toBe(false)
      expect(hasEmojiDescriptions('')).toBe(false)
    })
  })

  describe('extractEmojiDescriptions', () => {
    it('should extract emoji descriptions', () => {
      const text = 'Hello (smile) and (heart) world'
      const result = extractEmojiDescriptions(text)
      expect(result).toEqual(['smile', 'heart'])
    })

    it('should extract from text with multiple descriptions', () => {
      const text = '(flexed biceps)(hungry)(pleading)'
      const result = extractEmojiDescriptions(text)
      expect(result).toEqual(['flexed biceps', 'hungry', 'pleading'])
    })

    it('should return empty array for text without descriptions', () => {
      const result = extractEmojiDescriptions('Regular text')
      expect(result).toEqual([])
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle the specific case from user screenshot', () => {
      const text = '(flexed biceps)(flexed biceps)(flexed biceps)(flexed biceps)(flexed biceps)(index pointing right)(index pointing right)(index pointing right)(index pointing right)(index pointing right)(index pointing right)(okay)(okay)(okay)(okay)(okay)(hungry)(hungry)(hungry)'
      const result = convertEmojiDescriptions(text)
      
      // Should contain actual emojis instead of descriptions
      expect(result).not.toContain('(flexed biceps)')
      expect(result).not.toContain('(hungry)')
      expect(result).not.toContain('(okay)')
      expect(result).not.toContain('(index pointing right)')
      
      // Should contain the actual emoji characters
      expect(result).toContain('💪')
      expect(result).toContain('😋')
      expect(result).toContain('👉')
      expect(result).toContain('👌')
    })

    it('should handle the second line from user screenshot', () => {
      const text = '(flexed biceps)(okay)(index pointing right)(hungry)(pleading)(smile)'
      const result = convertEmojiDescriptions(text)
      
      expect(result).toBe('💪👌👉😋🥺😄')
    })
  })
})