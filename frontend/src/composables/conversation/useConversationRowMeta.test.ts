import { describe, expect, it } from 'vitest'
import type { Conversation } from '@/types'
import { lastMessagePreview, lastMessageText } from './useConversationRowMeta'

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
