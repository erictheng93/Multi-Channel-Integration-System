import { describe, it, expect, beforeEach } from 'vitest'
import { createNewMessageHandler, type DesktopNotificationDeps } from './useDesktopNotifications'
import type { WebSocketMessage } from '@/services/websocketClient'
import type { Conversation } from '@/types'

function makeConversation(id: string, teamId?: number): Conversation {
  return { id, assignedTeamId: teamId, customer: { name: '王小明' } } as unknown as Conversation
}

function makeMessage(overrides: Partial<WebSocketMessage> & { data?: Record<string, unknown> } = {}): WebSocketMessage {
  return {
    type: 'new_message',
    conversationId: 'conv-1',
    data: {
      content: '你好',
      messageType: 'text',
      senderType: 'customer',
      sender: { id: 'u1', name: '王小明' },
      ...overrides.data
    },
    ...overrides
  }
}

describe('createNewMessageHandler', () => {
  let deps: DesktopNotificationDeps
  let shown: Array<{ conversationId: string; title: string; body: string }>
  let soundPlayed: number
  let now: number

  beforeEach(() => {
    shown = []
    soundPlayed = 0
    now = 100_000
    deps = {
      prefs: { enabled: true, scope: 'all', soundEnabled: true },
      getPermission: () => 'granted',
      getConversation: (id) => (id === 'conv-1' ? makeConversation('conv-1', 1) : undefined),
      getCurrentConversationId: () => null,
      getAllowedTeamIds: () => [1],
      isTabVisible: () => false,
      showNotification: (args) => { shown.push(args) },
      playSound: () => { soundPlayed++ },
      now: () => now
    }
  })

  it('客戶新訊息 → 彈通知 + 播音效', () => {
    const handler = createNewMessageHandler(deps)
    handler(makeMessage())
    expect(shown).toEqual([{ conversationId: 'conv-1', title: '王小明', body: '你好' }])
    expect(soundPlayed).toBe(1)
  })

  it('soundEnabled=false → 彈通知但不播音效', () => {
    deps.prefs.soundEnabled = false
    const handler = createNewMessageHandler(deps)
    handler(makeMessage())
    expect(shown.length).toBe(1)
    expect(soundPlayed).toBe(0)
  })

  it('agent 訊息 / 非 new_message 事件 → 忽略', () => {
    const handler = createNewMessageHandler(deps)
    handler(makeMessage({ data: { senderType: 'agent' } }))
    handler(makeMessage({ type: 'message_sent' }))
    expect(shown.length).toBe(0)
  })

  it('正在看該對話且分頁前景 → 抑制', () => {
    deps.getCurrentConversationId = () => 'conv-1'
    deps.isTabVisible = () => true
    const handler = createNewMessageHandler(deps)
    handler(makeMessage())
    expect(shown.length).toBe(0)
  })

  it('my-teams 模式:對話不在列表(查不到指派)→ 不彈', () => {
    deps.prefs.scope = 'my-teams'
    const handler = createNewMessageHandler(deps)
    handler(makeMessage({ conversationId: 'conv-unknown' }))
    expect(shown.length).toBe(0)
  })

  it('同對話 3 秒內第二則 → 節流;3 秒後 → 再彈', () => {
    const handler = createNewMessageHandler(deps)
    handler(makeMessage())
    now += 1000
    handler(makeMessage())
    expect(shown.length).toBe(1)
    now += 3000
    handler(makeMessage())
    expect(shown.length).toBe(2)
  })

  it('conversationId 落在 data 內也能取到', () => {
    const handler = createNewMessageHandler(deps)
    handler(makeMessage({ conversationId: undefined, data: { conversationId: 'conv-1', senderType: 'customer', content: 'x', messageType: 'text' } }))
    expect(shown.length).toBe(1)
  })

  it('showNotification throw → 不往外拋', () => {
    deps.showNotification = () => { throw new Error('platform error') }
    const handler = createNewMessageHandler(deps)
    expect(() => handler(makeMessage())).not.toThrow()
  })
})
