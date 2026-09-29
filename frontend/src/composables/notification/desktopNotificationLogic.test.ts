import { describe, it, expect } from 'vitest'
import {
  shouldNotify,
  buildNotificationContent,
  NOTIFY_MIN_INTERVAL_MS,
  type NotificationDecisionInput
} from './desktopNotificationLogic'
import type { Conversation } from '@/types'

function baseInput(overrides: Partial<NotificationDecisionInput> = {}): NotificationDecisionInput {
  return {
    eventType: 'new_message',
    senderType: 'customer',
    conversationId: 'conv-1',
    prefsEnabled: true,
    permission: 'granted',
    scope: 'all',
    assignedTeamId: 1,
    allowedTeamIds: [1, 2],
    isTabVisible: false,
    currentConversationId: null,
    lastNotifiedAt: undefined,
    now: 100_000,
    ...overrides
  }
}

describe('shouldNotify', () => {
  it('客戶新訊息、全部條件通過 → 彈', () => {
    expect(shouldNotify(baseInput())).toBe(true)
  })

  it('客服訊息(message_sent / senderType agent)→ 不彈', () => {
    expect(shouldNotify(baseInput({ eventType: 'message_sent' }))).toBe(false)
    expect(shouldNotify(baseInput({ senderType: 'agent' }))).toBe(false)
    expect(shouldNotify(baseInput({ senderType: undefined }))).toBe(false)
  })

  it('無 conversationId → 不彈', () => {
    expect(shouldNotify(baseInput({ conversationId: undefined }))).toBe(false)
  })

  it('偏好關閉或權限非 granted → 不彈', () => {
    expect(shouldNotify(baseInput({ prefsEnabled: false }))).toBe(false)
    expect(shouldNotify(baseInput({ permission: 'denied' }))).toBe(false)
    expect(shouldNotify(baseInput({ permission: 'default' }))).toBe(false)
    expect(shouldNotify(baseInput({ permission: 'unsupported' }))).toBe(false)
  })

  it('my-teams 模式:非我所屬團隊或未指派 → 不彈;我所屬團隊 → 彈', () => {
    expect(shouldNotify(baseInput({ scope: 'my-teams', assignedTeamId: 99 }))).toBe(false)
    expect(shouldNotify(baseInput({ scope: 'my-teams', assignedTeamId: undefined }))).toBe(false)
    expect(shouldNotify(baseInput({ scope: 'my-teams', assignedTeamId: 2 }))).toBe(true)
  })

  it('分頁前景且正在看該對話 → 抑制;分頁背景即使看該對話 → 彈', () => {
    expect(shouldNotify(baseInput({ isTabVisible: true, currentConversationId: 'conv-1' }))).toBe(false)
    expect(shouldNotify(baseInput({ isTabVisible: false, currentConversationId: 'conv-1' }))).toBe(true)
    expect(shouldNotify(baseInput({ isTabVisible: true, currentConversationId: 'conv-2' }))).toBe(true)
  })

  it('同對話 3 秒內節流;超過間隔 → 彈', () => {
    expect(shouldNotify(baseInput({ lastNotifiedAt: 100_000 - NOTIFY_MIN_INTERVAL_MS + 1 }))).toBe(false)
    expect(shouldNotify(baseInput({ lastNotifiedAt: 100_000 - NOTIFY_MIN_INTERVAL_MS }))).toBe(true)
  })
})

describe('buildNotificationContent', () => {
  const conv = { id: 'conv-1', customer: { name: '王小明' } } as unknown as Conversation

  it('標題:sender.name 優先,其次 store 客戶名,最後固定字串', () => {
    expect(buildNotificationContent({ senderName: '陳大文', conversation: conv, content: 'hi', messageType: 'text' }).title).toBe('陳大文')
    expect(buildNotificationContent({ conversation: conv, content: 'hi', messageType: 'text' }).title).toBe('王小明')
    expect(buildNotificationContent({ content: 'hi', messageType: 'text' }).title).toBe('新訊息')
  })

  it('文字訊息取前 60 字', () => {
    const long = 'あ'.repeat(80)
    const { body } = buildNotificationContent({ content: long, messageType: 'text' })
    expect(body).toBe('あ'.repeat(60))
  })

  it('非文字型別顯示對應描述;空內容 fallback', () => {
    expect(buildNotificationContent({ messageType: 'image' }).body).toBe('傳送了圖片')
    expect(buildNotificationContent({ messageType: 'sticker' }).body).toBe('傳送了貼圖')
    expect(buildNotificationContent({ messageType: 'file' }).body).toBe('傳送了檔案')
    expect(buildNotificationContent({ messageType: 'video' }).body).toBe('傳送了影片')
    expect(buildNotificationContent({ messageType: 'audio' }).body).toBe('傳送了語音')
    expect(buildNotificationContent({ messageType: 'text' }).body).toBe('傳送了新訊息')
  })
})
