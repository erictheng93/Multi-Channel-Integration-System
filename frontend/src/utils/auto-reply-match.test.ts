import { describe, it, expect } from 'vitest'
import { matchAutoReplyRules } from './auto-reply-match'
import type { AutoReplyRule } from '@/api/autoReply'

const rule = (over: Partial<AutoReplyRule>): AutoReplyRule => ({
  id: 1, teamId: null, name: 'r', triggerType: 'keyword', priority: 10, isActive: true, allowPushFallback: false,
  createdBy: 'a', createdAt: '', updatedAt: '', deletedAt: null, conditions: [], actions: [], ...over,
} as AutoReplyRule)
const cond = (conditionType: string, value: string, matchMode = 'any') => ({ id: 1, conditionType, value, caseSensitive: false, matchMode }) as AutoReplyRule['conditions'][number]

describe('matchAutoReplyRules', () => {
  it('returns nothing for blank text', () => {
    expect(matchAutoReplyRules('  ', [rule({ conditions: [cond('contains', 'a')] })], true)).toEqual([])
  })

  it('orders matches by priority and the first is the winner', () => {
    const rules = [
      rule({ id: 2, name: 'late', priority: 30, conditions: [cond('contains', '價')] }),
      rule({ id: 1, name: 'early', priority: 10, conditions: [cond('contains', '報價'), cond('contains', '價格')] }),
    ]
    const m = matchAutoReplyRules('請問報價', rules, true)
    expect(m.map(x => x.rule.name)).toEqual(['early', 'late'])
    expect(m[0]?.reason).toBe('符合「報價」')
  })

  it('skips disabled rules, welcome rules and keyword rules without conditions', () => {
    const rules = [
      rule({ isActive: false, conditions: [cond('contains', 'x')] }),
      rule({ triggerType: 'welcome' }),
      rule({ conditions: [] }),
    ]
    expect(matchAutoReplyRules('x', rules, true)).toEqual([])
  })

  it('supports exact, regex and match-all', () => {
    expect(matchAutoReplyRules(' HI ', [rule({ conditions: [cond('exact', 'hi')] })], true)).toHaveLength(1)
    expect(matchAutoReplyRules('DA-20261028', [rule({ conditions: [cond('regex', String.raw`DA-\d{8}`)] })], true)).toHaveLength(1)
    expect(matchAutoReplyRules('DA-(', [rule({ conditions: [cond('regex', '(')] })], true)).toHaveLength(0)
    const all = rule({ conditions: [cond('contains', 'a', 'all'), cond('contains', 'b', 'all')] })
    expect(matchAutoReplyRules('a', [all], true)).toHaveLength(0)
    expect(matchAutoReplyRules('ab', [all], true)).toHaveLength(1)
  })

  it('off-hours rules fire only when closed', () => {
    const r = rule({ triggerType: 'off_hours', priority: 90 })
    expect(matchAutoReplyRules('hello', [r], true)).toHaveLength(0)
    expect(matchAutoReplyRules('hello', [r], false)[0]?.reason).toBe('目前非營業時間')
  })
})
