/**
 * Tests for useMessageTime composable
 *
 * @module tests/unit/composables/useMessageTime
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMessageTime } from '@/composables/message/useMessageTime'

describe('useMessageTime', () => {
  let originalDate: DateConstructor

  beforeEach(() => {
    // Save original Date constructor
    originalDate = global.Date
  })

  afterEach(() => {
    // Restore original Date constructor
    global.Date = originalDate
  })

  describe('formatTime', () => {
    it('should format today\'s message with time only', () => {
      // Mock current time: 2025-01-27 15:30:00
      const mockNow = new Date('2025-01-27T15:30:00')
      vi.setSystemTime(mockNow)

      const { formatTime } = useMessageTime()

      // Message from same day at 14:00
      const messageTime = new Date('2025-01-27T14:00:00')
      const result = formatTime(messageTime)

      // Should show only time
      expect(result).toMatch(/14:00/)
      expect(result).not.toMatch(/2025/)
    })

    it('should format historical message with full date and time', () => {
      // Mock current time: 2025-01-27 15:30:00
      const mockNow = new Date('2025-01-27T15:30:00')
      vi.setSystemTime(mockNow)

      const { formatTime } = useMessageTime()

      // Message from yesterday
      const messageTime = new Date('2025-01-26T14:00:00')
      const result = formatTime(messageTime)

      // Should show full date and time
      expect(result).toMatch(/2025/)
      expect(result).toMatch(/01/)
      expect(result).toMatch(/26/)
      expect(result).toMatch(/14:00/)
    })

    it('should accept Date object', () => {
      const { formatTime } = useMessageTime()
      const date = new Date()
      const result = formatTime(date)

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should accept ISO string', () => {
      const { formatTime } = useMessageTime()
      const isoString = '2025-01-27T14:00:00.000Z'
      const result = formatTime(isoString)

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should accept timestamp number', () => {
      const { formatTime } = useMessageTime()
      const timestamp = Date.now()
      const result = formatTime(timestamp)

      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should use 24-hour format', () => {
      const mockNow = new Date('2025-01-27T15:30:00')
      vi.setSystemTime(mockNow)

      const { formatTime } = useMessageTime()

      // Afternoon time
      const afternoonTime = new Date('2025-01-27T15:30:00')
      const afternoonResult = formatTime(afternoonTime)

      expect(afternoonResult).toMatch(/15:30/)
      expect(afternoonResult).not.toMatch(/PM|pm/)
    })
  })

  describe('Helper functions', () => {
    describe('normalizeDate', () => {
      it('should normalize Date object', () => {
        const { normalizeDate } = useMessageTime()
        const date = new Date('2025-01-27T14:00:00')
        const result = normalizeDate(date)

        expect(result).toBeInstanceOf(Date)
        expect(result.getTime()).toBe(date.getTime())
      })

      it('should normalize number timestamp', () => {
        const { normalizeDate } = useMessageTime()
        const timestamp = 1706364000000 // 2025-01-27 14:00:00 UTC
        const result = normalizeDate(timestamp)

        expect(result).toBeInstanceOf(Date)
        expect(result.getTime()).toBe(timestamp)
      })

      it('should normalize ISO string', () => {
        const { normalizeDate } = useMessageTime()
        const isoString = '2025-01-27T14:00:00.000Z'
        const result = normalizeDate(isoString)

        expect(result).toBeInstanceOf(Date)
        expect(result.toISOString()).toBe(isoString)
      })
    })

    describe('isToday', () => {
      it('should return true for today\'s date', () => {
        const mockNow = new Date('2025-01-27T15:30:00')
        vi.setSystemTime(mockNow)

        const { isToday } = useMessageTime()
        const todayDate = new Date('2025-01-27T10:00:00')

        expect(isToday(todayDate)).toBe(true)
      })

      it('should return false for yesterday\'s date', () => {
        const mockNow = new Date('2025-01-27T15:30:00')
        vi.setSystemTime(mockNow)

        const { isToday } = useMessageTime()
        const yesterdayDate = new Date('2025-01-26T15:30:00')

        expect(isToday(yesterdayDate)).toBe(false)
      })

      it('should return false for tomorrow\'s date', () => {
        const mockNow = new Date('2025-01-27T15:30:00')
        vi.setSystemTime(mockNow)

        const { isToday } = useMessageTime()
        const tomorrowDate = new Date('2025-01-28T15:30:00')

        expect(isToday(tomorrowDate)).toBe(false)
      })

      it('should accept custom reference date', () => {
        const { isToday } = useMessageTime()
        const referenceDate = new Date('2025-01-27T15:30:00')
        const testDate = new Date('2025-01-27T10:00:00')

        expect(isToday(testDate, referenceDate)).toBe(true)
      })
    })

    describe('formatTimeOnly', () => {
      it('should format time in HH:MM format', () => {
        const { formatTimeOnly } = useMessageTime()
        const date = new Date('2025-01-27T14:30:00')
        const result = formatTimeOnly(date)

        expect(result).toMatch(/14:30/)
      })

      it('should use 24-hour format', () => {
        const { formatTimeOnly } = useMessageTime()
        const date = new Date('2025-01-27T15:45:00')
        const result = formatTimeOnly(date)

        expect(result).toMatch(/15:45/)
        expect(result).not.toMatch(/PM|pm/)
      })
    })

    describe('formatDateTime', () => {
      it('should format full date and time', () => {
        const { formatDateTime } = useMessageTime()
        const date = new Date('2025-01-27T14:30:00')
        const result = formatDateTime(date)

        expect(result).toMatch(/2025/)
        expect(result).toMatch(/01/)
        expect(result).toMatch(/27/)
        expect(result).toMatch(/14:30/)
      })

      it('should use 24-hour format', () => {
        const { formatDateTime } = useMessageTime()
        const date = new Date('2025-01-27T23:59:00')
        const result = formatDateTime(date)

        expect(result).toMatch(/23:59/)
        expect(result).not.toMatch(/PM|pm/)
      })
    })
  })
})
