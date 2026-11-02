/**
 * Stable colour assignment for a team, shared by member rows, team cards and
 * filters so one team always has one colour. Tokens only (--ui-*).
 */
const TONES = [
  { tag: 'ui-tag-lavender', token: 'indigo' },
  { tag: 'ui-tag-peach', token: 'orange' },
  { tag: 'ui-tag-mint', token: 'green' },
  { tag: 'ui-tag-sky', token: 'accent' },
  { tag: 'ui-tag-rose', token: 'red' }
] as const

function toneFor(teamId: number): (typeof TONES)[number] {
  return TONES[((Math.abs(teamId) - 1) % TONES.length + TONES.length) % TONES.length] ?? TONES[0]
}

/** Pastel tag class for a team name chip. */
export function teamTagClass(teamId: number): string {
  return toneFor(teamId).tag
}

/** Solid pastel for a person/team mark: a low-saturation tint of the tone, opaque so stacked marks stay clean. */
export function pastelBackground(token: string): string {
  return `color-mix(in srgb, var(--ui-${token}) 16%, var(--ui-surface))`
}

/** Text colour that reads on that pastel (the AA ink variant where the token has one). */
export function pastelInk(token: string): string {
  const inked: Record<string, string> = { orange: 'orange-ink', green: 'green-ink', red: 'red-ink' }
  return `var(--ui-${inked[token] ?? token})`
}

/** Pastel background for the team mark tile. */
export function teamMarkBackground(teamId: number): string {
  return pastelBackground(toneFor(teamId).token)
}

/** Ink for the team mark initial. */
export function teamMarkInk(teamId: number): string {
  return pastelInk(toneFor(teamId).token)
}

const TEAM_ROLE_TEXT: Record<string, string> = {
  member: '成員',
  lead: '組長',
  supervisor: '主管'
}

/** Team role copy: 成員 / 組長 / 主管. */
export function teamRoleText(role: string): string {
  return TEAM_ROLE_TEXT[role] ?? role
}

/**
 * Compact "last seen" copy: 剛剛 / N 分鐘前 / 今天 HH:mm / 昨天 HH:mm / M 月 D 日.
 * Recomputed from the timestamp, never cached.
 */
export function formatLastLogin(value: string | Date | undefined | null, now: number = Date.now()): string {
  if (!value) {return '尚未登入'}
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) {return '尚未登入'}
  const diffMin = Math.floor((now - at.getTime()) / 60000)
  if (diffMin < 1) {return '剛剛'}
  if (diffMin < 60) {return `${diffMin} 分鐘前`}
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  if (at.getTime() >= startOfToday.getTime()) {return `今天 ${time}`}
  if (at.getTime() >= startOfToday.getTime() - 86400000) {return `昨天 ${time}`}
  const sameYear = at.getFullYear() === new Date(now).getFullYear()
  return sameYear
    ? `${at.getMonth() + 1} 月 ${at.getDate()} 日`
    : `${at.getFullYear()} 年 ${at.getMonth() + 1} 月 ${at.getDate()} 日`
}
