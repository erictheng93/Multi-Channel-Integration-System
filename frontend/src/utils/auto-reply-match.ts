/**
 * Dry-run of the auto-reply engine for one text message, in the browser.
 * It mirrors the server rules (src/modules/auto-reply): active rules are tried by priority, the
 * first match wins; keyword rules need a text message and at least one condition; "off hours"
 * rules only fire outside business hours; a catch-all (fallback) rule always fires. Welcome
 * rules belong to the follow event, so a typed message never reaches them.
 */
import type { AutoReplyRule } from '@/api/autoReply'

export interface RuleMatch {
  rule: AutoReplyRule
  /** Why it fired, in the customer's terms: the keyword, "outside business hours", ... */
  reason: string
}

function conditionMatches(text: string, c: AutoReplyRule['conditions'][number]): boolean {
  const caseSensitive = !!c.caseSensitive
  const a = caseSensitive ? text : text.toLowerCase()
  const v = caseSensitive ? c.value : c.value.toLowerCase()
  switch (c.conditionType) {
    case 'exact':
      return a.trim() === v
    case 'contains':
      return a.includes(v)
    case 'regex':
      try {
        return new RegExp(c.value, caseSensitive ? '' : 'i').test(text)
      } catch {
        return false
      }
    case 'message_type':
      return c.value === 'text'
    default:
      return false
  }
}

/** Every rule that would answer `text`, best (lowest priority number) first; the first one is the winner. */
export function matchAutoReplyRules(text: string, rules: AutoReplyRule[], isBusinessHours: boolean): RuleMatch[] {
  const content = text
  if (content.trim().length === 0) { return [] }
  const out: RuleMatch[] = []
  const ordered = rules.filter(r => r.isActive).sort((x, y) => x.priority - y.priority)
  for (const rule of ordered) {
    if (rule.triggerType === 'keyword') {
      if (rule.conditions.length === 0) { continue }
      const all = rule.conditions[0]?.matchMode === 'all'
      const hits = rule.conditions.filter(c => conditionMatches(content, c))
      const ok = all ? hits.length === rule.conditions.length : hits.length > 0
      if (ok && hits[0]) { out.push({ rule, reason: `符合「${hits[0].value}」` }) }
    } else if (rule.triggerType === 'off_hours') {
      if (!isBusinessHours) { out.push({ rule, reason: '目前非營業時間' }) }
    } else if ((rule.triggerType as string) === 'fallback') {
      out.push({ rule, reason: '任何訊息' })
    }
  }
  return out
}
