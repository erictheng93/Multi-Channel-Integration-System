import { describe, it, expect } from 'vitest'
import { formatLastLogin, teamRoleText, teamTagClass } from '@/utils/team-tone'

describe('team-tone', () => {
  const now = new Date('2026-10-29T12:00:00').getTime()

  it('formats last login relative to now', () => {
    expect(formatLastLogin(undefined, now)).toBe('尚未登入')
    expect(formatLastLogin(new Date(now - 20_000).toISOString(), now)).toBe('剛剛')
    expect(formatLastLogin(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5 分鐘前')
    expect(formatLastLogin(new Date('2026-10-29T08:05:00').toISOString(), now)).toBe('今天 08:05')
    expect(formatLastLogin(new Date('2026-10-28T17:48:00').toISOString(), now)).toBe('昨天 17:48')
    expect(formatLastLogin(new Date('2026-09-18T10:00:00').toISOString(), now)).toBe('9 月 18 日')
  })

  it('maps team roles and gives teams a stable tag class', () => {
    expect(teamRoleText('lead')).toBe('組長')
    expect(teamRoleText('supervisor')).toBe('主管')
    expect(teamRoleText('member')).toBe('成員')
    expect(teamTagClass(1)).toBe(teamTagClass(6))
  })
})
