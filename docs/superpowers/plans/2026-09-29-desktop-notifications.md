# 新訊息桌面提醒(功能三)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 客服開著系統分頁時,客戶新訊息彈出瀏覽器桌面通知,點擊直達該對話;含範圍過濾、打擾抑制、合併節流、提示音與標題未讀數。

**Architecture:** 純前端。三個 composable(偏好/核心/標題)+ 擴充既有 `NotificationSettingsModal`。核心邏輯以依賴注入的 handler 工廠實作,單測不需 mock Vue/Pinia 模組。規格:`docs/superpowers/specs/2026-09-29-desktop-notifications-design.md`。

**Tech Stack:** Vue 3 Composition API + TypeScript strict、Pinia、Vitest(jsdom)、原生 Notification API。Bun 為套件管理器(`bun run` / `bunx`)。

**交付規則(必守):**
- 程式碼變更走分支 + PR,**不直接 push main**(使用者指示)。
- 每個 Task 結尾 commit 一次;PostToolUse hook 會在每次編輯後自動跑 vue-tsc + eslint,**報錯立即修,不要問**。
- 不觸碰 `serviceWorkerManager.ts` 的 Web Push 佔位碼;不改後端、無 migration。
- 全域按鈕類(`.btn` 等)只能使用,不得在元件 `<style>` 重定義(`bun run lint:scoped-btn` 會擋)。

**已驗證的既有介面(實作時直接引用,不要自己發明):**
- `useWebSocketStore()`(`frontend/src/stores/websocket.ts`):`subscribe(channel: string, handler: (m: WebSocketMessage) => void): string`、`unsubscribe(id: string)`。`new_message` 事件已路由到 `'conversations'` channel(`frontend/src/services/websocketEventRouter.ts:61`)。
- `WebSocketMessage`(`frontend/src/services/websocketClient.ts:23`):`{ type: string; data?: unknown; timestamp?: number; messageId?: string; conversationId?: string; userId?: string }`。`new_message` 的 `data` 內含 `content`、`messageType`、`sender: {id?, name?, role?}`、`senderType: 'customer' | 'agent'`(參考 `frontend/src/stores/conversations/realtimeHandler.ts:144-176` 的解析方式)。
- `useConversationsStore()`(`frontend/src/stores/conversations.ts`):`conversations: Conversation[]`、`currentConversation: Conversation | null`。
- `Conversation`(`shared/types/entities.ts:61`):`id`、`customer?: User`(`User.name` 為客戶名稱,**沒有** displayName)、`assignedTeamId?: number`、`unreadCount: number`。
- `useAuthStore()`(`frontend/src/stores/auth.ts`):`allowedTeamIds: number[]`、`isAuthenticated: boolean`。
- 對話路由:`{ name: 'ConversationDetail', params: { id } }`(`frontend/src/router/index.ts:52-53`)。
- 圖示:`MonitorIcon`、`BellIcon`、`VolumeIcon` 皆在 `@/components/icons`。
- `frontend/public/` **沒有** favicon/icon 檔 → `new Notification()` 不帶 `icon` 選項。
- Logger:`import { createLogger } from '@/utils/logger'`。

---

### Task 1: 建立 feature 分支

**Files:** 無

- [ ] **Step 1: 從最新 main 開分支**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git checkout main && git pull
git checkout -b feature/desktop-notifications
```

Expected: `Switched to a new branch 'feature/desktop-notifications'`

---

### Task 2: 純判斷邏輯 `desktopNotificationLogic.ts`

彈/不彈的整條判斷鏈與通知內容組裝,寫成無依賴的純函式。

**Files:**
- Create: `frontend/src/composables/notification/desktopNotificationLogic.ts`
- Test: `frontend/src/composables/notification/desktopNotificationLogic.test.ts`

- [ ] **Step 1: 寫失敗測試**

```typescript
// frontend/src/composables/notification/desktopNotificationLogic.test.ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System/frontend
bunx vitest run src/composables/notification/desktopNotificationLogic.test.ts
```

Expected: FAIL(`Cannot find module './desktopNotificationLogic'`)

- [ ] **Step 3: 實作**

```typescript
// frontend/src/composables/notification/desktopNotificationLogic.ts
/**
 * Desktop Notification Decision Logic
 *
 * 桌面通知的彈/不彈判斷鏈與內容組裝(純函式,無 Vue/Pinia 依賴)
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import type { Conversation } from '@/types'

export type DesktopNotificationScope = 'all' | 'my-teams'
export type DesktopPermission = NotificationPermission | 'unsupported'

/** 同一對話兩次通知的最小間隔(搭配 Notification tag 取代機制) */
export const NOTIFY_MIN_INTERVAL_MS = 3000

const BODY_MAX_LENGTH = 60

export interface NotificationDecisionInput {
  eventType: string
  senderType?: 'customer' | 'agent'
  conversationId?: string
  prefsEnabled: boolean
  permission: DesktopPermission
  scope: DesktopNotificationScope
  assignedTeamId?: number
  allowedTeamIds: number[]
  isTabVisible: boolean
  currentConversationId: string | null
  lastNotifiedAt?: number
  now: number
}

export function shouldNotify(input: NotificationDecisionInput): boolean {
  if (input.eventType !== 'new_message') return false
  if (input.senderType !== 'customer') return false
  if (!input.conversationId) return false
  if (!input.prefsEnabled) return false
  if (input.permission !== 'granted') return false

  if (input.scope === 'my-teams') {
    // 未指派團隊(或對話不在列表中查不到指派)一律視為範圍外
    if (input.assignedTeamId === undefined || !input.allowedTeamIds.includes(input.assignedTeamId)) {
      return false
    }
  }

  // 打擾抑制:分頁前景且正在看該對話才抑制;背景分頁一律彈
  if (input.isTabVisible && input.currentConversationId === input.conversationId) return false

  if (input.lastNotifiedAt !== undefined && input.now - input.lastNotifiedAt < NOTIFY_MIN_INTERVAL_MS) {
    return false
  }

  return true
}

export interface NotificationContentInput {
  senderName?: string
  conversation?: Conversation
  content?: string
  messageType?: string
}

export interface NotificationContent {
  title: string
  body: string
}

const MEDIA_BODY: Record<string, string> = {
  image: '傳送了圖片',
  sticker: '傳送了貼圖',
  file: '傳送了檔案',
  video: '傳送了影片',
  audio: '傳送了語音'
}

export function buildNotificationContent(input: NotificationContentInput): NotificationContent {
  const title = input.senderName || input.conversation?.customer?.name || '新訊息'

  const mediaBody = input.messageType ? MEDIA_BODY[input.messageType] : undefined
  const body = mediaBody ?? ((input.content ?? '').slice(0, BODY_MAX_LENGTH) || '傳送了新訊息')

  return { title, body }
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
bunx vitest run src/composables/notification/desktopNotificationLogic.test.ts
```

Expected: PASS(9 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git add frontend/src/composables/notification/desktopNotificationLogic.ts frontend/src/composables/notification/desktopNotificationLogic.test.ts
git commit -m "feat(frontend): add desktop notification decision logic

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 偏好與權限 `useDesktopNotificationPrefs.ts`

每裝置 localStorage 偏好(模組級單例,App 與 Modal 共享同一份 reactive 狀態)+ 權限狀態機讀取面。

**Files:**
- Create: `frontend/src/composables/notification/useDesktopNotificationPrefs.ts`
- Test: `frontend/src/composables/notification/useDesktopNotificationPrefs.test.ts`

- [ ] **Step 1: 寫失敗測試**

```typescript
// frontend/src/composables/notification/useDesktopNotificationPrefs.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  useDesktopNotificationPrefs,
  __resetDesktopNotificationPrefsForTest,
  DESKTOP_NOTIFICATION_PREFS_KEY
} from './useDesktopNotificationPrefs'

describe('useDesktopNotificationPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetDesktopNotificationPrefsForTest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('無存檔時回傳預設值', () => {
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.enabled).toBe(true)
    expect(prefs.scope).toBe('all')
    expect(prefs.soundEnabled).toBe(true)
  })

  it('setPrefs 更新並持久化到 localStorage', () => {
    const { prefs, setPrefs } = useDesktopNotificationPrefs()
    setPrefs({ scope: 'my-teams', soundEnabled: false })
    expect(prefs.scope).toBe('my-teams')
    const stored = JSON.parse(localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY) as string)
    expect(stored).toEqual({ enabled: true, scope: 'my-teams', soundEnabled: false })
  })

  it('從 localStorage 載入既有偏好,缺欄位補預設值', () => {
    localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, JSON.stringify({ enabled: false }))
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.enabled).toBe(false)
    expect(prefs.scope).toBe('all')
  })

  it('localStorage 損壞 JSON → 回退預設值不 throw', () => {
    localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, '{not json')
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.enabled).toBe(true)
  })

  it('localStorage 不可寫(private mode)→ setPrefs 仍更新記憶體狀態', () => {
    const { prefs, setPrefs } = useDesktopNotificationPrefs()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    setPrefs({ enabled: false })
    expect(prefs.enabled).toBe(false)
  })

  it('兩次呼叫共享同一份狀態(單例)', () => {
    const a = useDesktopNotificationPrefs()
    const b = useDesktopNotificationPrefs()
    a.setPrefs({ enabled: false })
    expect(b.prefs.enabled).toBe(false)
  })

  it('權限:支援時反映 Notification.permission;requestPermission 更新狀態', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })
    __resetDesktopNotificationPrefsForTest()

    const { permission, requestDesktopPermission } = useDesktopNotificationPrefs()
    expect(permission.value).toBe('default')
    const result = await requestDesktopPermission()
    expect(result).toBe('granted')
    expect(permission.value).toBe('granted')
  })

  it('權限:環境不支援 Notification → unsupported,requestDesktopPermission 回傳 unsupported', async () => {
    vi.stubGlobal('Notification', undefined)
    __resetDesktopNotificationPrefsForTest()

    const { permission, requestDesktopPermission } = useDesktopNotificationPrefs()
    expect(permission.value).toBe('unsupported')
    await expect(requestDesktopPermission()).resolves.toBe('unsupported')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
bunx vitest run src/composables/notification/useDesktopNotificationPrefs.test.ts
```

Expected: FAIL(module not found)

- [ ] **Step 3: 實作**

```typescript
// frontend/src/composables/notification/useDesktopNotificationPrefs.ts
/**
 * Desktop Notification Preferences (per-device)
 *
 * 每裝置偏好存 localStorage(瀏覽器通知權限本身即每裝置授權,偏好與其同生命週期)。
 * 模組級單例:App.vue 的通知核心與 NotificationSettingsModal 共享同一份 reactive 狀態。
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import { reactive, ref, type Ref } from 'vue'
import { createLogger } from '@/utils/logger'
import type { DesktopNotificationScope, DesktopPermission } from './desktopNotificationLogic'

const logger = createLogger('useDesktopNotificationPrefs')

export const DESKTOP_NOTIFICATION_PREFS_KEY = 'desktop-notification-prefs'

export interface DesktopNotificationPrefs {
  enabled: boolean
  scope: DesktopNotificationScope
  soundEnabled: boolean
}

const DEFAULT_PREFS: DesktopNotificationPrefs = {
  enabled: true,
  scope: 'all',
  soundEnabled: true
}

function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined'
}

function readStoredPrefs(): DesktopNotificationPrefs {
  try {
    const raw = localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY)
    if (raw) {
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DesktopNotificationPrefs>) }
    }
  } catch (error) {
    logger.debug('Failed to read desktop notification prefs, using defaults', error)
  }
  return { ...DEFAULT_PREFS }
}

// ==================== Module-level singleton state ====================

let initialized = false
const prefs = reactive<DesktopNotificationPrefs>({ ...DEFAULT_PREFS })
const permission: Ref<DesktopPermission> = ref('unsupported')

function ensureInitialized(): void {
  if (initialized) return
  Object.assign(prefs, readStoredPrefs())
  permission.value = isNotificationSupported() ? Notification.permission : 'unsupported'
  initialized = true
}

// ==================== Composable ====================

export function useDesktopNotificationPrefs() {
  ensureInitialized()

  const setPrefs = (patch: Partial<DesktopNotificationPrefs>): void => {
    Object.assign(prefs, patch)
    try {
      localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs))
    } catch (error) {
      // private mode 等:僅記憶體生效,不持久化
      logger.debug('Failed to persist desktop notification prefs', error)
    }
  }

  /** 重新讀取瀏覽器權限(使用者可能在瀏覽器設定中變更) */
  const refreshPermission = (): void => {
    permission.value = isNotificationSupported() ? Notification.permission : 'unsupported'
  }

  /** 必須在使用者手勢(點擊)中呼叫 */
  const requestDesktopPermission = async (): Promise<DesktopPermission> => {
    if (!isNotificationSupported()) return 'unsupported'
    try {
      const result = await Notification.requestPermission()
      permission.value = result
      return result
    } catch (error) {
      logger.debug('requestPermission failed', error)
      refreshPermission()
      return permission.value
    }
  }

  return { prefs, setPrefs, permission, refreshPermission, requestDesktopPermission }
}

/** 僅供測試重置模組單例 */
export function __resetDesktopNotificationPrefsForTest(): void {
  initialized = false
  Object.assign(prefs, DEFAULT_PREFS)
  permission.value = 'unsupported'
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
bunx vitest run src/composables/notification/useDesktopNotificationPrefs.test.ts
```

Expected: PASS(8 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git add frontend/src/composables/notification/useDesktopNotificationPrefs.ts frontend/src/composables/notification/useDesktopNotificationPrefs.test.ts
git commit -m "feat(frontend): add per-device desktop notification prefs composable

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 提示音資產 + 事件 handler + `useDesktopNotifications.ts`

handler 用依賴注入工廠 `createNewMessageHandler(deps)` 實作(測試不需 mock 任何模組);`useDesktopNotifications()` 負責接上真實依賴與訂閱生命週期。

**Files:**
- Create: `frontend/public/sounds/notification.wav`(以下方 node 指令產生)
- Create: `frontend/src/composables/notification/useDesktopNotifications.ts`
- Test: `frontend/src/composables/notification/useDesktopNotifications.test.ts`
- Modify: `docs/superpowers/specs/2026-09-29-desktop-notifications-design.md`(音效副檔名 mp3 → wav)

- [ ] **Step 1: 產生提示音資產(0.18 秒 880Hz 短音,約 8KB)**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System/frontend
node -e '
const fs = require("fs");
const sr = 22050, dur = 0.18, n = Math.floor(sr * dur);
const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  const t = i / sr;
  const env = Math.min(1, i / 200) * Math.exp(-6 * t);
  const s = Math.sin(2 * Math.PI * 880 * t) * env * 0.4;
  data.writeInt16LE(Math.round(s * 32767), i * 2);
}
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVE", 8);
hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
hdr.writeUInt32LE(sr, 24); hdr.writeUInt32LE(sr * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
fs.mkdirSync("public/sounds", { recursive: true });
fs.writeFileSync("public/sounds/notification.wav", Buffer.concat([hdr, data]));
console.log("written", 44 + data.length, "bytes");
'
```

Expected: `written 7982 bytes`(約略值)

- [ ] **Step 2: 同步規格文件的副檔名**

在 `docs/superpowers/specs/2026-09-29-desktop-notifications-design.md` 把
`frontend/public/sounds/notification.mp3` 改為 `frontend/public/sounds/notification.wav`(mp3 需編碼器,wav 可由 node 直接產生,對 `new Audio()` 播放無差異)。

- [ ] **Step 3: 寫失敗測試**

```typescript
// frontend/src/composables/notification/useDesktopNotifications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
```

- [ ] **Step 4: 跑測試確認失敗**

```bash
bunx vitest run src/composables/notification/useDesktopNotifications.test.ts
```

Expected: FAIL(module not found)

- [ ] **Step 5: 實作**

```typescript
// frontend/src/composables/notification/useDesktopNotifications.ts
/**
 * Desktop Notifications for new customer messages
 *
 * 訂閱全域 WebSocket 'conversations' channel,對客戶新訊息彈瀏覽器桌面通知。
 * 核心 handler 以依賴注入工廠實作(createNewMessageHandler),單測無需 mock 模組;
 * useDesktopNotifications() 接上真實 stores / Notification API / router 與訂閱生命週期。
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import { onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useWebSocketStore } from '@/stores/websocket'
import { useConversationsStore } from '@/stores/conversations'
import { useAuthStore } from '@/stores/auth'
import type { WebSocketMessage } from '@/services/websocketClient'
import type { Conversation } from '@/types'
import { createLogger } from '@/utils/logger'
import {
  shouldNotify,
  buildNotificationContent,
  type DesktopPermission
} from './desktopNotificationLogic'
import { useDesktopNotificationPrefs, type DesktopNotificationPrefs } from './useDesktopNotificationPrefs'

const logger = createLogger('useDesktopNotifications')

const NOTIFICATION_SOUND_URL = '/sounds/notification.wav'

export interface DesktopNotificationDeps {
  prefs: DesktopNotificationPrefs
  getPermission: () => DesktopPermission
  getConversation: (_id: string) => Conversation | undefined
  getCurrentConversationId: () => string | null
  getAllowedTeamIds: () => number[]
  isTabVisible: () => boolean
  showNotification: (_args: { conversationId: string; title: string; body: string }) => void
  playSound: () => void
  now: () => number
}

export function createNewMessageHandler(deps: DesktopNotificationDeps): (_message: WebSocketMessage) => void {
  const lastNotifiedAt = new Map<string, number>()

  return (message: WebSocketMessage): void => {
    try {
      const data = message.data as Record<string, unknown> | undefined
      const conversationId = message.conversationId || (data?.conversationId as string | undefined)
      const senderType = data?.senderType as 'customer' | 'agent' | undefined
      if (!conversationId) return

      const conversation = deps.getConversation(conversationId)

      const notify = shouldNotify({
        eventType: message.type,
        senderType,
        conversationId,
        prefsEnabled: deps.prefs.enabled,
        permission: deps.getPermission(),
        scope: deps.prefs.scope,
        assignedTeamId: conversation?.assignedTeamId,
        allowedTeamIds: deps.getAllowedTeamIds(),
        isTabVisible: deps.isTabVisible(),
        currentConversationId: deps.getCurrentConversationId(),
        lastNotifiedAt: lastNotifiedAt.get(conversationId),
        now: deps.now()
      })
      if (!notify) return

      lastNotifiedAt.set(conversationId, deps.now())

      const sender = data?.sender as { name?: string } | undefined
      const { title, body } = buildNotificationContent({
        senderName: sender?.name,
        conversation,
        content: data?.content as string | undefined,
        messageType: data?.messageType as string | undefined
      })

      deps.showNotification({ conversationId, title, body })
      if (deps.prefs.soundEnabled) deps.playSound()
    } catch (error) {
      // 通知失敗絕不影響訊息流
      logger.debug('Desktop notification failed', error)
    }
  }
}

export function useDesktopNotifications() {
  const wsStore = useWebSocketStore()
  const conversationsStore = useConversationsStore()
  const authStore = useAuthStore()
  const router = useRouter()
  const { prefs, permission } = useDesktopNotificationPrefs()

  const playSound = (): void => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL)
      audio.volume = 0.5
      void audio.play().catch(() => { /* autoplay 政策等,靜默忽略 */ })
    } catch (error) {
      logger.debug('Failed to play notification sound', error)
    }
  }

  const showNotification = (args: { conversationId: string; title: string; body: string }): void => {
    // 不帶 icon:frontend/public 目前沒有 icon 資產
    const notification = new Notification(args.title, {
      body: args.body,
      tag: `conversation-${args.conversationId}` // 同對話新通知自動取代舊通知
    })
    notification.onclick = () => {
      try {
        window.focus()
        void router.push({ name: 'ConversationDetail', params: { id: args.conversationId } })
        notification.close()
      } catch (error) {
        logger.debug('Notification click navigation failed', error)
      }
    }
  }

  const handler = createNewMessageHandler({
    prefs,
    getPermission: () => permission.value,
    getConversation: (id) => conversationsStore.conversations.find((c: Conversation) => c.id === id),
    getCurrentConversationId: () => conversationsStore.currentConversation?.id ?? null,
    getAllowedTeamIds: () => authStore.allowedTeamIds,
    isTabVisible: () => document.visibilityState === 'visible',
    showNotification,
    playSound,
    now: () => Date.now()
  })

  let subscriptionId: string | null = null

  const start = (): void => {
    if (subscriptionId) return
    subscriptionId = wsStore.subscribe('conversations', handler)
    logger.debug('Desktop notifications started')
  }

  const stop = (): void => {
    if (!subscriptionId) return
    wsStore.unsubscribe(subscriptionId)
    subscriptionId = null
    logger.debug('Desktop notifications stopped')
  }

  onBeforeUnmount(stop)

  return { start, stop }
}
```

- [ ] **Step 6: 跑測試確認通過**

```bash
bunx vitest run src/composables/notification/useDesktopNotifications.test.ts
```

Expected: PASS(8 tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git add frontend/public/sounds/notification.wav \
  frontend/src/composables/notification/useDesktopNotifications.ts \
  frontend/src/composables/notification/useDesktopNotifications.test.ts \
  docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
git commit -m "feat(frontend): add desktop notification pipeline with sound

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 標題未讀數 `usePageTitleUnread.ts`

**Files:**
- Create: `frontend/src/composables/notification/usePageTitleUnread.ts`
- Test: `frontend/src/composables/notification/usePageTitleUnread.test.ts`

- [ ] **Step 1: 寫失敗測試(純函式)**

```typescript
// frontend/src/composables/notification/usePageTitleUnread.test.ts
import { describe, it, expect } from 'vitest'
import { formatTitleWithUnread } from './usePageTitleUnread'

describe('formatTitleWithUnread', () => {
  it('無未讀 → 原標題', () => {
    expect(formatTitleWithUnread('對話 - Multi-Channel Support', 0)).toBe('對話 - Multi-Channel Support')
  })

  it('有未讀 → 加 (N) 前綴', () => {
    expect(formatTitleWithUnread('對話 - Multi-Channel Support', 3)).toBe('(3) 對話 - Multi-Channel Support')
  })

  it('已有前綴 → 取代而非疊加', () => {
    expect(formatTitleWithUnread('(2) 對話 - Multi-Channel Support', 5)).toBe('(5) 對話 - Multi-Channel Support')
  })

  it('未讀歸零 → 移除前綴', () => {
    expect(formatTitleWithUnread('(2) 對話 - Multi-Channel Support', 0)).toBe('對話 - Multi-Channel Support')
  })

  it('超過 99 → 顯示 99+;99+ 前綴也可被取代', () => {
    expect(formatTitleWithUnread('對話', 120)).toBe('(99+) 對話')
    expect(formatTitleWithUnread('(99+) 對話', 3)).toBe('(3) 對話')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
bunx vitest run src/composables/notification/usePageTitleUnread.test.ts
```

Expected: FAIL(module not found)

- [ ] **Step 3: 實作**

```typescript
// frontend/src/composables/notification/usePageTitleUnread.ts
/**
 * Page Title Unread Count
 *
 * 將 conversations store 的總未讀數以 "(N) " 前綴顯示在 document.title。
 * router/index.ts 的 afterEach 會依路由 meta.title 重設 document.title,
 * 本 composable 的 afterEach 註冊在其後,於 nextTick 重新套用前綴,不修改 router 本身。
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import { computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
import type { Conversation } from '@/types'

const UNREAD_PREFIX_RE = /^\(\d+\+?\)\s/

export function formatTitleWithUnread(currentTitle: string, unread: number): string {
  const base = currentTitle.replace(UNREAD_PREFIX_RE, '')
  if (unread <= 0) return base
  const display = unread > 99 ? '99+' : String(unread)
  return `(${display}) ${base}`
}

export function usePageTitleUnread() {
  const conversationsStore = useConversationsStore()
  const router = useRouter()

  const totalUnread = computed(() =>
    conversationsStore.conversations.reduce(
      (sum: number, c: Conversation) => sum + (c.unreadCount || 0),
      0
    )
  )

  const applyTitle = (): void => {
    document.title = formatTitleWithUnread(document.title, totalUnread.value)
  }

  watch(totalUnread, applyTitle)

  // 路由切換後 router 自身的 afterEach 已重設 title,等 nextTick 再補前綴
  router.afterEach(() => {
    void nextTick(applyTitle)
  })

  return { totalUnread, applyTitle }
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
bunx vitest run src/composables/notification/usePageTitleUnread.test.ts
```

Expected: PASS(5 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git add frontend/src/composables/notification/usePageTitleUnread.ts frontend/src/composables/notification/usePageTitleUnread.test.ts
git commit -m "feat(frontend): show unread count in page title

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: NotificationSettingsModal 桌面通知區塊

在既有 Modal 最上方新增「桌面通知(此裝置)」settings-group,依權限四態渲染。沿用既有 `.settings-toggle` 樣式與全域 `.btn` 類(不得重定義)。

**Files:**
- Modify: `frontend/src/components/notification/NotificationSettingsModal.vue`
- Test: `tests/unit/components/notification-settings-desktop.test.ts`(在 `frontend/tests/unit/components/`)

- [ ] **Step 1: 寫失敗測試**

```typescript
// frontend/tests/unit/components/notification-settings-desktop.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationSettingsModal from '@/components/notification/NotificationSettingsModal.vue'
import { __resetDesktopNotificationPrefsForTest, useDesktopNotificationPrefs } from '@/composables/notification/useDesktopNotificationPrefs'

const baseSettings = {
  pushEnabled: true,
  soundEnabled: true,
  emailEnabled: false,
  messageEnabled: true,
  assignmentEnabled: true,
  mentionEnabled: true
}

function mountModal() {
  return mount(NotificationSettingsModal, {
    props: { visible: true, settings: baseSettings },
    global: {
      stubs: {
        Modal: { template: '<div><slot /><slot name="footer" /></div>' }
      }
    }
  })
}

describe('NotificationSettingsModal desktop section', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetDesktopNotificationPrefsForTest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('permission=default → 顯示啟用按鈕', () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
    __resetDesktopNotificationPrefsForTest()
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-enable-btn"]').exists()).toBe(true)
  })

  it('permission=granted → 顯示三個開關', () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    __resetDesktopNotificationPrefsForTest()
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-enabled-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-scope-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-sound-toggle"]').exists()).toBe(true)
  })

  it('permission=denied → 顯示封鎖說明', () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() })
    __resetDesktopNotificationPrefsForTest()
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-denied-hint"]').exists()).toBe(true)
  })

  it('不支援 Notification → 顯示不支援說明', () => {
    vi.stubGlobal('Notification', undefined)
    __resetDesktopNotificationPrefsForTest()
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-unsupported-hint"]').exists()).toBe(true)
  })

  it('點啟用按鈕 → 呼叫 requestPermission,granted 後切換為開關畫面', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })
    __resetDesktopNotificationPrefsForTest()
    const wrapper = mountModal()
    await wrapper.find('[data-testid="desktop-enable-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(requestPermission).toHaveBeenCalled()
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="desktop-enabled-toggle"]').exists()).toBe(true)
  })

  it('切換範圍開關 → prefs.scope 更新為 my-teams', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    __resetDesktopNotificationPrefsForTest()
    const wrapper = mountModal()
    await wrapper.find('[data-testid="desktop-scope-toggle"]').setValue(true)
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.scope).toBe('my-teams')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
bunx vitest run tests/unit/components/notification-settings-desktop.test.ts
```

Expected: FAIL(`data-testid` 元素不存在)

- [ ] **Step 3: 修改 Modal**

在 `NotificationSettingsModal.vue` 的 template 中,於第一個 `.settings-group`(「通知偏好」)**之前**插入:

```vue
    <!-- Desktop Notifications (per-device) -->
    <div class="settings-group">
      <h3 class="settings-group-title">
        桌面通知（此裝置）
      </h3>

      <p
        v-if="desktopPermission === 'unsupported'"
        data-testid="desktop-unsupported-hint"
        class="desktop-hint"
      >
        此瀏覽器不支援桌面通知（需使用 HTTPS 與支援通知的瀏覽器）。
      </p>

      <template v-else-if="desktopPermission === 'default'">
        <p class="desktop-hint">
          啟用後，收到新客戶訊息時會跳出桌面通知（僅在此裝置生效）。
        </p>
        <button
          data-testid="desktop-enable-btn"
          class="btn btn-primary"
          @click="onEnableDesktop"
        >
          啟用桌面通知
        </button>
      </template>

      <p
        v-else-if="desktopPermission === 'denied'"
        data-testid="desktop-denied-hint"
        class="desktop-hint"
      >
        桌面通知已被瀏覽器封鎖，無法由系統重新開啟。請點擊網址列左側的鎖頭（或設定）圖示 → 網站設定 → 通知 → 改為「允許」，再重新整理頁面。若仍未跳出通知，請檢查 Windows「設定 → 系統 → 通知」已允許瀏覽器，且未開啟「專注助理」。
      </p>

      <template v-else>
        <label class="settings-toggle">
          <span class="toggle-label">
            <MonitorIcon class="toggle-icon" />
            <span>
              <strong>桌面通知</strong>
              <small>收到新客戶訊息時跳出系統通知</small>
            </span>
          </span>
          <input
            data-testid="desktop-enabled-toggle"
            type="checkbox"
            class="toggle-input"
            :checked="desktopPrefs.enabled"
            @change="setDesktopPrefs({ enabled: ($event.target as HTMLInputElement).checked })"
          >
          <span class="toggle-switch" />
        </label>

        <label class="settings-toggle">
          <span class="toggle-label">
            <BellIcon class="toggle-icon" />
            <span>
              <strong>只提醒我所屬團隊</strong>
              <small>僅指派給我所屬團隊的對話才通知；關閉則所有對話都通知</small>
            </span>
          </span>
          <input
            data-testid="desktop-scope-toggle"
            type="checkbox"
            class="toggle-input"
            :checked="desktopPrefs.scope === 'my-teams'"
            @change="setDesktopPrefs({ scope: ($event.target as HTMLInputElement).checked ? 'my-teams' : 'all' })"
          >
          <span class="toggle-switch" />
        </label>

        <label class="settings-toggle">
          <span class="toggle-label">
            <VolumeIcon class="toggle-icon" />
            <span>
              <strong>通知音效（此裝置）</strong>
              <small>桌面通知時播放提示音</small>
            </span>
          </span>
          <input
            data-testid="desktop-sound-toggle"
            type="checkbox"
            class="toggle-input"
            :checked="desktopPrefs.soundEnabled"
            @change="setDesktopPrefs({ soundEnabled: ($event.target as HTMLInputElement).checked })"
          >
          <span class="toggle-switch" />
        </label>
      </template>
    </div>
```

`<script setup>` 增加(併入既有 import 區;`MonitorIcon` 加進既有 icons import):

```typescript
import { watch } from 'vue'
import { useDesktopNotificationPrefs } from '@/composables/notification/useDesktopNotificationPrefs'

const {
  prefs: desktopPrefs,
  setPrefs: setDesktopPrefs,
  permission: desktopPermission,
  refreshPermission,
  requestDesktopPermission
} = useDesktopNotificationPrefs()

// 開啟 Modal 時重新讀取權限(使用者可能已在瀏覽器設定變更)
watch(() => props.visible, (visible) => {
  if (visible) refreshPermission()
})

const onEnableDesktop = async (): Promise<void> => {
  const result = await requestDesktopPermission()
  if (result === 'granted') {
    setDesktopPrefs({ enabled: true })
  }
}
```

注意:既有 `const props = defineProps<...>()` 已存在,直接使用 `props.visible`;`computed` import 已存在,新增的 `watch` 併入同一行 vue import。

`<style scoped>` 末端新增(只是提示文字樣式,不觸碰任何 `.btn` 類):

```css
.desktop-hint {
  font-size: 0.8125rem;
  color: var(--gray-500);
  margin: 0 0 var(--space-3);
  line-height: 1.6;
}
```

- [ ] **Step 4: 跑測試確認通過**

```bash
bunx vitest run tests/unit/components/notification-settings-desktop.test.ts
```

Expected: PASS(6 tests)

- [ ] **Step 5: Commit**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git add frontend/src/components/notification/NotificationSettingsModal.vue frontend/tests/unit/components/notification-settings-desktop.test.ts
git commit -m "feat(frontend): desktop notification settings in notification modal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: App.vue 掛載 + 全量檢查

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 掛載兩個 composable**

在 `frontend/src/App.vue` 的 `<script setup>`:

import 區新增(放在既有 composable imports 之後):

```typescript
import { useDesktopNotifications } from '@/composables/notification/useDesktopNotifications'
import { usePageTitleUnread } from '@/composables/notification/usePageTitleUnread'
```

在 `const { showDisabledModal } = useAccountStatusMonitor()` 之後新增:

```typescript
// 桌面通知:登入後啟動,登出停止(訂閱全域 WebSocket conversations channel)
const { start: startDesktopNotifications, stop: stopDesktopNotifications } = useDesktopNotifications()
usePageTitleUnread()

watch(() => authStore.isAuthenticated, (authenticated) => {
  if (authenticated) {
    startDesktopNotifications()
  } else {
    stopDesktopNotifications()
  }
}, { immediate: true })
```

注意:`watch` 已在 App.vue 的 vue import 中,`authStore` 已存在,不要重複宣告。

- [ ] **Step 2: 跑該功能全部測試**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System/frontend
bunx vitest run src/composables/notification/ tests/unit/components/notification-settings-desktop.test.ts
```

Expected: PASS(全部,約 28 tests)

- [ ] **Step 3: 全量健康檢查**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
bash scripts/check.sh frontend
```

Expected: vue-tsc 0 errors、eslint 0 errors。有錯就修到綠,不要問。

- [ ] **Step 4: 跑前端既有整體測試,確認無回歸**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System/frontend
bun run test
```

Expected: 全數 PASS(若有既有測試因 `document.title` 或 Notification stub 相互汙染而失敗,檢查該測試是否需要在 beforeEach 重置;不得刪測試)

- [ ] **Step 5: Commit**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git add frontend/src/App.vue
git commit -m "feat(frontend): mount desktop notifications and title unread count

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Push 分支 + 開 PR

**Files:** 無

- [ ] **Step 1: Push(pre-push 會跑 tsc + vue-tsc + eslint,約 105s 起)**

```bash
cd /Users/kkllzz_0/Multi-Channel-Integration-System
git push -u origin feature/desktop-notifications
```

Expected: push 成功。pre-push 檢查失敗就修正、補 commit、重推;不得 `--no-verify`。

- [ ] **Step 2: 開 PR**

```bash
gh pr create \
  --title "feat(frontend): desktop notifications for new customer messages" \
  --body "$(cat <<'EOF'
## Summary
- 客戶新訊息彈瀏覽器桌面通知(分頁開著時),點擊直達該對話
- 判斷鏈:僅客戶訊息 → 偏好+權限 → 範圍(全部/我所屬團隊) → 正在看該對話抑制 → 同對話 3 秒節流(Notification tag 取代)
- NotificationSettingsModal 新增「桌面通知(此裝置)」區塊:權限四態(unsupported/default/granted/denied)
- 偏好存 localStorage(每裝置);提示音 + 頁面標題 (N) 未讀數
- 純前端,無後端變更、無 migration;不觸碰既有 Web Push 佔位碼

## Spec / Plan
- docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
- docs/superpowers/plans/2026-09-29-desktop-notifications.md

## Test plan
- [ ] 單元測試:decision logic / prefs / handler / title / modal(約 28 tests)
- [ ] `bash scripts/check.sh frontend` 綠
- [ ] 手動:Chrome 前景他對話收通知、背景收通知、點擊導航、正在看該對話不彈、my-teams 範圍、denied 狀態說明、標題未讀數
- [ ] Edge + Windows 通知中心實測

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: 輸出 PR URL。

- [ ] **Step 3: 回報手動驗證清單給使用者**

PR 開好後,提醒使用者(或依指示由實作者)完成下列手動驗證,再決定合併。**驗證環境以 Windows 為準(客服端一律 Windows)**,主測 Windows + Chrome,複測 Windows + Edge;macOS 只作開發煙霧測試不作驗收依據:

1. Windows + Chrome:登入 → `/notifications` 開設定 → 啟用桌面通知(權限彈窗按允許)
2. 停在別的對話,用真實 LINE 帳號傳訊 → 應彈通知 + 音效,標題出現 `(1)`,通知同步出現在 Windows 通知中心
3. 點通知 → 視窗聚焦並導航到該對話
4. 停在該對話(分頁前景)再傳 → 不彈
5. 切到其他應用程式(分頁背景)再傳 → 彈;通知自動收合後仍可在 Windows 通知中心點擊
6. 開「只提醒我所屬團隊」,用未指派團隊的對話傳訊 → 不彈
7. 瀏覽器封鎖通知後重開 Modal → 顯示封鎖說明(含 Windows 系統設定與專注助理提醒)
8. 開啟 Windows「專注助理」再傳訊 → 通知被系統隱藏(預期行為,確認不影響應用)
9. Windows + Edge 重複 1-3

**合併後部署(手動、需使用者同意):** 僅前端變更 → `bun run deploy:pages`(禁用 raw `wrangler pages deploy`)。無 Worker 變更,不需 `bun run deploy`。

---

## Self-Review 紀錄

- **Spec 覆蓋**:判斷鏈 5 條件(Task 2/4)、內容組裝(Task 2)、偏好+權限四態(Task 3/6)、音效(Task 4)、標題未讀(Task 5)、App 掛載+登入登出生命週期(Task 7)、錯誤處理(handler try/catch、Audio catch、localStorage fallback)、範圍外不觸碰 SW —— 全數對應。
- **型別一致性**:`DesktopPermission`/`DesktopNotificationScope` 定義於 logic 檔,prefs 與 handler 引用同一來源;`createNewMessageHandler` 測試中的 deps 形狀與實作介面一致;`User.name`(非 displayName)已核實。
- **佔位符**:無 TBD/TODO;所有步驟含完整程式碼與指令。
