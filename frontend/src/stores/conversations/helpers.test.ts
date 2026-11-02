import { describe, expect, it } from 'vitest'
import type { Conversation } from '@/types'
import { hasConversationChanged } from './helpers'

const conv = (extra: Partial<Conversation> = {}) => ({ id: 'c1', status: 'active', unreadCount: 0, ...extra }) as Conversation

describe('hasConversationChanged reply metadata', () => {
  it('detects a marker-only change', () => {
    expect(hasConversationChanged(conv({ awaitingSince: null }), conv({ awaitingSince: '2026-10-29T10:00:00.000Z' }))).toBe(true)
  })
  it('detects neverReplied appearing (stale list)', () => {
    expect(hasConversationChanged(conv(), conv({ neverReplied: true }))).toBe(true)
  })
  it('is stable when nothing differs', () => {
    expect(hasConversationChanged(conv({ awaitingSince: null }), conv({ awaitingSince: null }))).toBe(false)
  })
})
