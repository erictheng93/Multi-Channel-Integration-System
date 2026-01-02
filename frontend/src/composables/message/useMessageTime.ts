/**
 * Message Time Formatting Composable
 *
 * Provides intelligent timestamp formatting for messages
 * - Today's messages: Show only time (HH:MM)
 * - Historical messages: Show full date and time (YYYY/MM/DD HH:MM)
 *
 * @module composables/message/useMessageTime
 */

/**
 * Normalizes various date formats to a Date object
 *
 * @param date - Date in various formats (Date object, ISO string, or timestamp)
 * @returns Normalized Date object
 */
function normalizeDate(date: Date | string | number): Date {
  if (typeof date === 'number') {
    return new Date(date)
  }
  if (typeof date === 'string') {
    return new Date(date)
  }
  return date
}

/**
 * Checks if a date is today
 *
 * @param date - Date to check
 * @param now - Reference date (defaults to current time)
 * @returns True if the date is today
 */
function isToday(date: Date, now: Date = new Date()): boolean {
  return date.toDateString() === now.toDateString()
}

/**
 * Formats time only (HH:MM)
 *
 * @param date - Date to format
 * @returns Time string in 24-hour format (e.g., "14:30")
 */
function formatTimeOnly(date: Date): string {
  return date.toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // Use 24-hour format
  })
}

/**
 * Formats full date and time (YYYY/MM/DD HH:MM)
 *
 * @param date - Date to format
 * @returns Full date and time string (e.g., "2025/01/27 15:30")
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // Use 24-hour format
  })
}

/**
 * Message Time Composable
 *
 * Provides intelligent timestamp formatting based on message age
 *
 * @returns Object containing formatting functions
 *
 * @example
 * ```typescript
 * const { formatTime } = useMessageTime()
 *
 * // Today's message
 * formatTime(new Date())  // "14:30"
 *
 * // Yesterday's message
 * formatTime(yesterdayDate)  // "2025/01/27 15:30"
 * ```
 */
export function useMessageTime() {
  /**
   * Formats message timestamp intelligently
   * - Today: Show only time (HH:MM)
   * - Historical: Show full date and time (YYYY/MM/DD HH:MM)
   *
   * @param date - Message timestamp (Date, ISO string, or milliseconds)
   * @returns Formatted time string
   */
  const formatTime = (date: Date | string | number): string => {
    const messageDate = normalizeDate(date)
    const now = new Date()

    if (isToday(messageDate, now)) {
      // Today's messages: Only show time (e.g., "14:30")
      return formatTimeOnly(messageDate)
    } else {
      // Historical messages: Show full date and time (e.g., "2025/01/27 15:30")
      return formatDateTime(messageDate)
    }
  }

  return {
    formatTime,
    // Export helper functions for testing purposes
    normalizeDate,
    isToday,
    formatTimeOnly,
    formatDateTime
  }
}
