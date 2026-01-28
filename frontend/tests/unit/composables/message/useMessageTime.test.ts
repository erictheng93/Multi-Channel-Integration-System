import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMessageTime } from '@/composables/message/useMessageTime'

describe('useMessageTime Composable', () => {
  let formatTime: ReturnType<typeof useMessageTime>['formatTime']
  let normalizeDate: ReturnType<typeof useMessageTime>['normalizeDate']
  let isToday: ReturnType<typeof useMessageTime>['isToday']
  let formatTimeOnly: ReturnType<typeof useMessageTime>['formatTimeOnly']
  let formatDateTime: ReturnType<typeof useMessageTime>['formatDateTime']

  beforeEach(() => {
    const composable = useMessageTime()
    formatTime = composable.formatTime
    normalizeDate = composable.normalizeDate
    isToday = composable.isToday
    formatTimeOnly = composable.formatTimeOnly
    formatDateTime = composable.formatDateTime
  })

  describe('normalizeDate', () => {
    it('should convert millisecond timestamp to Date', () => {
      const timestamp = 1706347800000 // 2024-01-27 15:30:00 GMT
      const result = normalizeDate(timestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBe(timestamp)
    })

    it('should convert ISO string to Date', () => {
      const isoString = '2025-01-27T15:30:00.000Z'
      const result = normalizeDate(isoString)
      expect(result).toBeInstanceOf(Date)
      expect(result.toISOString()).toBe(isoString)
    })

    it('should return Date object as-is', () => {
      const date = new Date('2025-01-27T15:30:00.000Z')
      const result = normalizeDate(date)
      expect(result).toBe(date)
      expect(result).toBeInstanceOf(Date)
    })

    it('should handle various date formats', () => {
      const formats = [
        new Date(2025, 0, 27, 15, 30),
        '2025-01-27',
        1706347800000
      ]

      formats.forEach(format => {
        const result = normalizeDate(format)
        expect(result).toBeInstanceOf(Date)
      })
    })
  })

  describe('isToday', () => {
    it('should return true for current date', () => {
      const now = new Date()
      expect(isToday(now, now)).toBe(true)
    })

    it('should return true for different times on the same day', () => {
      const now = new Date(2025, 0, 27, 15, 30, 0)
      const morning = new Date(2025, 0, 27, 9, 0, 0)
      const evening = new Date(2025, 0, 27, 23, 59, 59)

      expect(isToday(morning, now)).toBe(true)
      expect(isToday(evening, now)).toBe(true)
    })

    it('should return false for yesterday', () => {
      const now = new Date(2025, 0, 27, 15, 30, 0)
      const yesterday = new Date(2025, 0, 26, 15, 30, 0)

      expect(isToday(yesterday, now)).toBe(false)
    })

    it('should return false for tomorrow', () => {
      const now = new Date(2025, 0, 27, 15, 30, 0)
      const tomorrow = new Date(2025, 0, 28, 15, 30, 0)

      expect(isToday(tomorrow, now)).toBe(false)
    })

    it('should handle timezone correctly', () => {
      const midnight = new Date(2025, 0, 27, 0, 0, 0)
      const almostMidnight = new Date(2025, 0, 26, 23, 59, 59)

      expect(isToday(midnight, midnight)).toBe(true)
      expect(isToday(almostMidnight, midnight)).toBe(false)
    })
  })

  describe('formatTimeOnly', () => {
    it('should format time in HH:MM format', () => {
      const date = new Date(2025, 0, 27, 14, 30, 0)
      const result = formatTimeOnly(date)

      expect(result).toMatch(/\d{2}:\d{2}/)
      expect(result).toMatch(/14:30/)
    })

    it('should use 24-hour format', () => {
      const afternoon = new Date(2025, 0, 27, 15, 45, 0)
      const result = formatTimeOnly(afternoon)

      expect(result).toMatch(/15:45/)
      expect(result).not.toMatch(/PM|AM/)
    })

    it('should handle midnight correctly', () => {
      const midnight = new Date(2025, 0, 27, 0, 0, 0)
      const result = formatTimeOnly(midnight)

      // Accept both 00:00 and 24:00 formats (locale-dependent)
      expect(result).toMatch(/00:00|24:00/)
    })

    it('should handle noon correctly', () => {
      const noon = new Date(2025, 0, 27, 12, 0, 0)
      const result = formatTimeOnly(noon)

      expect(result).toMatch(/12:00/)
    })

    it('should pad single digit hours and minutes', () => {
      const earlyMorning = new Date(2025, 0, 27, 9, 5, 0)
      const result = formatTimeOnly(earlyMorning)

      expect(result).toMatch(/09:05/)
    })
  })

  describe('formatDateTime', () => {
    it('should format full date and time', () => {
      const date = new Date(2025, 0, 27, 15, 30, 0)
      const result = formatDateTime(date)

      // Should contain year
      expect(result).toMatch(/2025/)
      // Should contain date separator
      expect(result).toMatch(/\//)
      // Should contain time
      expect(result).toMatch(/\d{2}:\d{2}/)
    })

    it('should use zh-TW locale format', () => {
      const date = new Date(2025, 0, 27, 15, 30, 0)
      const result = formatDateTime(date)

      // zh-TW format typically uses / as separator
      expect(result).toMatch(/\d{4}\/\d{2}\/\d{2}/)
    })

    it('should use 24-hour format', () => {
      const afternoon = new Date(2025, 0, 27, 15, 30, 0)
      const result = formatDateTime(afternoon)

      expect(result).toMatch(/15:30/)
      expect(result).not.toMatch(/PM|AM/)
    })

    it('should handle different dates correctly', () => {
      const dates = [
        new Date(2025, 0, 1, 0, 0, 0),   // New Year
        new Date(2025, 5, 15, 12, 30, 0), // Mid-year
        new Date(2025, 11, 31, 23, 59, 0) // Year end
      ]

      dates.forEach(date => {
        const result = formatDateTime(date)
        expect(result).toMatch(/2025/)
        expect(result).toMatch(/\d{2}:\d{2}/)
      })
    })
  })

  describe('formatTime (main function)', () => {
    describe('today messages', () => {
      it('should show only time for messages from today', () => {
        const now = new Date()
        const result = formatTime(now)

        // Should NOT contain year
        expect(result).not.toMatch(/2025/)
        // Should contain time
        expect(result).toMatch(/\d{2}:\d{2}/)
      })

      it('should format morning messages correctly', () => {
        const morning = new Date()
        morning.setHours(9, 30, 0, 0)
        const result = formatTime(morning)

        expect(result).toMatch(/09:30/)
      })

      it('should format afternoon messages correctly', () => {
        const afternoon = new Date()
        afternoon.setHours(15, 45, 0, 0)
        const result = formatTime(afternoon)

        expect(result).toMatch(/15:45/)
      })
    })

    describe('historical messages', () => {
      it('should show full date and time for yesterday', () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(15, 30, 0, 0)
        const result = formatTime(yesterday)

        // Should contain year
        expect(result).toMatch(/\d{4}/)
        // Should contain date separator
        expect(result).toMatch(/\//)
        // Should contain time
        expect(result).toMatch(/\d{2}:\d{2}/)
      })

      it('should show full date and time for last week', () => {
        const lastWeek = new Date()
        lastWeek.setDate(lastWeek.getDate() - 7)
        lastWeek.setHours(10, 15, 0, 0)
        const result = formatTime(lastWeek)

        expect(result).toMatch(/\d{4}/)
        expect(result).toMatch(/\//)
        expect(result).toMatch(/\d{2}:\d{2}/)
      })

      it('should show full date and time for last month', () => {
        const lastMonth = new Date()
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        lastMonth.setHours(14, 0, 0, 0)
        const result = formatTime(lastMonth)

        expect(result).toMatch(/\d{4}/)
        expect(result).toMatch(/\//)
        expect(result).toMatch(/\d{2}:\d{2}/)
      })

      it('should show correct year for last year messages', () => {
        const lastYear = new Date()
        lastYear.setFullYear(lastYear.getFullYear() - 1)
        lastYear.setHours(12, 0, 0, 0)
        const result = formatTime(lastYear)

        const expectedYear = (new Date().getFullYear() - 1).toString()
        expect(result).toContain(expectedYear)
      })
    })

    describe('input format handling', () => {
      it('should handle Date objects', () => {
        const date = new Date()
        const result = formatTime(date)

        expect(result).toBeTruthy()
        expect(result).toMatch(/\d{2}:\d{2}/)
      })

      it('should handle ISO strings', () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const isoString = yesterday.toISOString()
        const result = formatTime(isoString)

        expect(result).toBeTruthy()
        expect(result).toMatch(/\d{4}/)
      })

      it('should handle millisecond timestamps', () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const timestamp = yesterday.getTime()
        const result = formatTime(timestamp)

        expect(result).toBeTruthy()
        expect(result).toMatch(/\d{4}/)
      })
    })

    describe('edge cases', () => {
      it('should handle midnight correctly', () => {
        const midnight = new Date()
        midnight.setHours(0, 0, 0, 0)
        const result = formatTime(midnight)

        // Accept both 00:00 and 24:00 formats (locale-dependent)
        expect(result).toMatch(/00:00|24:00/)
      })

      it('should handle end of day correctly', () => {
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)
        const result = formatTime(endOfDay)

        expect(result).toMatch(/23:59/)
      })

      it('should handle leap year dates', () => {
        const leapDay = new Date(2024, 1, 29, 12, 0, 0) // Feb 29, 2024
        const result = formatTime(leapDay)

        expect(result).toBeTruthy()
        expect(result).toMatch(/2024/)
      })
    })
  })
})
