// frontend/src/stores/unread.ts
// Shared singleton for 未讀 (personal: conversations *I* have not opened).
// The single poller lives in useUnreadConversationTotal (called once from App via
// usePageTitleUnread); that composable mirrors its value here so the sidebar badge
// reads the same number without starting a second poller.

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUnreadStore = defineStore('unread', () => {
  const total = ref(0)

  function setTotal(value: number): void {
    total.value = Math.max(0, value)
  }

  return { total, setTotal }
})
