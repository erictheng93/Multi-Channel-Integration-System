import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createNewMessageHandler, useDesktopNotifications, type DesktopNotificationDeps } from './useDesktopNotifications'
import { __resetDesktopNotificationPrefsForTest, useDesktopNotificationPrefs } from './useDesktopNotificationPrefs'
import type { WebSocketMessage } from '@/services/websocketClient'
import type { Conversation } from '@/types'

const stores = vi.hoisted(() => ({
  websocket: { subscribe: vi.fn(), unsubscribe: vi.fn() },
  conversations: {
    conversations: [] as Conversation[],
    currentConversation: null as Conversation | null
  },
  auth: { allowedTeamIds: [1] }
}))

vi.mock('@/stores/websocket', () => ({ useWebSocketStore: () => stores.websocket }))
vi.mock('@/stores/conversations', () => ({ useConversationsStore: () => stores.conversations }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => stores.auth }))

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

  it('扁平 senderName(後端實際格式)→ 用於通知標題', () => {
    const handler = createNewMessageHandler(deps)
    handler(makeMessage({ data: { senderType: 'customer', content: '你好', messageType: 'text', senderName: '陳大文' } }))
    expect(shown.length).toBe(1)
    expect(shown[0]?.title).toBe('陳大文')
  })
})

describe('useDesktopNotifications route and conversation integration', () => {
  let router: ReturnType<typeof createRouter>
  let wrapper: VueWrapper | undefined
  let showNotification: ReturnType<typeof vi.fn>

  beforeEach(() => {
    stores.websocket.subscribe.mockReset().mockReturnValue('desktop-subscription')
    stores.websocket.unsubscribe.mockReset()
    stores.conversations.conversations = []
    stores.conversations.currentConversation = null
    localStorage.clear()
    __resetDesktopNotificationPrefsForTest()
    showNotification = vi.fn(class { close = vi.fn() })
    Object.assign(showNotification, { permission: 'granted' })
    vi.stubGlobal('Notification', showNotification)
    useDesktopNotificationPrefs().setPrefs({ soundEnabled: false })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const page = { render: () => null }
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/conversations/:id', name: 'ConversationDetail', component: page },
        { path: '/dashboard', name: 'Dashboard', component: page },
        { path: '/other/:id', name: 'OtherDetail', component: page }
      ]
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function startNotifications(path: string) {
    await router.push(path)
    wrapper = mount({
      setup() {
        useDesktopNotifications().start()
        return () => null
      }
    }, { global: { plugins: [router] } })
    return stores.websocket.subscribe.mock.calls[0]?.[1] as (_message: WebSocketMessage) => void
  }

  it('離開對話到儀表板後，即使 currentConversation 仍保留也恢復通知', async () => {
    stores.conversations.currentConversation = makeConversation('conv-1', 1)
    const handleMessage = await startNotifications('/conversations/conv-1')
    handleMessage(makeMessage())
    expect(showNotification).not.toHaveBeenCalled()

    await router.push('/dashboard')
    handleMessage(makeMessage())
    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('切到其他 App（分頁仍 visible 但視窗失焦）時，停在該對話也要通知', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const handleMessage = await startNotifications('/conversations/conv-1')
    handleMessage(makeMessage())
    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('對話路由仍在前景時，即使 store 尚未載入也抑制通知', async () => {
    const handleMessage = await startNotifications('/conversations/conv-1')
    handleMessage(makeMessage())
    expect(showNotification).not.toHaveBeenCalled()
  })

  it.each(['/conversations/conv-2', '/other/conv-1'])(
    '停在 %s 時不因殘留的 currentConversation 抑制其他對話通知', async (path) => {
      stores.conversations.currentConversation = makeConversation('conv-1', 1)
      const handleMessage = await startNotifications(path)
      handleMessage(makeMessage())
      expect(showNotification).toHaveBeenCalledTimes(1)
    }
  )

  it('my-teams 模式在背景以相同 id 的 currentConversation 補足空列表', async () => {
    useDesktopNotificationPrefs().setPrefs({ scope: 'my-teams' })
    stores.conversations.currentConversation = makeConversation('conv-1', 1)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const handleMessage = await startNotifications('/conversations/conv-1')
    handleMessage(makeMessage())
    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('my-teams 模式不借用其他 currentConversation 的團隊資料', async () => {
    useDesktopNotificationPrefs().setPrefs({ scope: 'my-teams' })
    stores.conversations.currentConversation = makeConversation('conv-other', 1)
    const handleMessage = await startNotifications('/dashboard')
    handleMessage(makeMessage())
    expect(showNotification).not.toHaveBeenCalled()
  })
})
