import { describe, expect, it } from 'vitest'
import { resolveDisplaySenderName } from '@/utils/sender-name-repair'

describe('resolveDisplaySenderName', () => {
  it('uses the current agent display name when the stored sender snapshot is UTF-8 mojibake', () => {
    const corrupted = 'é\u0082±å»ºç¶­ Jerry'

    expect(resolveDisplaySenderName({
      senderType: 'agent',
      senderName: corrupted,
      agentDisplayName: '邱建維 Jerry'
    })).toBe('邱建維 Jerry')
  })

  it('also repairs visible CJK mojibake after control bytes are dropped by rendering', () => {
    expect(resolveDisplaySenderName({
      senderType: 'agent',
      senderName: 'é±å»ºç¶­ Jerry',
      agentDisplayName: '邱建維 Jerry'
    })).toBe('邱建維 Jerry')
  })

  it('preserves a valid historical sender snapshot even if the agent was renamed', () => {
    expect(resolveDisplaySenderName({
      senderType: 'agent',
      senderName: 'Jerry Chen',
      agentDisplayName: '邱建維 Jerry'
    })).toBe('Jerry Chen')
  })

  it('does not rewrite customer or system sender names', () => {
    expect(resolveDisplaySenderName({
      senderType: 'customer',
      senderName: 'é\u0082±å»ºç¶­ Jerry',
      agentDisplayName: '邱建維 Jerry'
    })).toBe('é\u0082±å»ºç¶­ Jerry')
  })
})
