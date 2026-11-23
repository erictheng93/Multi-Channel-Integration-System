import { describe, expect, it } from 'vitest'
import type { Conversation } from '@/types'
import { isReplied, lastMessagePreview, lastMessageText, replyStateHint, replyStateOf } from './useConversationRowMeta'

const withLast = (content?: string) =>
  ({ lastMessage: content === undefined ? undefined : { content, senderType: 'agent' } }) as unknown as Conversation

describe('lastMessagePreview', () => {
  it('shows a recalled message in Chinese, as the conversation view does', () => {
    expect(lastMessagePreview(withLast('[This message has been recalled]'))).toBe('此訊息已撤回')
  })

  it('keeps ordinary content and the empty placeholder', () => {
    expect(lastMessagePreview(withLast('問題已為您解決'))).toBe('問題已為您解決')
    expect(lastMessagePreview(withLast())).toBe('暫無訊息')
  })
})

describe('lastMessageText', () => {
  it('searches what the list shows: a recalled message matches 已撤回, not the English placeholder', () => {
    expect(lastMessageText(withLast('[This message has been recalled]'))).toBe('此訊息已撤回')
    expect(lastMessageText(withLast('您好'))).toBe('您好')
    expect(lastMessageText(withLast())).toBe('')
  })
})

// A close settles the customer messages before it (unreadFloorAt). If nobody replied, the reopened row must
// not read 已回覆 (seen on production 2026-11-23).
describe('replyStateOf after a close settled an unanswered message', () => {
  const NOW = Date.parse('2026-11-23T09:00:00Z')
  const FLOOR = '2026-11-23T08:10:00.000Z'
  const row = (over: Record<string, unknown>) =>
    ({ id: 'c1', status: 'active', awaitingSince: null, unreadFloorAt: FLOOR, ...over }) as unknown as Conversation
  const customerAt = (iso: string, content = '請問有貨嗎') => ({ senderType: 'customer', messageType: 'text', content, timestamp: Date.parse(iso) })

  it('reads 結案前未回, with a hint, when the last customer message is at or before the floor', () => {
    const settled = row({ lastMessage: customerAt('2026-11-23T07:40:00Z') })
    expect(replyStateOf(settled, NOW)).toEqual({ state: 'settled', text: '結案前未回' })
    expect(isReplied(settled, NOW)).toBe(false)
    expect(replyStateHint('settled')).toContain('不再計入待回覆')
  })

  it('still reads 已回覆 for a sign-off, for an agent reply, and when there is no floor', () => {
    expect(replyStateOf(row({ lastMessage: customerAt('2026-11-23T07:40:00Z', '謝謝') }), NOW).state).toBe('replied')
    expect(replyStateOf(row({ lastMessage: { senderType: 'agent', content: '好的', timestamp: Date.parse('2026-11-23T07:50:00Z') } }), NOW).state).toBe('replied')
    expect(replyStateOf(row({ unreadFloorAt: null, lastMessage: customerAt('2026-11-23T07:40:00Z', '謝謝') }), NOW).state).toBe('replied')
  })

  it('a message after the floor is a real wait, not a settled one', () => {
    const waiting = row({ awaitingSince: '2026-11-23T08:30:00.000Z', lastMessage: customerAt('2026-11-23T08:30:00Z') })
    expect(replyStateOf(waiting, NOW).state).toBe('waiting')
  })
})
