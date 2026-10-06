/**
 * Page Title Unread Count
 *
 * 將「有未讀的對話數」以 "(N) " 前綴顯示在 document.title。
 * router/index.ts 的 beforeEach(router/index.ts:347-348)會依路由 meta.title 重設 document.title,
 * 本 composable 的 afterEach 註冊在其後,於 nextTick 重新套用前綴,不修改 router 本身。
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import { watch, nextTick, getCurrentScope, onScopeDispose } from 'vue'
import { useRouter } from 'vue-router'
import { useUnreadConversationTotal } from './useUnreadConversationTotal'

const UNREAD_PREFIX_RE = /^\(\d+\+?\)\s/

const MAX_DISPLAY_UNREAD = 99

export function formatTitleWithUnread(currentTitle: string, unread: number): string {
  const base = currentTitle.replace(UNREAD_PREFIX_RE, '')
  if (unread <= 0) {
    return base
  }
  const display = unread > MAX_DISPLAY_UNREAD ? `${MAX_DISPLAY_UNREAD}+` : String(unread)
  return `(${display}) ${base}`
}

/**
 * 應只在 App 根層呼叫一次(module-level 無單例保護,重複呼叫會重複註冊 router.afterEach)。
 */
export function usePageTitleUnread() {
  const router = useRouter()

  // 單位為「有未讀的對話數」,以後端 /stats 為基準(見 useUnreadConversationTotal)
  const { total: totalUnread } = useUnreadConversationTotal()

  const applyTitle = (): void => {
    document.title = formatTitleWithUnread(document.title, totalUnread.value)
  }

  watch(totalUnread, applyTitle, { immediate: true })

  // 路由切換後 router 自身的 afterEach 已重設 title,等 nextTick 再補前綴
  const unregisterAfterEach = router.afterEach(() => {
    void nextTick(applyTitle)
  })

  if (getCurrentScope()) {
    onScopeDispose(unregisterAfterEach)
  }

  return { totalUnread, applyTitle }
}
