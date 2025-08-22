// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/utils/format.test.ts
// Created by: Utils Test Developer

import { describe, it, expect } from 'vitest'

// Simple utility functions for testing
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {return '0 B'}
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  
  return `${parseFloat(size.toFixed(1))  } ${  sizes[i]}`
}

export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-TW', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

export const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-TW')
}

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {return text}
  return `${text.substring(0, maxLength)  }...`
}

export const capitalizeFirst = (text: string): string => {
  if (!text) {return text}
  return text.charAt(0).toUpperCase() + text.slice(1)
}

describe('Format Utilities', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1 MB')
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    })

    it('should handle decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    })

    it('should handle large numbers', () => {
      expect(formatFileSize(5 * 1024 * 1024 * 1024)).toBe('5 GB')
    })
  })

  describe('formatTime', () => {
    it('should format time correctly', () => {
      const timestamp = '2024-01-01T14:30:00Z'
      const result = formatTime(timestamp)
      
      // Should contain hour and minute
      expect(result).toMatch(/\d{2}:\d{2}/)
    })

    it('should handle different timestamps', () => {
      const timestamp1 = '2024-01-01T09:15:00Z'
      const timestamp2 = '2024-01-01T23:45:00Z'
      
      const result1 = formatTime(timestamp1)
      const result2 = formatTime(timestamp2)
      
      expect(result1).toMatch(/\d{2}:\d{2}/)
      expect(result2).toMatch(/\d{2}:\d{2}/)
    })
  })

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const timestamp = '2024-01-01T14:30:00Z'
      const result = formatDate(timestamp)
      
      // Should contain date components
      expect(result).toMatch(/\d{4}/)
    })

    it('should handle different dates', () => {
      const timestamp1 = '2024-01-01T00:00:00Z'
      const timestamp2 = '2024-12-31T23:59:59Z'
      
      const result1 = formatDate(timestamp1)
      const result2 = formatDate(timestamp2)
      
      expect(result1).toBeTruthy()
      expect(result2).toBeTruthy()
      expect(result1).not.toBe(result2)
    })
  })

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated'
      const result = truncateText(longText, 20)
      
      expect(result).toBe('This is a very long ...')
      expect(result.length).toBe(23) // 20 + '...'
    })

    it('should not truncate short text', () => {
      const shortText = 'Short text'
      const result = truncateText(shortText, 20)
      
      expect(result).toBe('Short text')
    })

    it('should handle exact length', () => {
      const text = 'Exactly twenty chars'
      const result = truncateText(text, 20)
      
      expect(result).toBe('Exactly twenty chars')
    })

    it('should handle empty text', () => {
      const result = truncateText('', 10)
      expect(result).toBe('')
    })
  })

  describe('capitalizeFirst', () => {
    it('should capitalize first letter', () => {
      expect(capitalizeFirst('hello')).toBe('Hello')
      expect(capitalizeFirst('world')).toBe('World')
    })

    it('should handle already capitalized text', () => {
      expect(capitalizeFirst('Hello')).toBe('Hello')
    })

    it('should handle single character', () => {
      expect(capitalizeFirst('a')).toBe('A')
      expect(capitalizeFirst('A')).toBe('A')
    })

    it('should handle empty string', () => {
      expect(capitalizeFirst('')).toBe('')
    })

    it('should handle null/undefined', () => {
      expect(capitalizeFirst(null as unknown as string)).toBe(null)
      expect(capitalizeFirst(undefined as unknown as string)).toBe(undefined)
    })

    it('should preserve rest of the string', () => {
      expect(capitalizeFirst('hELLO wORLD')).toBe('HELLO wORLD')
    })
  })

  describe('Edge Cases', () => {
    it('should handle negative file sizes', () => {
      expect(formatFileSize(-1024)).toBe('-1 KB')
    })

    it('should handle very large file sizes', () => {
      const result = formatFileSize(1024 * 1024 * 1024 * 1024)
      expect(result).toContain('TB')
    })

    it('should handle invalid dates gracefully', () => {
      const invalidDate = 'invalid-date'
      expect(() => formatTime(invalidDate)).not.toThrow()
      expect(() => formatDate(invalidDate)).not.toThrow()
    })
  })
})