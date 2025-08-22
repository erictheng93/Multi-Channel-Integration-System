/**
 * 時間戳處理工具
 * 統一處理 number 和 Date 類型的時間戳
 */

export function toDate(timestamp: number | Date): Date {
  if (timestamp instanceof Date) {
    return timestamp
  }
  return new Date(timestamp)
}

export function toTimestamp(date: number | Date): number {
  if (typeof date === 'number') {
    return date
  }
  return date.getTime()
}

export function formatTimestamp(timestamp: number | Date): string {
  const date = toDate(timestamp)
  return date.toLocaleString()
}

export function formatTime(timestamp: number | Date | string): string {
  let date: Date
  
  if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else {
    date = toDate(timestamp)
  }
  
  return date.toLocaleTimeString('zh-TW', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

export function formatDate(timestamp: number | Date | string): string {
  let date: Date
  
  if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else {
    date = toDate(timestamp)
  }
  
  return date.toLocaleDateString('zh-TW')
}