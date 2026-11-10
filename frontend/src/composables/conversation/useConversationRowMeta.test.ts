import { describe, expect, it } from 'vitest'
import type { Conversation } from '@/types'
import { lastMessagePreview } from './useConversationRowMeta'

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
