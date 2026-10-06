import { describe, it, expect } from 'vitest'
import { diffUnreadTransitions } from './useUnreadConversationTotal'

const m = (entries: Array<[string, boolean]>) => new Map(entries)

describe('diffUnreadTransitions', () => {
  it('已讀 -> 未讀 計 +1', () => {
    expect(diffUnreadTransitions(m([['a', false]]), m([['a', true]]))).toEqual({ delta: 1, appearedUnread: false })
  })

  it('未讀 -> 已讀 計 -1', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', false]]))).toEqual({ delta: -1, appearedUnread: false })
  })

  it('同一對話未讀數增加(仍為未讀)不改變對話數', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', true]])).delta).toBe(0)
  })

  it('新載入的已讀對話(分頁/篩選)不影響計數', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', true], ['b', false]]))).toEqual({
      delta: 0,
      appearedUnread: false
    })
  })

  it('新出現的未讀對話無法判斷先前狀態 -> 標記需校正,不直接加', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', true], ['b', true]]))).toEqual({
      delta: 0,
      appearedUnread: true
    })
  })

  it('切換篩選導致對話消失不計為已讀', () => {
    expect(diffUnreadTransitions(m([['a', true], ['b', true]]), m([['a', true]])).delta).toBe(0)
  })

  it('多筆轉換淨增減', () => {
    const prev = m([['a', true], ['b', false], ['c', false]])
    const next = m([['a', false], ['b', true], ['c', true]])
    expect(diffUnreadTransitions(prev, next).delta).toBe(1)
  })
})
