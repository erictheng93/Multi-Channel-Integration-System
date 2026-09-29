import { describe, it, expect } from 'vitest'
import { formatTitleWithUnread } from './usePageTitleUnread'

describe('formatTitleWithUnread', () => {
  it('無未讀 → 原標題', () => {
    expect(formatTitleWithUnread('對話 - Multi-Channel Support', 0)).toBe('對話 - Multi-Channel Support')
  })

  it('有未讀 → 加 (N) 前綴', () => {
    expect(formatTitleWithUnread('對話 - Multi-Channel Support', 3)).toBe('(3) 對話 - Multi-Channel Support')
  })

  it('已有前綴 → 取代而非疊加', () => {
    expect(formatTitleWithUnread('(2) 對話 - Multi-Channel Support', 5)).toBe('(5) 對話 - Multi-Channel Support')
  })

  it('未讀歸零 → 移除前綴', () => {
    expect(formatTitleWithUnread('(2) 對話 - Multi-Channel Support', 0)).toBe('對話 - Multi-Channel Support')
  })

  it('超過 99 → 顯示 99+;99+ 前綴也可被取代', () => {
    expect(formatTitleWithUnread('對話', 120)).toBe('(99+) 對話')
    expect(formatTitleWithUnread('(99+) 對話', 3)).toBe('(3) 對話')
  })
})
